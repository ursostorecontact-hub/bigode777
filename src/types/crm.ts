export type UserRole = 'admin' | 'manager' | 'salesperson';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  active: boolean;
  created_at: string;
}

export interface UserRoleRecord {
  id: string;
  user_id: string;
  role: UserRole;
}

export type LeadStatus = 'novo' | 'contactado' | 'negociando' | 'proposta_enviada' | 'ganho' | 'perdido';
export type LeadPriority = 'alta' | 'media' | 'baixa';

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string;
  source: string;
  status: LeadStatus;
  pipeline_stage: string;
  assigned_to: string | null;
  value: number;
  priority: LeadPriority;
  notes: string | null;
  created_at: string;
  updated_at: string;
  assigned_profile?: Profile;
}

export interface Client {
  id: string;
  lead_id: string | null;
  name: string;
  phone: string;
  email: string;
  tags: string[];
  total_revenue: number;
  notes: string | null;
  created_at: string;
}

export interface Interaction {
  id: string;
  lead_id: string | null;
  client_id: string | null;
  type: string;
  description: string;
  outcome: string | null;
  created_by: string;
  created_at: string;
  creator_profile?: Profile;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  due_date: string;
  priority: LeadPriority;
  status: 'pendente' | 'concluida';
  assigned_to: string;
  lead_id: string | null;
  client_id: string | null;
  created_by: string;
  created_at: string;
}

export interface PipelineStage {
  id: string;
  name: string;
  order: number;
  color: string;
}

export interface LeadSource {
  id: string;
  name: string;
  active: boolean;
}

export interface Settings {
  id: string;
  company_name: string;
  logo_url: string | null;
  webhook_url: string | null;
  api_key: string | null;
}

export const PIPELINE_STAGES: { key: LeadStatus; label: string; color: string }[] = [
  { key: 'novo', label: 'Novo', color: 'hsl(221, 83%, 53%)' },
  { key: 'contactado', label: 'Contactado', color: 'hsl(38, 92%, 50%)' },
  { key: 'negociando', label: 'Negociando', color: 'hsl(280, 67%, 55%)' },
  { key: 'proposta_enviada', label: 'Proposta Enviada', color: 'hsl(200, 80%, 50%)' },
  { key: 'ganho', label: 'Ganho', color: 'hsl(142, 76%, 36%)' },
  { key: 'perdido', label: 'Perdido', color: 'hsl(0, 84%, 60%)' },
];

export const LEAD_SOURCES = ['Instagram', 'Facebook Ads', 'WhatsApp', 'Website', 'Indicação', 'Outro'];

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(date));
}

export function formatDateTime(date: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(date));
}
