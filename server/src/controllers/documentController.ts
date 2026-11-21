import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database.js';
import { AuthRequest, DocumentItem, DocumentRole, DocumentType } from '../types/index.js';
import { sendDocumentInviteEmail } from '../services/emailService.js';
import { getLiveDocState, updateLiveDocState } from '../socket/socketHandler.js';

export function getDocuments(req: AuthRequest, res: Response): void {
  try {
    const userId = req.user!.id;

    // Fetch owned documents
    const ownedDocs = db.prepare(`
      SELECT 
        d.*,
        'owner' as role,
        u.name as owner_name,
        u.email as owner_email,
        (SELECT COUNT(*) FROM document_collaborators WHERE document_id = d.id) as collaborator_count
      FROM documents d
      JOIN users u ON d.owner_id = u.id
      WHERE d.owner_id = ?
      ORDER BY d.updated_at DESC
    `).all(userId) as any[];

    // Fetch documents shared with this user
    const sharedDocs = db.prepare(`
      SELECT 
        d.*,
        c.role as role,
        u.name as owner_name,
        u.email as owner_email,
        (SELECT COUNT(*) FROM document_collaborators WHERE document_id = d.id) as collaborator_count
      FROM documents d
      JOIN document_collaborators c ON d.id = c.document_id
      JOIN users u ON d.owner_id = u.id
      WHERE c.user_id = ?
      ORDER BY d.updated_at DESC
    `).all(userId) as any[];

    res.json({
      owned: ownedDocs,
      shared: sharedDocs
    });
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Failed to retrieve documents.' });
  }
}

export function getDocumentById(req: AuthRequest, res: Response): void {
  try {
    const userId = req.user!.id;
    const docId = req.params.id as string;

    const doc = db.prepare(`
      SELECT 
        d.*,
        u.name as owner_name,
        u.email as owner_email
      FROM documents d
      JOIN users u ON d.owner_id = u.id
      WHERE d.id = ?
    `).get(docId) as any;

    if (!doc) {
      res.status(404).json({ error: 'Document not found.' });
      return;
    }

    let role: DocumentRole = 'viewer';
    if (doc.owner_id === userId) {
      role = 'owner';
    } else {
      const collab = db.prepare(`
        SELECT role FROM document_collaborators 
        WHERE document_id = ? AND user_id = ?
      `).get(docId, userId) as { role: DocumentRole } | undefined;

      if (!collab) {
        res.status(403).json({ error: 'You do not have access to this document.' });
        return;
      }
      role = collab.role;
    }

    // Fetch collaborators
    const collaborators = db.prepare(`
      SELECT 
        c.id, c.document_id, c.user_id, c.role, c.invited_at,
        u.name, u.email, u.avatar, u.color
      FROM document_collaborators c
      JOIN users u ON c.user_id = u.id
      WHERE c.document_id = ?
      ORDER BY c.invited_at ASC
    `).all(docId);

    // Overlay active live in-memory state if document is currently being edited
    const liveState = getLiveDocState(docId);
    if (liveState) {
      doc.content = liveState.content;
      doc.language = liveState.language;
    }

    res.json({
      document: { ...doc, role },
      collaborators
    });
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({ error: 'Failed to retrieve document details.' });
  }
}

export function createDocument(req: AuthRequest, res: Response): void {
  try {
    const userId = req.user!.id;
    const { title, type, language } = req.body;

    const docType: DocumentType = type === 'whiteboard' ? 'whiteboard' : 'code';
    const docTitle = title && title.trim().length > 0 ? title.trim() : (docType === 'code' ? 'Untitled Code' : 'Untitled Whiteboard');
    const docLang = language || (docType === 'code' ? 'javascript' : 'json');

    let initialContent = '';
    if (docType === 'code') {
      initialContent = `// ${docTitle}\n// Created on ${new Date().toLocaleDateString()}\n\nfunction main() {\n  console.log("Hello, real-time collaboration!");\n}\n\nmain();\n`;
    } else {
      initialContent = '[]';
    }

    const docId = uuidv4();
    const now = Date.now();

    db.prepare(`
      INSERT INTO documents (id, title, type, content, language, owner_id, created_at, updated_at, change_count, last_snapshot_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(docId, docTitle, docType, initialContent, docLang, userId, now, now, 0, now);

    // Initial snapshot version 1
    db.prepare(`
      INSERT INTO document_versions (id, document_id, version_number, content, language, created_by, description, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), docId, 1, initialContent, docLang, userId, 'Initial Creation', now);

    const createdDoc = db.prepare('SELECT * FROM documents WHERE id = ?').get(docId);

    res.status(201).json({
      message: 'Document created successfully.',
      document: { ...(createdDoc as any), role: 'owner' }
    });
  } catch (error) {
    console.error('Error creating document:', error);
    res.status(500).json({ error: 'Failed to create document.' });
  }
}

