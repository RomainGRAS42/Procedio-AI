export enum UserRole {
  MANAGER = "MANAGER",
  TECHNICIAN = "TECHNICIAN",
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
  id: string; // UUID du document
  db_id?: number; // ID numérique réel en base de données
  file_id: string; // Identifiant pour l'IA
  title: string;
  category: string;
  fileUrl?: string; // URL directe vers le document (PDF)
  pinecone_document_id?: string; // ID du document dans Pinecone pour le filtrage
  createdAt: string;
  views: number;
  status: "pending" | "validated";
  lastViewedAt?: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  updatedAt: string;
  viewed?: boolean;
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
  | "search-results";
