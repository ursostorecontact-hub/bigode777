import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { LeadStatus } from '@/types/crm';
import { useToast } from '@/hooks/use-toast';
import { triggerAutomation } from '@/hooks/use-automations';

export function useLeads() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useProfiles() {
  return useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('active', true);
      if (error) throw error;
      return data;
    },
  });
}

export function useProfilesWithRoles() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['profiles-with-roles'],
    queryFn: async () => {
      const [profilesRes, rolesRes] = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase.from('user_roles').select('*'),
      ]);
      if (profilesRes.error) throw profilesRes.error;
      if (rolesRes.error) throw rolesRes.error;
      return (profilesRes.data || []).map(p => ({
        ...p,
        role: rolesRes.data?.find(r => r.user_id === p.id)?.role || 'salesperson',
      }));
    },
    enabled: !!user,
  });
}

export function useCreateLead() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (lead: {
      name: string;
      phone?: string;
      email?: string;
      source?: string;
      value?: number;
      notes?: string;
      assigned_to?: string | null;
      priority?: string;
    }) => {
      const { data, error } = await supabase.from('leads').insert(lead).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      toast({ title: 'Lead criado com sucesso!' });
      // Trigger automation
      if (data) triggerAutomation('lead_created', data);
    },
    onError: () => {
      toast({ title: 'Erro ao criar lead', variant: 'destructive' });
    },
  });
}

export function useUpdateLead() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: any }) => {
      const { error } = await supabase.from('leads').update(updates).eq('id', id);
      if (error) throw error;
      return { id, ...updates };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      // Trigger pipeline change automation
      if (data && data.pipeline_stage) {
        triggerAutomation('pipeline_changed', data, { new_stage: data.pipeline_stage });
      }
    },
    onError: () => {
      toast({ title: 'Erro ao atualizar lead', variant: 'destructive' });
    },
  });
}

export function useDeleteLead() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('leads').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      toast({ title: 'Lead excluído com sucesso!' });
    },
    onError: () => {
      toast({ title: 'Erro ao excluir lead', variant: 'destructive' });
    },
  });
}

export function useClients() {
  return useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useTasks() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tasks').select('*').order('due_date', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (task: {
      title: string;
      description?: string;
      due_date: string;
      priority?: string;
      assigned_to: string;
      created_by: string;
      lead_id?: string;
      client_id?: string;
    }) => {
      const { data, error } = await supabase.from('tasks').insert(task).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      toast({ title: 'Tarefa criada com sucesso!' });
    },
    onError: () => {
      toast({ title: 'Erro ao criar tarefa', variant: 'destructive' });
    },
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: any }) => {
      const { error } = await supabase.from('tasks').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useInteractions(leadId?: string, clientId?: string) {
  return useQuery({
    queryKey: ['interactions', leadId, clientId],
    queryFn: async () => {
      let query = supabase.from('interactions').select('*').order('created_at', { ascending: false });
      if (leadId) query = query.eq('lead_id', leadId);
      if (clientId) query = query.eq('client_id', clientId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!(leadId || clientId),
  });
}

export function usePipelineStages() {
  return useQuery({
    queryKey: ['pipeline-stages'],
    queryFn: async () => {
      const { data, error } = await supabase.from('pipeline_stages').select('*').order('order');
      if (error) throw error;
      return data;
    },
  });
}

export function useLeadSources() {
  return useQuery({
    queryKey: ['lead-sources'],
    queryFn: async () => {
      const { data, error } = await supabase.from('lead_sources').select('*').eq('active', true);
      if (error) throw error;
      return data;
    },
  });
}

export function useSettings() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('settings').select('*').limit(1).single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: any }) => {
      const { error } = await supabase.from('settings').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      toast({ title: 'Configurações salvas!' });
    },
    onError: () => {
      toast({ title: 'Erro ao salvar configurações', variant: 'destructive' });
    },
  });
}
