import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface UserLabel {
  id: string;
  user_id: string;
  tenant_id: string | null;
  name: string;
  color: string;
  created_at: string;
}

export interface LabelAssignment {
  id: string;
  label_id: string;
  chat_id: string | null;
  lead_id: string | null;
  user_id: string;
  tenant_id: string | null;
  created_at: string;
}

export function useLabels() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['user-labels', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_labels')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as UserLabel[];
    },
    enabled: !!user,
  });
}

export function useCreateLabel() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      const { data, error } = await supabase
        .from('user_labels')
        .insert({ name, color, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user-labels'] }),
  });
}

export function useUpdateLabel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name, color }: { id: string; name?: string; color?: string }) => {
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (color !== undefined) updates.color = color;
      const { error } = await supabase.from('user_labels').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user-labels'] }),
  });
}

export function useDeleteLabel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('user_labels').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-labels'] });
      qc.invalidateQueries({ queryKey: ['label-assignments'] });
    },
  });
}

export function useLabelAssignments(type: 'chat' | 'lead') {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['label-assignments', type, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('label_assignments')
        .select('*')
        .not(type === 'chat' ? 'chat_id' : 'lead_id', 'is', null);
      if (error) throw error;
      return data as LabelAssignment[];
    },
    enabled: !!user,
  });
}

export function useAssignLabel() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ labelId, chatId, leadId }: { labelId: string; chatId?: string; leadId?: string }) => {
      // A sincronização com o "outro lado" (conversa ⇄ lead da mesma pessoa)
      // agora é feita direto no banco (gatilho), de forma confiável.
      const { error } = await supabase.from('label_assignments').insert({
        label_id: labelId,
        chat_id: chatId || null,
        lead_id: leadId || null,
        user_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['label-assignments'] }),
  });
}

export function useUnassignLabel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ labelId, chatId, leadId }: { labelId: string; chatId?: string; leadId?: string }) => {
      let query = supabase.from('label_assignments').delete().eq('label_id', labelId);
      if (chatId) query = query.eq('chat_id', chatId);
      if (leadId) query = query.eq('lead_id', leadId);
      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['label-assignments'] }),
  });
}