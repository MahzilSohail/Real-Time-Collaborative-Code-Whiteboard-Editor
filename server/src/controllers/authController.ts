import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { db } from '../db/database.js';
import { AuthRequest, User } from '../types/index.js';
import { sendPasswordResetEmail } from '../services/emailService.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-collab-editor-2026';

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', 
  '#f97316', '#eab308', '#10b981', '#06b6d4', '#3b82f6'
];

function getRandomColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

function generateToken(user: { id: string; email: string; name: string; color: string }): string {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, color: user.color },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ error: 'Name, email, and password are required.' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters long.' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user exists
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
    if (existing) {
      res.status(400).json({ error: 'An account with this email already exists.' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();
    const color = getRandomColor();
    const now = Date.now();

    db.prepare(`
      INSERT INTO users (id, name, email, password, avatar, color, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, name.trim(), normalizedEmail, hashedPassword, null, color, now, now);

    // Seed welcoming starter documents for the new user so they can immediately test
    const starterCodeDocId = uuidv4();
    const starterCode = `// Welcome to your Real-Time Collaborative Code Editor!
// Edit in real-time with other users, view version history, and run code.

function calculateTeamVelocity(storyPoints, completedPoints) {
  const completionRate = (completedPoints / storyPoints) * 100;
  console.log(\`Sprint Progress: \${completionRate.toFixed(1)}%\`);
  return completionRate;
}

const sprintGoal = 40;
const currentProgress = 32;
const result = calculateTeamVelocity(sprintGoal, currentProgress);

console.log("Ready for real-time collaboration!");
`;

    db.prepare(`
      INSERT INTO documents (id, title, type, content, language, owner_id, created_at, updated_at, change_count, last_snapshot_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      starterCodeDocId,
      'Interactive Code Playground',
      'code',
      starterCode,
      'javascript',
      userId,
      now,
      now,
      0,
      now
    );

    // Initial snapshot for the starter doc
    db.prepare(`
      INSERT INTO document_versions (id, document_id, version_number, content, language, created_by, description, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), starterCodeDocId, 1, starterCode, 'javascript', userId, 'Initial Project Template', now);

    // Starter Whiteboard
    const starterWhiteboardDocId = uuidv4();
    const starterWhiteboardData = JSON.stringify([
      {
        id: 'box-1',
        type: 'rectangle',
        x: 100,
        y: 80,
        width: 180,
        height: 80,
        color: '#6366f1',
        strokeWidth: 3,
        text: 'Client App (React + Vite)',
        fill: '#312e81'
      },
      {
        id: 'box-2',
        type: 'rectangle',
        x: 420,
        y: 80,
        width: 180,
        height: 80,
        color: '#10b981',
        strokeWidth: 3,
        text: 'WebSocket Server (Socket.io)',
        fill: '#064e3b'
      },
      {
        id: 'arrow-1',
        type: 'arrow',
        x: 280,
        y: 120,
        endX: 420,
        endY: 120,
        color: '#f59e0b',
        strokeWidth: 3
      },
      {
        id: 'box-3',
        type: 'rectangle',
        x: 260,
        y: 240,
        width: 180,
        height: 70,
        color: '#ec4899',
        strokeWidth: 3,
        text: 'SQLite DB & Snapshots',
        fill: '#831843'
      }
    ]);

    db.prepare(`
      INSERT INTO documents (id, title, type, content, language, owner_id, created_at, updated_at, change_count, last_snapshot_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      starterWhiteboardDocId,
      'System Architecture Whiteboard',
      'whiteboard',
      starterWhiteboardData,
      'json',
      userId,
      now,
      now,
      0,
      now
    );

    db.prepare(`
      INSERT INTO document_versions (id, document_id, version_number, content, language, created_by, description, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), starterWhiteboardDocId, 1, starterWhiteboardData, 'json', userId, 'Initial Architecture Diagram', now);

    const userObj = { id: userId, email: normalizedEmail, name: name.trim(), color };
    const token = generateToken(userObj);

    res.status(201).json({
      message: 'User registered successfully.',
      token,
      user: userObj
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error during registration.' });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail) as User | undefined;

    if (!user || !user.password) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const userObj = {
      id: user.id,
      email: user.email,
      name: user.name,
      color: user.color || '#6366f1',
      avatar: user.avatar
    };

    const token = generateToken(userObj);

    res.json({
      message: 'Login successful.',
      token,
      user: userObj
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error during login.' });
  }
}

export function getCurrentUser(req: AuthRequest, res: Response): void {
  try {
    const userId = req.user!.id;
    const user = db.prepare('SELECT id, name, email, avatar, color, created_at FROM users WHERE id = ?').get(userId) as unknown as User | undefined;

    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve user profile.' });
  }
}

export function updateProfile(req: AuthRequest, res: Response): void {
  try {
    const userId = req.user!.id;
    const { name, avatar, color } = req.body;

    if (!name || name.trim().length === 0) {
      res.status(400).json({ error: 'Name is required.' });
      return;
    }

    const now = Date.now();
    db.prepare(`
      UPDATE users 
      SET name = ?, avatar = ?, color = ?, updated_at = ?
      WHERE id = ?
    `).run(name.trim(), avatar || null, color || '#6366f1', now, userId);

    const updated = db.prepare('SELECT id, name, email, avatar, color FROM users WHERE id = ?').get(userId) as unknown as User;

    // Issue updated token
    const token = generateToken({
      id: updated.id,
      email: updated.email,
      name: updated.name,
      color: updated.color
    });

    res.json({
      message: 'Profile updated successfully.',
      user: updated,
      token
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update profile.' });
  }
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Email is required.' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail) as User | undefined;

    if (!user) {
      // Don't leak user existence, return polite message
      res.json({ message: 'If that email is registered, a password reset link has been sent.' });
      return;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = Date.now() + 3600000; // 1 hour

    db.prepare('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?')
      .run(resetToken, resetExpires, user.id);

    const resetUrl = await sendPasswordResetEmail(normalizedEmail, resetToken, user.name);

    res.json({
      message: 'Password reset link sent to your email.',
      // Returning resetUrl in dev environment for smooth demo testing
      resetUrl: process.env.NODE_ENV !== 'production' ? resetUrl : undefined
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process password reset request.' });
  }
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      res.status(400).json({ error: 'Token and new password are required.' });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters long.' });
      return;
    }

    const now = Date.now();
    const user = db.prepare(`
      SELECT * FROM users 
      WHERE reset_token = ? AND reset_token_expires > ?
    `).get(token, now) as User | undefined;

    if (!user) {
      res.status(400).json({ error: 'Invalid or expired password reset token.' });
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    db.prepare(`
      UPDATE users 
      SET password = ?, reset_token = NULL, reset_token_expires = NULL, updated_at = ?
      WHERE id = ?
    `).run(hashedPassword, now, user.id);

    res.json({ message: 'Password has been reset successfully. You can now log in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password.' });
  }
}
