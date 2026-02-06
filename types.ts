export enum UserRole {
  MANAGER = "MANAGER",
  TECHNICIAN = "TECHNICIAN",
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  type: 'auto' | 'manual';
  icon: string;
  xp_reward: number;
  is_ephemeral: boolean;
  validity_months?: number;
  category?: string;
  procedure_id?: string;
  created_at: string;
}

export interface UserBadge {
  id: string;
  user_id: string;
  badge_id: string;
  awarded_at: string;
  expires_at?: string;
  awarded_by?: string;
}

export interface ProcedureReferent {
  id: string;
  procedure_id: string;
  user_id: string;
  assigned_at: string;
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
  id: string; // UUID ou ID numérique
  uuid?: string; // UUID du document
  db_id?: number; // ID numérique réel en base de données
  file_id: string; // Identifiant pour l'IA
  title: string;
  category: string;
  fileUrl?: string; // URL directe vers le document (PDF)
  pinecone_document_id?: string; // ID du document dans Pinecone pour le filtrage
  createdAt: string;
  updated_at?: string;
  views: number;
  status: "pending" | "validated";
  lastViewedAt?: string;
  suggestion_count?: number;
  is_trend?: boolean;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  updatedAt: string;
  viewed?: boolean;
  // Flash Notes
  status?: "private" | "suggestion" | "public"; // private = perso, suggestion = submitted, public = flash note
  category?: string; // used for filtering, default 'general'
}

export interface Suggestion {
  id: string;
  userName: string;
  procedureTitle: string;
  content: string;
  status: "pending" | "approved" | "rejected";
  viewed?: boolean;
  createdAt: string;
  type?: "correction" | "update" | "add_step";
  priority?: "low" | "medium" | "high";
  // Helper fields for detailed views
  user_id?: string;
  procedure_id?: string;
  managerResponse?: string;
  respondedAt?: string;
}

export type ViewType =
  | "dashboard"
  | "statistics"
  | "procedures"
  | "procedure-detail"
  | "notes"
  | "account"
  | "upload"
  | "history"
  | "compliance-history"
  | "reset-password"
  | "administration"
  | "team"
  | "team"
  | "search-results"
  | "flash-notes";