export function updateDocument(req: AuthRequest, res: Response): void {
  try {
    const docId = req.params.id as string;
    const { title, language, content } = req.body;
    const now = Date.now();

    if (title !== undefined) {
      db.prepare('UPDATE documents SET title = ?, updated_at = ? WHERE id = ?')
        .run(title.trim(), now, docId);
    }

    if (language !== undefined) {
      db.prepare('UPDATE documents SET language = ?, updated_at = ? WHERE id = ?')
        .run(language, now, docId);
    }

    if (content !== undefined) {
      db.prepare('UPDATE documents SET content = ?, updated_at = ?, change_count = change_count + 1 WHERE id = ?')
        .run(content, now, docId);
    }

    updateLiveDocState(docId, content, language);

    const updated = db.prepare('SELECT * FROM documents WHERE id = ?').get(docId);
    res.json({ message: 'Document updated successfully.', document: updated });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update document.' });
  }
}

export function deleteDocument(req: AuthRequest, res: Response): void {
  try {
    const docId = req.params.id as string;
    const userId = req.user!.id;

    // Check ownership
    const doc = db.prepare('SELECT owner_id FROM documents WHERE id = ?').get(docId) as { owner_id: string } | undefined;
    if (!doc) {
      res.status(404).json({ error: 'Document not found.' });
      return;
    }

    if (doc.owner_id !== userId) {
      res.status(403).json({ error: 'Only the document owner can delete this document.' });
      return;
    }

    // Delete cascading
    db.prepare('DELETE FROM messages WHERE document_id = ?').run(docId);
    db.prepare('DELETE FROM document_versions WHERE document_id = ?').run(docId);
    db.prepare('DELETE FROM document_collaborators WHERE document_id = ?').run(docId);
    db.prepare('DELETE FROM documents WHERE id = ?').run(docId);

    res.json({ message: 'Document deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete document.' });
  }
}

