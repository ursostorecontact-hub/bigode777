import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { TablesUpdate } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import type { LeadStatus } from '@/types/crm';
import { useToast } from '@/hooks/use-toast';
import { triggerAutomation } from '@/hooks/use-automations';

type LeadUpdatePayload = { id: string } & TablesUpdate<'leads'>;
type TaskUpdatePayload = { id: string } & TablesUpdate<'tasks'>;
type SettingsUpdatePayload = { id: string } & TablesUpdate<'settings'>;

// Fila de leads não atribuídos, visível pra todos os vendedores. Atualiza sozinha
// a cada 5s, pra a "pesca" parecer ao vivo (ver lead sumir quando outro pega).
export function useLeadQueue() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['lead-queue'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .is('assigned_to', null)
        .not('status', 'in', '(ganho,perdido)')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    refetchInterval: 5000,
  });
}

// "Pescar" um lead: só funciona se ninguém tiver pego ainda (checa e trava no
// próprio banco, então dois vendedores clicando ao mesmo tempo nunca pegam o mesmo lead).
export function useClaimLead() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (leadId: string) => {
      const { data, error } = await supabase
        .from('leads')
        .update({ assigned_to: user!.id, status: 'contactado', pipeline_stage: 'contactado' })
        .eq('id', leadId)
        .is('assigned_to', null) // só atualiza se ainda estiver livre
        .select();
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('ALREADY_CLAIMED');
      }
      const claimedLead = data[0];

      // A conversa do WhatsApp desse contato só fica visível pra quem pescou o
      // lead (sem isso, o vendedor pescava o lead mas não conseguia ver/responder
      // a conversa, já que ela tem sua própria trava de atribuição).
      if (claimedLead.phone) {
        const cleanPhone = claimedLead.phone.replace(/\D/g, '');
        await supabase
          .from('whatsapp_chats')
          .update({ assigned_to: user!.id })
          .ilike('contact_phone', `%${cleanPhone.slice(-8)}%`)
          .is('assigned_to', null);
      }

      return claimedLead;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead-queue'] });
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['whatsapp-chats'] });
      toast({ title: '🎣 Lead pescado com sucesso!', description: 'Ele já está atribuído a você, e a conversa de WhatsApp também.' });
    },
    onError: (err: any) => {
      if (err.message === 'ALREADY_CLAIMED') {
        toast({ title: 'Que pena!', description: 'Outro vendedor já pegou esse lead primeiro.', variant: 'destructive' });
      } else {
        toast({ title: 'Erro ao pescar lead', description: err.message, variant: 'destructive' });
      }
      qc.invalidateQueries({ queryKey: ['lead-queue'] });
    },
  });
}

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

export function useSaveDistributionPercentages() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (percentages: Record<string, number>) => {
      const results = await Promise.all(
        Object.entries(percentages).map(([userId, pct]) =>
          supabase.from('profiles').update({ distribution_percentage: pct }).eq('id', userId)
        )
      );
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profiles'] });
      toast({ title: 'Distribuição automática ativada!', description: 'A partir de agora, novos leads já chegam direto pro vendedor certo.' });
    },
    onError: (err: any) => {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    },
  });
}

export function useUpdateMaxLeads() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ userId, maxLeads }: { userId: string; maxLeads: number }) => {
      const { error } = await supabase.from('profiles').update({ max_active_leads: maxLeads }).eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profiles'] });
      toast({ title: 'Limite atualizado!' });
    },
    onError: (err: any) => {
      toast({ title: 'Erro ao atualizar limite', description: err.message, variant: 'destructive' });
    },
  });
}

export function useUpdateUserRole() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { error } = await supabase.from('user_roles').update({ role }).eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profiles-with-roles'] });
      toast({ title: 'Cargo atualizado com sucesso!' });
    },
    onError: (err: any) => {
      toast({ title: 'Erro ao atualizar cargo', description: err.message, variant: 'destructive' });
    },
  });
}

