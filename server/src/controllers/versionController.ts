import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database.js';
import { AuthRequest, DocumentItem } from '../types/index.js';
import { updateLiveDocState } from '../socket/socketHandler.js';

export function getVersions(req: AuthRequest, res: Response): void {
  try {
    const docId = req.params.id as string;

    const versions = db.prepare(`
      SELECT 
        v.id, v.document_id, v.version_number, v.content, v.language, 
        v.created_by, v.description, v.change_count, v.created_at,
        u.name as author_name, u.email as author_email, u.color as author_color
      FROM document_versions v
      JOIN users u ON v.created_by = u.id
      WHERE v.document_id = ?
      ORDER BY v.version_number DESC
    `).all(docId);

    res.json({ versions });
  } catch (error) {
    console.error('Error fetching versions:', error);
    res.status(500).json({ error: 'Failed to retrieve version history.' });
  }
}

export function createSnapshot(req: AuthRequest, res: Response): void {
  try {
    const docId = req.params.id as string;
    const userId = req.user!.id;
    const { description } = req.body;

    // Check if user is owner or editor
    if (req.docRole === 'viewer') {
      res.status(403).json({ error: 'Viewers cannot create version snapshots.' });
      return;
    }

    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(docId) as DocumentItem | undefined;
    if (!doc) {
      res.status(404).json({ error: 'Document not found.' });
      return;
    }

    // Get max version number
    const maxVerRow = db.prepare('SELECT MAX(version_number) as maxVer FROM document_versions WHERE document_id = ?')
      .get(docId) as { maxVer: number | null };
    const nextVersion = (maxVerRow?.maxVer || 0) + 1;

    const versionId = uuidv4();
    const now = Date.now();

    db.prepare(`
      INSERT INTO document_versions (id, document_id, version_number, content, language, created_by, description, change_count, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      versionId,
      docId,
      nextVersion,
      doc.content,
      doc.language,
      userId,
      description || `Snapshot v${nextVersion}`,
      doc.change_count,
      now
    );

    // Reset document change counter and update last snapshot timestamp
    db.prepare('UPDATE documents SET change_count = 0, last_snapshot_at = ? WHERE id = ?')
      .run(now, docId);

    const newVersion = db.prepare(`
      SELECT 
        v.*, u.name as author_name, u.email as author_email, u.color as author_color
      FROM document_versions v
      JOIN users u ON v.created_by = u.id
      WHERE v.id = ?
    `).get(versionId);

    res.status(201).json({
      message: `Version ${nextVersion} created successfully.`,
      version: newVersion
    });
  } catch (error) {
    console.error('Error creating snapshot:', error);
    res.status(500).json({ error: 'Failed to create snapshot.' });
  }
}

export function restoreVersion(req: AuthRequest, res: Response): void {
  try {
    const docId = req.params.id as string;
    const versionId = req.params.versionId as string;
    const userId = req.user!.id;

    if (req.docRole === 'viewer') {
      res.status(403).json({ error: 'Viewers cannot restore versions.' });
      return;
    }

    const targetVersion = db.prepare('SELECT * FROM document_versions WHERE id = ? AND document_id = ?')
      .get(versionId, docId) as any;

    if (!targetVersion) {
      res.status(404).json({ error: 'Version not found.' });
      return;
    }

    const now = Date.now();

    // Update document content and language
    db.prepare(`
      UPDATE documents 
      SET content = ?, language = ?, updated_at = ?, change_count = 0, last_snapshot_at = ?
      WHERE id = ?
    `).run(targetVersion.content, targetVersion.language || 'javascript', now, now, docId);

    // Sync in-memory live state buffer
    updateLiveDocState(docId, targetVersion.content, targetVersion.language || 'javascript');

    // Safe restore: creates a brand new snapshot representing this restored state without destroying history!
    const maxVerRow = db.prepare('SELECT MAX(version_number) as maxVer FROM document_versions WHERE document_id = ?')
      .get(docId) as { maxVer: number | null };
    const nextVersion = (maxVerRow?.maxVer || 0) + 1;

    const restoreSnapshotId = uuidv4();
    db.prepare(`
      INSERT INTO document_versions (id, document_id, version_number, content, language, created_by, description, change_count, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      restoreSnapshotId,
      docId,
      nextVersion,
      targetVersion.content,
      targetVersion.language,
      userId,
      `Restored from Version ${targetVersion.version_number}`,
      0,
      now
    );

    const updatedDoc = db.prepare('SELECT * FROM documents WHERE id = ?').get(docId);

    res.json({
      message: `Document restored to version ${targetVersion.version_number} as new version ${nextVersion}.`,
      document: updatedDoc,
      restoredContent: targetVersion.content,
      restoredLanguage: targetVersion.language,
      newVersionNumber: nextVersion
    });
  } catch (error) {
    console.error('Error restoring version:', error);
    res.status(500).json({ error: 'Failed to restore version.' });
  }
}
