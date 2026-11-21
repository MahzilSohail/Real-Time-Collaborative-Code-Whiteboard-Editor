export type DocumentRole = 'owner' | 'editor' | 'viewer';
export type DocumentType = 'code' | 'whiteboard';
export type AccessLevel = 'link_edit' | 'link_view' | 'restricted';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  color: string;
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
  owner_name?: string;
  owner_email?: string;
  role?: DocumentRole;
  collaborator_count?: number;
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
  author_color?: string;
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

export interface ActiveUser {
  socketId: string;
  userId: string;
  name: string;
  color: string;
  avatar?: string;
  role: DocumentRole;
  cursor?: { line: number; ch: number } | { x: number; y: number };
  lastActive: number;
}

export interface WhiteboardElement {
  id: string;
  type: 'pencil' | 'rectangle' | 'circle' | 'arrow' | 'line' | 'text' | 'note';
  x: number;
  y: number;
  width?: number;
  height?: number;
  endX?: number;
  endY?: number;
  points?: { x: number; y: number }[];
  color: string;
  strokeWidth: number;
  fill?: string;
  text?: string;
  fontSize?: number;
}