export function duplicateDocument(req: AuthRequest, res: Response): void {
  try {
    const docId = req.params.id as string;
    const userId = req.user!.id;

    const source = db.prepare('SELECT * FROM documents WHERE id = ?').get(docId) as DocumentItem | undefined;
    if (!source) {
      res.status(404).json({ error: 'Document not found.' });
      return;
    }

    const newDocId = uuidv4();
    const now = Date.now();
    const newTitle = `${source.title} (Copy)`;

    db.prepare(`
      INSERT INTO documents (id, title, type, content, language, owner_id, created_at, updated_at, change_count, last_snapshot_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(newDocId, newTitle, source.type, source.content, source.language, userId, now, now, 0, now);

    db.prepare(`
      INSERT INTO document_versions (id, document_id, version_number, content, language, created_by, description, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), newDocId, 1, source.content, source.language, userId, `Duplicated from ${source.title}`, now);

    const duplicated = db.prepare('SELECT * FROM documents WHERE id = ?').get(newDocId);
    res.status(201).json({
      message: 'Document duplicated successfully.',
      document: { ...(duplicated as any), role: 'owner' }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to duplicate document.' });
  }
}

export async function shareDocument(req: AuthRequest, res: Response): Promise<void> {
  try {
    const docId = req.params.id as string;
    const inviterId = req.user!.id;
    const inviterName = req.user!.name;
    const { email, role = 'editor' } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Collaborator email is required.' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Verify document exists and requester is owner
    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(docId) as DocumentItem | undefined;
    if (!doc) {
      res.status(404).json({ error: 'Document not found.' });
      return;
    }

    if (doc.owner_id !== inviterId) {
      res.status(403).json({ error: 'Only the owner can share this document.' });
      return;
    }

    // Check if target user exists
    let targetUser = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail) as any;
    
    // If target user doesn't exist yet, create a placeholder account so they can register or log in
    if (!targetUser) {
      const placeholderId = uuidv4();
      const placeholderColor = '#6366f1';
      const now = Date.now();
      // Temporary password placeholder
      db.prepare(`
        INSERT INTO users (id, name, email, password, color, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(placeholderId, normalizedEmail.split('@')[0], normalizedEmail, 'PENDING_INVITE', placeholderColor, now, now);

      targetUser = { id: placeholderId, name: normalizedEmail.split('@')[0], email: normalizedEmail, color: placeholderColor };
    }

    if (targetUser.id === inviterId) {
      res.status(400).json({ error: 'You are already the owner of this document.' });
      return;
    }

    // Upsert collaborator role
    const existingCollab = db.prepare('SELECT id FROM document_collaborators WHERE document_id = ? AND user_id = ?')
      .get(docId, targetUser.id);

    const now = Date.now();
    if (existingCollab) {
      db.prepare('UPDATE document_collaborators SET role = ?, invited_at = ? WHERE document_id = ? AND user_id = ?')
        .run(role, now, docId, targetUser.id);
    } else {
      db.prepare(`
        INSERT INTO document_collaborators (id, document_id, user_id, role, invited_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(uuidv4(), docId, targetUser.id, role, now);
    }

    // Send email invitation with dynamic origin detection (for production / live deployment)
    const clientOrigin = (req.headers.origin as string) || (req.headers.referer as string);
    await sendDocumentInviteEmail(normalizedEmail, inviterName, doc.title, doc.id, role, clientOrigin);

    const collaborators = db.prepare(`
      SELECT 
        c.id, c.document_id, c.user_id, c.role, c.invited_at,
        u.name, u.email, u.avatar, u.color
      FROM document_collaborators c
      JOIN users u ON c.user_id = u.id
      WHERE c.document_id = ?
      ORDER BY c.invited_at ASC
    `).all(docId);

    res.json({
      message: `Document shared with ${normalizedEmail} as ${role}.`,
      collaborators
    });
  } catch (error) {
    console.error('Error sharing document:', error);
    res.status(500).json({ error: 'Failed to share document.' });
  }
}

export function removeCollaborator(req: AuthRequest, res: Response): void {
  try {
    const docId = req.params.id as string;
    const targetUserId = req.params.userId as string;
    const currentUserId = req.user!.id;

    const doc = db.prepare('SELECT owner_id FROM documents WHERE id = ?').get(docId) as { owner_id: string } | undefined;
    if (!doc || doc.owner_id !== currentUserId) {
      res.status(403).json({ error: 'Only the document owner can remove collaborators.' });
      return;
    }

    db.prepare('DELETE FROM document_collaborators WHERE document_id = ? AND user_id = ?')
      .run(docId, targetUserId);

    res.json({ message: 'Collaborator removed successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove collaborator.' });
  }
}

export function updateCollaboratorRole(req: AuthRequest, res: Response): void {
  try {
    const docId = req.params.id as string;
    const targetUserId = req.params.userId as string;
    const currentUserId = req.user!.id;
    const { role } = req.body;

    if (!['editor', 'viewer'].includes(role)) {
      res.status(400).json({ error: 'Role must be either editor or viewer.' });
      return;
    }

    const doc = db.prepare('SELECT owner_id FROM documents WHERE id = ?').get(docId) as { owner_id: string } | undefined;
    if (!doc || doc.owner_id !== currentUserId) {
      res.status(403).json({ error: 'Only the document owner can change collaborator roles.' });
      return;
    }

    db.prepare('UPDATE document_collaborators SET role = ? WHERE document_id = ? AND user_id = ?')
      .run(role, docId, targetUserId);

    res.json({ message: 'Collaborator role updated successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update collaborator role.' });
  }
}

export function updateAccessLevel(req: AuthRequest, res: Response): void {
  try {
    const docId = req.params.id as string;
    const currentUserId = req.user!.id;
    const { accessLevel } = req.body;

    if (!['link_edit', 'link_view', 'restricted'].includes(accessLevel)) {
      res.status(400).json({ error: 'Access level must be link_edit, link_view, or restricted.' });
      return;
    }

    const doc = db.prepare('SELECT owner_id FROM documents WHERE id = ?').get(docId) as { owner_id: string } | undefined;
    if (!doc || doc.owner_id !== currentUserId) {
      res.status(403).json({ error: 'Only the document owner can change access settings.' });
      return;
    }

    db.prepare('UPDATE documents SET access_level = ? WHERE id = ?').run(accessLevel, docId);
    res.json({ message: 'General access settings updated.', accessLevel });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update access settings.' });
  }
}
