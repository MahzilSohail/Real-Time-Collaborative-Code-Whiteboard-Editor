import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database.js';
import { DocumentRole } from '../types/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-collab-editor-2026';

interface ActiveUser {
  socketId: string;
  userId: string;
  name: string;
  color: string;
  avatar?: string;
  role: DocumentRole;
  cursor?: { line: number; ch: number } | { x: number; y: number };
  lastActive: number;
}

// Map: docId -> Map of socketId -> ActiveUser
const roomUsers = new Map<string, Map<string, ActiveUser>>();

// Debounced auto-save & snapshot tracking
// docId -> { timer, changeCount, lastSnapshotTime, pendingContent, pendingType, pendingLang, lastAuthorId }
interface DocState {
  saveTimer?: NodeJS.Timeout;
  changeCount: number;
  lastSnapshotTime: number;
  content: string;
  language: string;
  type: string;
  lastAuthorId: string;
}

const docStates = new Map<string, DocState>();

export function getLiveDocState(docId: string): { content: string; language: string; type: string } | null {
  const state = docStates.get(docId);
  if (!state) return null;
  return { content: state.content, language: state.language, type: state.type };
}

export function updateLiveDocState(docId: string, content?: string, language?: string): void {
  const state = docStates.get(docId);
  if (state) {
    if (content !== undefined) state.content = content;
    if (language !== undefined) state.language = language;
    state.changeCount += 1;
  }
}

