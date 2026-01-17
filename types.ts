
export enum UserRole {
  MANAGER = 'MANAGER',
  TECHNICIAN = 'TECHNICIAN'
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  avatarUrl?: string;
  position?: string;
  phone?: string;
}

export interface Procedure {
  id: string;
  title: string;
  category: string;
  createdAt: string;
  views: number;
  status: 'pending' | 'validated';
}

export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  updatedAt: string;
}

export type ViewType = 'dashboard' | 'statistics' | 'procedures' | 'notes' | 'account' | 'upload';