export function useMarkLeadAsPurchased() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ lead, value, notes }: { lead: any; value: number; notes?: string }) => {
      // 1) Cria o registro de cliente (comprador), copiando a origem do lead
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .insert({
          lead_id: lead.id,
          name: lead.name,
          phone: lead.phone || null,
          email: lead.email || null,
          source: lead.source || null,
          total_revenue: value,
          notes: notes || null,
        })
        .select()
        .single();
      if (clientError) throw clientError;

      // 2) Marca o lead como ganho e atualiza o valor para o valor real da compra
      //    (é esse campo que o Dashboard soma para calcular a Receita Mensal)
      await supabase.from('leads').update({ status: 'ganho', pipeline_stage: 'ganho', value }).eq('id', lead.id);

      // 3) Dispara a automação de conversão (se houver alguma configurada)
      triggerAutomation('lead_converted', { ...lead, status: 'ganho' });

      // 4) Envia automaticamente esse comprador para o Facebook Conversions API,
      // se as credenciais estiverem configuradas — sem travar a tela esperando.
      (async () => {
        try {
          const { data: settings } = await supabase.from('settings').select('facebook_pixel_id, facebook_access_token').maybeSingle();
          const pixelId = (settings as any)?.facebook_pixel_id;
          const accessToken = (settings as any)?.facebook_access_token;
          if (pixelId && accessToken) {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData.session?.access_token;
            await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/facebook-capi`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ pixel_id: pixelId, access_token: accessToken, client_id: client.id }),
            });
          }
        } catch (err) {
          console.error('Erro ao enviar comprador ao Facebook automaticamente:', err);
        }
      })();

      // 5) Se o lead veio de um anúncio da Meta, avisa que ele chegou ao estágio "ganho"
      // (Integração de leads qualificados / CRM Lead Status).
      (async () => {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData.session?.access_token;
          await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/facebook-lead-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ lead_id: lead.id, event_name: 'ganho' }),
          });
        } catch (err) {
          console.error('Erro ao avisar a Meta sobre a compra:', err);
        }
      })();
      triggerLeadScoring(lead.id);

      return client;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['clients'] });
      toast({ title: 'Compra registrada!', description: 'Cliente criado e enviado ao Facebook automaticamente (se configurado).' });
    },
    onError: (err: any) => {
      toast({ title: 'Erro ao registrar compra', description: err.message, variant: 'destructive' });
    },
  });
}

export function useMetaEventsLog() {
  return useQuery({
    queryKey: ['meta-events-log'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meta_events_log')
        .select('*, leads(name), clients(name)')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });
}

export function useRetryMetaEvent() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ logId, eventSource, pixelId, accessToken }: { logId: string; eventSource: string; pixelId: string; accessToken: string }) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const fn = eventSource === 'purchase' ? 'facebook-capi' : 'facebook-lead-status';
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fn}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ retry_log_id: logId, pixel_id: pixelId, access_token: accessToken }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['meta-events-log'] });
      toast({ title: data.ok ? 'Evento reenviado com sucesso!' : 'Falhou de novo', description: data.error, variant: data.ok ? undefined : 'destructive' });
    },
    onError: (err: any) => {
      toast({ title: 'Erro ao reenviar', description: err.message, variant: 'destructive' });
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

// Dispara a análise de IA do lead (pontuação de interesse + aviso à Meta se
// estiver quente). Roda em segundo plano, sem travar a tela.
async function triggerLeadScoring(leadId: string) {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-lead-scoring`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ lead_id: leadId }),
    });
  } catch (err) {
    console.error('Erro ao analisar lead com IA:', err);
  }
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
      if (data?.id) triggerLeadScoring(data.id);
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
    mutationFn: async ({ id, ...updates }: LeadUpdatePayload) => {
      const leadUpdates: TablesUpdate<'leads'> = updates;
      const { error } = await supabase.from('leads').update(leadUpdates).eq('id', id);
      if (error) throw error;
      return { id, ...leadUpdates } as LeadUpdatePayload;
    },
    onSuccess: (data: LeadUpdatePayload) => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      // Trigger pipeline change automation
      if (data && data.pipeline_stage) {
        triggerAutomation('pipeline_changed', data, { new_stage: data.pipeline_stage });
      }
      // Avisa a Meta sobre a mudança de estágio deste lead, se ele tiver vindo
      // de um anúncio dela (só dispara quando há mudança de etapa/status).
      const newStage = data?.pipeline_stage || data?.status;
      if (data?.id && newStage) {
        (async () => {
          try {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData.session?.access_token;
            await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/facebook-lead-status`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ lead_id: data.id, event_name: newStage }),
            });
          } catch (err) {
            console.error('Erro ao avisar a Meta sobre mudança de estágio:', err);
          }
        })();
      }
      // Reanalisa o lead com IA a cada edição (não só mudança de etapa/status),
      // já que qualquer campo (observações, valor, etc) pode mudar o quão "quente" ele está.
      if (data?.id) triggerLeadScoring(data.id);
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
    mutationFn: async ({ id, ...updates }: TaskUpdatePayload) => {
      const taskUpdates: TablesUpdate<'tasks'> = updates;
      const { error } = await supabase.from('tasks').update(taskUpdates).eq('id', id);
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

export function useCreateInteraction() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (interaction: {
      type: string;
      description: string;
      outcome?: string;
      created_by: string;
      lead_id?: string;
      client_id?: string;
    }) => {
      const { data, error } = await supabase.from('interactions').insert(interaction).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['interactions', variables.lead_id, variables.client_id] });
      toast({ title: 'Interação registrada!' });
    },
    onError: () => {
      toast({ title: 'Erro ao registrar interação', variant: 'destructive' });
    },
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
      const { data, error } = await supabase.from('settings').select('*').limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SettingsUpdatePayload> & { id?: string }) => {
      const settingsUpdates: TablesUpdate<'settings'> = updates;
      if (id) {
        // Row exists – update it
        const { error } = await supabase.from('settings').update(settingsUpdates).eq('id', id);
        if (error) throw error;
      } else {
        // No settings row yet – insert one (tenant_id filled by DB DEFAULT)
        const { error } = await supabase.from('settings').insert(settingsUpdates as never);
        if (error) throw error;
      }
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
