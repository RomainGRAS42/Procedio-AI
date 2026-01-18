
export enum UserRole {
  MANAGER = 'MANAGER',
  TECHNICIAN = 'TECHNICIAN'
}

export interface Badge {
  id: string;
  icon: string;
  name: string;
  description: string;
  color: string;
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
  level: number;
  currentXp: number;
  nextLevelXp: number;
  badges: Badge[];
}

export interface Procedure {
  id: string;
  title: string;
  category: string;
  createdAt: string;
  views: number;
  status: 'pending' | 'validated';
  lastViewedAt?: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  updatedAt: string;
}

export interface Suggestion {
  id: string;
  procedureId: string;
  procedureTitle: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: Date;
  status: 'pending' | 'approved' | 'rejected';
}

export type ViewType = 'dashboard' | 'statistics' | 'procedures' | 'procedure-detail' | 'notes' | 'account' | 'upload' | 'history' | 'reset-password';
