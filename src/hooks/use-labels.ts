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
      const { error } = await supabase.from('label_assignments').insert({
        label_id: labelId,
        chat_id: chatId || null,
        lead_id: leadId || null,
        user_id: user!.id,
      });
      if (error) throw error;

      // Espelha a etiqueta pro "outro lado" (conversa ⇄ lead), já que são a
      // mesma pessoa na prática — sem isso, etiquetar em Conversas não refletia
      // em Leads (e vice-versa).
      try {
        if (chatId) {
          const { data: chat } = await supabase.from('whatsapp_chats').select('contact_phone').eq('id', chatId).maybeSingle();
          const cleanPhone = chat?.contact_phone?.replace(/\D/g, '');
          if (cleanPhone) {
            const { data: matchingLeads } = await supabase.from('leads').select('id').ilike('phone', `%${cleanPhone.slice(-8)}%`);
            for (const lead of matchingLeads || []) {
              await supabase.from('label_assignments').insert({ label_id: labelId, lead_id: lead.id, user_id: user!.id }).select();
            }
          }
        } else if (leadId) {
          const { data: lead } = await supabase.from('leads').select('phone').eq('id', leadId).maybeSingle();
          const cleanPhone = lead?.phone?.replace(/\D/g, '');
          if (cleanPhone) {
            const { data: matchingChats } = await supabase.from('whatsapp_chats').select('id').ilike('contact_phone', `%${cleanPhone.slice(-8)}%`);
            for (const chat of matchingChats || []) {
              await supabase.from('label_assignments').insert({ label_id: labelId, chat_id: chat.id, user_id: user!.id }).select();
            }
          }
        }
      } catch {
        // Se já existir do outro lado (ou não encontrar par), tudo bem — não é
        // um erro que precise travar a ação principal, que já foi concluída.
      }
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

      // Remove também do "outro lado" (conversa ⇄ lead), pra ficar sincronizado.
      try {
        if (chatId) {
          const { data: chat } = await supabase.from('whatsapp_chats').select('contact_phone').eq('id', chatId).maybeSingle();
          const cleanPhone = chat?.contact_phone?.replace(/\D/g, '');
          if (cleanPhone) {
            const { data: matchingLeads } = await supabase.from('leads').select('id').ilike('phone', `%${cleanPhone.slice(-8)}%`);
            for (const lead of matchingLeads || []) {
              await supabase.from('label_assignments').delete().eq('label_id', labelId).eq('lead_id', lead.id);
            }
          }
        } else if (leadId) {
          const { data: lead } = await supabase.from('leads').select('phone').eq('id', leadId).maybeSingle();
          const cleanPhone = lead?.phone?.replace(/\D/g, '');
          if (cleanPhone) {
            const { data: matchingChats } = await supabase.from('whatsapp_chats').select('id').ilike('contact_phone', `%${cleanPhone.slice(-8)}%`);
            for (const chat of matchingChats || []) {
              await supabase.from('label_assignments').delete().eq('label_id', labelId).eq('chat_id', chat.id);
            }
          }
        }
      } catch {
        /* mesma lógica: não trava a ação principal, que já foi concluída */
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['label-assignments'] }),
  });
}