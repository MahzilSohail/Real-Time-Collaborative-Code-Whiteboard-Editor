import { Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AuthRequest, DocumentRole } from '../types/index.js';
import { db } from '../db/database.js';

export function checkDocAccess(requiredRole: 'viewer' | 'editor' | 'owner') {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const userId = req.user?.id;
    const docId = req.params.id || req.body.documentId;

    if (!userId || !docId) {
      res.status(400).json({ error: 'Document ID and authenticated user are required.' });
      return;
    }

    // Check if user is owner
    const docStmt = db.prepare('SELECT owner_id, access_level FROM documents WHERE id = ?');
    const doc = docStmt.get(docId) as { owner_id: string; access_level?: string } | undefined;

    if (!doc) {
      res.status(404).json({ error: 'Document not found.' });
      return;
    }

    if (doc.owner_id === userId) {
      req.docRole = 'owner';
      return next();
    }

    // Check collaborator table
    const collabStmt = db.prepare('SELECT role FROM document_collaborators WHERE document_id = ? AND user_id = ?');
    let collab = collabStmt.get(docId, userId) as { role: DocumentRole } | undefined;

    if (!collab) {
      // General Access link check (Anyone with link: edit or view)
      const accessLevel = doc.access_level || 'link_edit';

      if (accessLevel === 'link_edit' || accessLevel === 'link_view') {
        const assignedRole: DocumentRole = accessLevel === 'link_edit' ? 'editor' : 'viewer';
        const collabId = uuidv4();
        const now = Date.now();
        db.prepare(`
          INSERT INTO document_collaborators (id, document_id, user_id, role, invited_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(collabId, docId, userId, assignedRole, now);

        req.docRole = assignedRole;
        return next();
      }

      res.status(403).json({ error: 'This document is restricted. Please ask the owner to invite your email.' });
      return;
    }

    const userRole = collab.role;
    req.docRole = userRole;

    if (requiredRole === 'owner' && userRole !== 'owner') {
      res.status(403).json({ error: 'Only the document owner can perform this action.' });
      return;
    }

    if (requiredRole === 'editor' && userRole === 'viewer') {
      res.status(403).json({ error: 'Viewers have read-only access and cannot edit this document.' });
      return;
    }

    next();
  };
}
