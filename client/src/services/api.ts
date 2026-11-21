// Uses relative '/api' which Vite proxies to backend, or direct fallback
const API_BASE_URL = '/api';

function getToken(): string | null {
  return localStorage.getItem('collab_token');
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `HTTP error ${response.status}`);
  }

  return data as T;
}

export const api = {
  // Auth
  register: (body: { name: string; email: string; password: string }) =>
    request<{ message: string; token: string; user: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  login: (body: { email: string; password: string }) =>
    request<{ message: string; token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getProfile: () => request<{ user: any }>('/auth/me'),

  updateProfile: (body: { name: string; avatar?: string; color?: string }) =>
    request<{ message: string; user: any; token: string }>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  forgotPassword: (email: string) =>
    request<{ message: string; resetUrl?: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (body: { token: string; newPassword: string }) =>
    request<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  // Documents
  getDocuments: () => request<{ owned: any[]; shared: any[] }>('/documents'),

  getDocument: (id: string) =>
    request<{ document: any; collaborators: any[] }>(`/documents/${id}`),

  createDocument: (body: { title: string; type: 'code' | 'whiteboard'; language?: string }) =>
    request<{ message: string; document: any }>('/documents', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateDocument: (id: string, body: { title?: string; language?: string; content?: string }) =>
    request<{ message: string; document: any }>(`/documents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  deleteDocument: (id: string) =>
    request<{ message: string }>(`/documents/${id}`, {
      method: 'DELETE',
    }),

  duplicateDocument: (id: string) =>
    request<{ message: string; document: any }>(`/documents/${id}/duplicate`, {
      method: 'POST',
    }),

  shareDocument: (id: string, body: { email: string; role: 'editor' | 'viewer' }) =>
    request<{ message: string; collaborators: any[] }>(`/documents/${id}/share`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  removeCollaborator: (docId: string, userId: string) =>
    request<{ message: string }>(`/documents/${docId}/collaborators/${userId}`, {
      method: 'DELETE',
    }),

  updateCollaboratorRole: (docId: string, userId: string, role: 'editor' | 'viewer') =>
    request<{ message: string }>(`/documents/${docId}/collaborators/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    }),

  updateAccessLevel: (docId: string, accessLevel: 'link_edit' | 'link_view' | 'restricted') =>
    request<{ message: string; accessLevel: string }>(`/documents/${docId}/access`, {
      method: 'PUT',
      body: JSON.stringify({ accessLevel }),
    }),

  // Version History
  getVersions: (docId: string) =>
    request<{ versions: any[] }>(`/documents/${docId}/versions`),

  createSnapshot: (docId: string, description?: string) =>
    request<{ message: string; version: any }>(`/documents/${docId}/versions`, {
      method: 'POST',
      body: JSON.stringify({ description }),
    }),

  restoreVersion: (docId: string, versionId: string) =>
    request<{ message: string; document: any; restoredContent: string; restoredLanguage: string; newVersionNumber: number }>(
      `/documents/${docId}/versions/${versionId}/restore`,
      { method: 'POST' }
    ),

  // Email Notification history (Dev/preview tool)
  getEmailHistory: () => request<{ emails: any[] }>('/emails/history'),

  // Code Execution
  executeCode: (language: string, code: string) =>
    request<{ output: string | null; error: string | null; duration: number }>('/execute', {
      method: 'POST',
      body: JSON.stringify({ language, code }),
    }),
};
