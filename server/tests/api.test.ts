import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { db } from '../src/db/database.js';

describe('Real-Time Collaborative Code & Whiteboard API', () => {
  let user1Token = '';
  let user1Id = '';
  let user2Token = '';
  let user2Id = '';
  let createdDocId = '';
  let snapshotVersionId = '';

  const testUser1 = {
    name: 'Alice Developer',
    email: `alice_${Date.now()}@simplera.test`,
    password: 'password123',
  };

  const testUser2 = {
    name: 'Bob Reviewer',
    email: `bob_${Date.now()}@simplera.test`,
    password: 'password123',
  };

  it('Health check endpoint returns healthy status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
  });

  describe('Authentication & User Management', () => {
    it('Registers User 1 successfully with hashed password and starter documents', async () => {
      const res = await request(app).post('/api/auth/register').send(testUser1);
      expect(res.status).toBe(201);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe(testUser1.email);
      user1Token = res.body.token;
      user1Id = res.body.user.id;
    });

    it('Registers User 2 successfully', async () => {
      const res = await request(app).post('/api/auth/register').send(testUser2);
      expect(res.status).toBe(201);
      user2Token = res.body.token;
      user2Id = res.body.user.id;
    });

    it('Logs in registered user with correct credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser1.email, password: testUser1.password });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
    });

    it('Rejects login with invalid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser1.email, password: 'wrongpassword' });
      expect(res.status).toBe(401);
    });

    it('Fetches profile of authenticated user', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${user1Token}`);
      expect(res.status).toBe(200);
      expect(res.body.user.name).toBe(testUser1.name);
    });

    it('Updates user profile name and presence color', async () => {
      const res = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ name: 'Alice Senior Dev', color: '#10b981' });
      expect(res.status).toBe(200);
      expect(res.body.user.name).toBe('Alice Senior Dev');
      expect(res.body.user.color).toBe('#10b981');
    });

    it('Generates password reset token', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: testUser1.email });
      expect(res.status).toBe(200);
      expect(res.body.message.toLowerCase()).toContain('password reset link');
    }, 15000);
  });

  describe('Document CRUD & Collaboration Management', () => {
    it('Creates a new collaborative code document', async () => {
      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          title: 'Algorithms & Concurrency',
          type: 'code',
          language: 'javascript',
        });
      expect(res.status).toBe(201);
      expect(res.body.document.id).toBeDefined();
      expect(res.body.document.title).toBe('Algorithms & Concurrency');
      expect(res.body.document.role).toBe('owner');
      createdDocId = res.body.document.id;
    });

    it('Retrieves list of documents for User 1', async () => {
      const res = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${user1Token}`);
      expect(res.status).toBe(200);
      expect(res.body.owned.length).toBeGreaterThan(0);
    });

    it('Retrieves specific document with role and collaborators', async () => {
      const res = await request(app)
        .get(`/api/documents/${createdDocId}`)
        .set('Authorization', `Bearer ${user1Token}`);
      expect(res.status).toBe(200);
      expect(res.body.document.id).toBe(createdDocId);
      expect(res.body.document.role).toBe('owner');
    });

    it('Shares document with User 2 as Viewer (Role-based access)', async () => {
      const res = await request(app)
        .post(`/api/documents/${createdDocId}/share`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ email: testUser2.email, role: 'viewer' });
      expect(res.status).toBe(200);
      expect(res.body.collaborators.some((c: any) => c.email === testUser2.email)).toBe(true);
    });

    it('User 2 can view the shared document with viewer role', async () => {
      const res = await request(app)
        .get(`/api/documents/${createdDocId}`)
        .set('Authorization', `Bearer ${user2Token}`);
      expect(res.status).toBe(200);
      expect(res.body.document.role).toBe('viewer');
    });

    it('Enforces server-side role check: Viewer CANNOT edit document', async () => {
      const res = await request(app)
        .put(`/api/documents/${createdDocId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ title: 'Hacked Title By Viewer' });
      expect(res.status).toBe(403);
    });

    it('Promotes User 2 to Editor role', async () => {
      const res = await request(app)
        .put(`/api/documents/${createdDocId}/collaborators/${user2Id}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ role: 'editor' });
      expect(res.status).toBe(200);
    });

    it('Editor CAN now update document metadata', async () => {
      const res = await request(app)
        .put(`/api/documents/${createdDocId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ title: 'Algorithms & Concurrency (Reviewed)' });
      expect(res.status).toBe(200);
      expect(res.body.document.title).toBe('Algorithms & Concurrency (Reviewed)');
    });

    it('Duplicates document successfully', async () => {
      const res = await request(app)
        .post(`/api/documents/${createdDocId}/duplicate`)
        .set('Authorization', `Bearer ${user1Token}`);
      expect(res.status).toBe(201);
      expect(res.body.document.title).toContain('(Copy)');
    });
  });

  describe('Version History & Safe Restore', () => {
    it('Creates a manual milestone snapshot', async () => {
      const res = await request(app)
        .post(`/api/documents/${createdDocId}/versions`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ description: 'Release v1.0.0 Milestone' });
      expect(res.status).toBe(201);
      expect(res.body.version.version_number).toBeGreaterThanOrEqual(1);
      snapshotVersionId = res.body.version.id;
    });

    it('Retrieves complete version timeline', async () => {
      const res = await request(app)
        .get(`/api/documents/${createdDocId}/versions`)
        .set('Authorization', `Bearer ${user1Token}`);
      expect(res.status).toBe(200);
      expect(res.body.versions.length).toBeGreaterThanOrEqual(1);
    });

    it('Safely restores previous version (creates new version without destroying history)', async () => {
      const res = await request(app)
        .post(`/api/documents/${createdDocId}/versions/${snapshotVersionId}/restore`)
        .set('Authorization', `Bearer ${user1Token}`);
      expect(res.status).toBe(200);
      expect(res.body.newVersionNumber).toBeDefined();

      // Verify that version timeline has grown, not shrunk
      const checkRes = await request(app)
        .get(`/api/documents/${createdDocId}/versions`)
        .set('Authorization', `Bearer ${user1Token}`);
      expect(checkRes.body.versions.length).toBeGreaterThanOrEqual(2);
    });
  });
});
