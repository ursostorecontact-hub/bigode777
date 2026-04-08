import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// ── WhatsApp Assignments ──

export function useWhatsAppAssignments(instanceId?: string) {
  return useQuery({
    queryKey: ['whatsapp_assignments', instanceId],
    queryFn: async () => {
      let query = supabase
        .from('whatsapp_assignments')
        .select('*')
        .order('created_at', { ascending: true });
      if (instanceId) query = query.eq('whatsapp_instance_id', instanceId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useSaveWhatsAppAssignments() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      instanceId,
      assignments,
    }: {
      instanceId: string;
      assignments: { user_id: string; percentage: number }[];
    }) => {
      // Delete existing assignments for this instance
      const { error: delErr } = await supabase
        .from('whatsapp_assignments')
        .delete()
        .eq('whatsapp_instance_id', instanceId);
      if (delErr) throw delErr;

      if (assignments.length > 0) {
        const rows = assignments.map((a) => ({
          whatsapp_instance_id: instanceId,
          user_id: a.user_id,
          percentage: a.percentage,
        }));
        const { error: insErr } = await supabase
          .from('whatsapp_assignments')
          .insert(rows);
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp_assignments'] });
      toast({ title: 'Atribuições salvas!' });
    },
    onError: (err: any) => {
      toast({ title: 'Erro ao salvar atribuições', description: err.message, variant: 'destructive' });
    },
  });
}

export function useWhatsAppInstances() {
  return useQuery({
    queryKey: ['whatsapp_instances'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useFacebookWebhooks() {
  return useQuery({
    queryKey: ['facebook_webhooks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('facebook_webhooks')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateWhatsAppInstance() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: {
      name: string;
      evolution_url: string;
      evolution_api_key: string;
      instance_name: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-qrcode`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ action: 'create', ...params }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao criar instância');
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp_instances'] });
      toast({ title: 'Instância criada! Escaneie o QR Code.' });
    },
    onError: (err: any) => {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    },
  });
}

export function useWhatsAppAction() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: { action: string; instance_id: string; phone?: string; message?: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-qrcode`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify(params),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro');
      return json;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp_instances'] });
      if (vars.action === 'delete') toast({ title: 'Instância removida' });
    },
    onError: (err: any) => {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    },
  });
}

export function useCreateFacebookWebhook() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (pageName: string) => {
      const { data, error } = await supabase
        .from('facebook_webhooks')
        .insert({ page_name: pageName })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facebook_webhooks'] });
      toast({ title: 'Webhook do Facebook criado' });
    },
    onError: (err: any) => {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    },
  });
}

export function useDeleteFacebookWebhook() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('facebook_webhooks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facebook_webhooks'] });
      toast({ title: 'Webhook removido' });
    },
    onError: (err: any) => {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    },
  });
}