function getDocRole(docId: string, userId: string): DocumentRole | null {
  const doc = db.prepare('SELECT owner_id, access_level FROM documents WHERE id = ?').get(docId) as { owner_id: string; access_level?: string } | undefined;
  if (!doc) return null;
  if (doc.owner_id === userId) return 'owner';

  const collab = db.prepare('SELECT role FROM document_collaborators WHERE document_id = ? AND user_id = ?')
    .get(docId, userId) as { role: DocumentRole } | undefined;
  if (collab) return collab.role;

  const accessLevel = doc.access_level || 'link_edit';
  if (accessLevel === 'link_edit' || accessLevel === 'link_view') {
    const assignedRole: DocumentRole = accessLevel === 'link_edit' ? 'editor' : 'viewer';
    try {
      const collabId = uuidv4();
      const now = Date.now();
      db.prepare(`
        INSERT INTO document_collaborators (id, document_id, user_id, role, invited_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(collabId, docId, userId, assignedRole, now);
      return assignedRole;
    } catch {
      return assignedRole;
    }
  }

  return null;
}

function checkAndCreateAutoSnapshot(docId: string, state: DocState) {
  const now = Date.now();
  const timeSinceLastSnapshot = now - state.lastSnapshotTime;
  const is50Changes = state.changeCount >= 50;
  const is30Seconds = timeSinceLastSnapshot >= 30000 && state.changeCount > 0;

  if (is50Changes || is30Seconds) {
    try {
      const maxVerRow = db.prepare('SELECT MAX(version_number) as maxVer FROM document_versions WHERE document_id = ?')
        .get(docId) as { maxVer: number | null };
      const nextVer = (maxVerRow?.maxVer || 0) + 1;

      db.prepare(`
        INSERT INTO document_versions (id, document_id, version_number, content, language, created_by, description, change_count, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        uuidv4(),
        docId,
        nextVer,
        state.content,
        state.language,
        state.lastAuthorId,
        `Auto-save Snapshot v${nextVer} (${state.changeCount} changes)`,
        state.changeCount,
        now
      );

      state.changeCount = 0;
      state.lastSnapshotTime = now;

      db.prepare('UPDATE documents SET change_count = 0, last_snapshot_at = ? WHERE id = ?')
        .run(now, docId);

      console.log(`[Snapshot] Auto snapshot v${nextVer} created for document ${docId}`);
    } catch (err) {
      console.error('[Snapshot] Failed to auto create snapshot:', err);
    }
  }
}

function persistDocContent(docId: string, state: DocState) {
  try {
    const now = Date.now();
    db.prepare('UPDATE documents SET content = ?, language = ?, updated_at = ?, change_count = change_count + 1 WHERE id = ?')
      .run(state.content, state.language, now, docId);
  } catch (err) {
    console.error('[DB] Failed to persist doc content:', err);
  }
}

export function setupSocketIO(io: SocketIOServer) {
  // Middleware to authenticate socket connection
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    if (!token || typeof token !== 'string') {
      return next(new Error('Authentication error: Missing token'));
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as {
        id: string;
        email: string;
        name: string;
        color: string;
      };
      (socket as any).user = decoded;
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user;
    let currentDocId: string | null = null;

    // Join document workspace room
    socket.on('doc:join', ({ docId }: { docId: string }) => {
      if (!docId) return;

      const role = getDocRole(docId, user.id);
      if (!role) {
        socket.emit('error:forbidden', { message: 'You do not have access to this document.' });
        return;
      }

      currentDocId = docId;
      socket.join(`doc:${docId}`);

      if (!roomUsers.has(docId)) {
        roomUsers.set(docId, new Map());
      }

      const docUsers = roomUsers.get(docId)!;
      const activeUser: ActiveUser = {
        socketId: socket.id,
        userId: user.id,
        name: user.name,
        color: user.color,
        role,
        lastActive: Date.now()
      };
      docUsers.set(socket.id, activeUser);

      // Initialize state in memory if needed
      if (!docStates.has(docId)) {
        const doc = db.prepare('SELECT content, language, type, change_count, last_snapshot_at FROM documents WHERE id = ?')
          .get(docId) as any;
        if (doc) {
          docStates.set(docId, {
            content: doc.content || '',
            language: doc.language || 'javascript',
            type: doc.type,
            changeCount: doc.change_count || 0,
            lastSnapshotTime: doc.last_snapshot_at || Date.now(),
            lastAuthorId: user.id
          });
        }
      }

      // Broadcast updated online presence list
      const usersList = Array.from(docUsers.values());
      io.to(`doc:${docId}`).emit('presence:update', usersList);

      // Notify others that a user has joined (for toast notification)
      socket.to(`doc:${docId}`).emit('notification:toast', {
        type: 'join',
        message: `${user.name} joined the document`,
        user: { name: user.name, color: user.color, role }
      });

      // Send recent chat messages to this user
      const messages = db.prepare(`
        SELECT m.id, m.document_id, m.user_id, m.content, m.created_at,
               u.name as user_name, u.color as user_color, u.avatar as user_avatar
        FROM messages m
        JOIN users u ON m.user_id = u.id
        WHERE m.document_id = ?
        ORDER BY m.created_at ASC
        LIMIT 50
      `).all(docId);

      socket.emit('chat:history', messages);

      // Immediately push latest active document state to the newly joined peer
      const liveState = docStates.get(docId);
      if (liveState) {
        if (liveState.type === 'whiteboard') {
          try {
            socket.emit('whiteboard:update', {
              elements: JSON.parse(liveState.content || '[]'),
              action: 'sync'
            });
          } catch {}
        } else {
          socket.emit('code:update', {
            content: liveState.content,
            language: liveState.language,
            updatedBy: { id: 'system', name: 'Server Live Sync' }
          });
        }
      }

      console.log(`[Socket] User ${user.name} joined doc ${docId} as ${role}`);
    });

    // Real-time live cursor movement (code editor line/col or whiteboard canvas x/y)
    socket.on('cursor:move', (data: { cursor: any }) => {
      if (!currentDocId) return;

      const docUsers = roomUsers.get(currentDocId);
      if (docUsers && docUsers.has(socket.id)) {
        const active = docUsers.get(socket.id)!;
        active.cursor = data.cursor;
        active.lastActive = Date.now();
      }

      // Broadcast cursor movement with user info to other users in room
      socket.to(`doc:${currentDocId}`).emit('cursor:update', {
        socketId: socket.id,
        userId: user.id,
        name: user.name,
        color: user.color,
        cursor: data.cursor
      });
    });

    // Real-time code change event
    socket.on('code:change', (data: { content: string; language?: string; delta?: any; docId?: string }) => {
      const docId = currentDocId || data.docId;
      if (!docId) return;

      const role = getDocRole(docId, user.id);
      // ENFORCE VIEWER RESTRICTION ON SERVER SIDE!
      if (role === 'viewer') {
        socket.emit('error:forbidden', { message: 'Viewers cannot modify document contents.' });
        return;
      }

      let state = docStates.get(docId);
      if (!state) {
        state = {
          content: data.content,
          language: data.language || 'javascript',
          type: 'code',
          changeCount: 1,
          lastSnapshotTime: Date.now(),
          lastAuthorId: user.id
        };
        docStates.set(docId, state);
      } else {
        state.content = data.content;
        if (data.language) state.language = data.language;
        state.changeCount += 1;
        state.lastAuthorId = user.id;
      }

      // Broadcast code update to all other room members instantly (latency < 50ms)
      socket.to(`doc:${docId}`).emit('code:update', {
        content: data.content,
        language: data.language || state.language,
        delta: data.delta,
        updatedBy: { id: user.id, name: user.name }
      });

      // Quick debounce database write (500ms)
      if (state.saveTimer) clearTimeout(state.saveTimer);
      state.saveTimer = setTimeout(() => {
        persistDocContent(docId, state!);
        checkAndCreateAutoSnapshot(docId, state!);
      }, 500);
    });

    // Real-time whiteboard change event (shapes array, single shape diff, or clear)
    socket.on('whiteboard:change', (data: { elements: any[]; action?: string }) => {
      if (!currentDocId) return;

      const role = getDocRole(currentDocId, user.id);
      // ENFORCE VIEWER RESTRICTION ON SERVER SIDE!
      if (role === 'viewer') {
        socket.emit('error:forbidden', { message: 'Viewers cannot modify whiteboard contents.' });
        return;
      }

      const stringified = JSON.stringify(data.elements);
      let state = docStates.get(currentDocId);
      if (!state) {
        state = {
          content: stringified,
          language: 'json',
          type: 'whiteboard',
          changeCount: 1,
          lastSnapshotTime: Date.now(),
          lastAuthorId: user.id
        };
        docStates.set(currentDocId, state);
      } else {
        state.content = stringified;
        state.changeCount += 1;
        state.lastAuthorId = user.id;
      }

      // Broadcast to other peers in room instantly
      socket.to(`doc:${currentDocId}`).emit('whiteboard:update', {
        elements: data.elements,
        action: data.action,
        updatedBy: { id: user.id, name: user.name }
      });

      // Debounce auto-save
      if (state.saveTimer) clearTimeout(state.saveTimer);
      state.saveTimer = setTimeout(() => {
        if (!currentDocId) return;
        persistDocContent(currentDocId, state!);
        checkAndCreateAutoSnapshot(currentDocId, state!);
      }, 1500);
    });

    // Real-time chat message
    socket.on('chat:send', (data: { content: string }) => {
      if (!currentDocId || !data.content || data.content.trim().length === 0) return;

      const messageId = uuidv4();
      const now = Date.now();
      const text = data.content.trim();

      try {
        db.prepare('INSERT INTO messages (id, document_id, user_id, content, created_at) VALUES (?, ?, ?, ?, ?)')
          .run(messageId, currentDocId, user.id, text, now);

        const chatMsg = {
          id: messageId,
          document_id: currentDocId,
          user_id: user.id,
          content: text,
          created_at: now,
          user_name: user.name,
          user_color: user.color,
          user_avatar: user.avatar
        };

        // Broadcast to everyone in room including sender
        io.to(`doc:${currentDocId}`).emit('chat:message', chatMsg);
      } catch (err) {
        console.error('Failed to save chat message:', err);
      }
    });

    // Broadcast version restore event so all open clients instantly reload new state
    socket.on('doc:restored', (data: { versionNumber: number; content: string; language: string }) => {
      if (!currentDocId) return;

      const state = docStates.get(currentDocId);
      if (state) {
        state.content = data.content;
        state.language = data.language;
        state.changeCount = 0;
      }

      io.to(`doc:${currentDocId}`).emit('doc:reloaded', {
        versionNumber: data.versionNumber,
        content: data.content,
        language: data.language,
        restoredBy: user.name
      });

      io.to(`doc:${currentDocId}`).emit('notification:toast', {
        type: 'restore',
        message: `${user.name} restored the document to Version ${data.versionNumber}`,
        user: { name: user.name, color: user.color }
      });
    });

    // Handle user disconnect
    const cleanup = () => {
      if (!currentDocId) return;

      const docUsers = roomUsers.get(currentDocId);
      if (docUsers) {
        docUsers.delete(socket.id);
        const usersList = Array.from(docUsers.values());
        io.to(`doc:${currentDocId}`).emit('presence:update', usersList);

        // Tell others this cursor is gone
        socket.to(`doc:${currentDocId}`).emit('cursor:remove', { socketId: socket.id });

        // User left notification
        socket.to(`doc:${currentDocId}`).emit('notification:toast', {
          type: 'leave',
          message: `${user.name} left the document`,
          user: { name: user.name, color: user.color }
        });

        if (docUsers.size === 0) {
          roomUsers.delete(currentDocId);
          // If no one is in room, flush pending state to DB
          const state = docStates.get(currentDocId);
          if (state && state.saveTimer) {
            clearTimeout(state.saveTimer);
            persistDocContent(currentDocId, state);
            checkAndCreateAutoSnapshot(currentDocId, state);
            docStates.delete(currentDocId);
          }
        }
      }

      socket.leave(`doc:${currentDocId}`);
      currentDocId = null;
    };

    socket.on('doc:leave', cleanup);
    socket.on('disconnect', cleanup);
  });
}
