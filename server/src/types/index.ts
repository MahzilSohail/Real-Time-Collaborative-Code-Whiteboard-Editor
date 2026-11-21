import { Request } from 'express';

export type DocumentRole = 'owner' | 'editor' | 'viewer';
export type DocumentType = 'code' | 'whiteboard';
export type AccessLevel = 'link_edit' | 'link_view' | 'restricted';

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  avatar?: string;
  color: string;
  reset_token?: string | null;
  reset_token_expires?: number | null;
  created_at: number;
  updated_at: number;
}

export interface DocumentItem {
  id: string;
  title: string;
  type: DocumentType;
  content: string;
  language: string;
  owner_id: string;
  created_at: number;
  updated_at: number;
  change_count: number;
  last_snapshot_at: number;
  access_level?: AccessLevel;
  // joined fields
  owner_name?: string;
  owner_email?: string;
  role?: DocumentRole;
}

export interface Collaborator {
  id: string;
  document_id: string;
  user_id: string;
  role: DocumentRole;
  invited_at: number;
  name: string;
  email: string;
  avatar?: string;
  color?: string;
}

export interface DocumentVersion {
  id: string;
  document_id: string;
  version_number: number;
  content: string;
  language: string;
  created_by: string;
  description: string;
  change_count: number;
  created_at: number;
  author_name?: string;
  author_email?: string;
}

export interface ChatMessage {
  id: string;
  document_id: string;
  user_id: string;
  content: string;
  created_at: number;
  user_name?: string;
  user_avatar?: string;
  user_color?: string;
}

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    color: string;
  };
  docRole?: DocumentRole;
}
