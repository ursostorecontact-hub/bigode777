import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/types';

type Automation = Tables<'automations'>;

export function useAutomations() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['automations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('automations')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Automation[];
    },
    enabled: !!user,
  });
}

export function useCreateAutomation() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (automation: {
      name: string;
      trigger_type: string;
      action_type: string;
      config: Record<string, string>;
      message_template: string | null;
      inactive_days: number | null;
    }) => {
      const { data, error } = await supabase
        .from('automations')
        .insert(automation)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['automations'] });
      toast({ title: 'Automação criada com sucesso!' });
    },
    onError: () => {
      toast({ title: 'Erro ao criar automação', variant: 'destructive' });
    },
  });
}

export function useUpdateAutomation() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: any }) => {
      const { error } = await supabase
        .from('automations')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['automations'] });
    },
    onError: () => {
      toast({ title: 'Erro ao atualizar automação', variant: 'destructive' });
    },
  });
}

export function useDeleteAutomation() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('automations')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['automations'] });
      toast({ title: 'Automação removida!' });
    },
    onError: () => {
      toast({ title: 'Erro ao remover automação', variant: 'destructive' });
    },
  });
}

export async function triggerAutomation(
  triggerType: string,
  leadData: Record<string, any>,
  extraData?: Record<string, any>
) {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return;

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    await fetch(`${supabaseUrl}/functions/v1/run-automation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        trigger_type: triggerType,
        lead: leadData,
        extra: extraData || {},
      }),
    });
  } catch (err) {
    console.error('Erro ao disparar automação:', err);
  }
}
