import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Trash2, Zap, Webhook, MessageSquare, Phone } from 'lucide-react';
import { useAutomations, useCreateAutomation, useUpdateAutomation, useDeleteAutomation } from '@/hooks/use-automations';
import { useToast } from '@/hooks/use-toast';

const triggerLabels: Record<string, string> = {
  lead_created: 'Novo lead criado',
  pipeline_changed: 'Mudança de etapa no pipeline',
  lead_inactive: 'Lead sem interação',
  lead_converted: 'Conversão para cliente',
};

const actionLabels: Record<string, string> = {
  webhook: 'Webhook (n8n)',
  whatsapp: 'WhatsApp',
  sms: 'SMS',
};

const actionIcons: Record<string, React.ReactNode> = {
  webhook: <Webhook className="h-4 w-4" />,
  whatsapp: <MessageSquare className="h-4 w-4" />,
  sms: <Phone className="h-4 w-4" />,
};

const placeholderHelp = '{{nome}}, {{telefone}}, {{email}}, {{etapa}}, {{origem}}';

export default function AutomationsPage() {
  const { data: automations, isLoading } = useAutomations();
  const createAutomation = useCreateAutomation();
  const updateAutomation = useUpdateAutomation();
  const deleteAutomation = useDeleteAutomation();
  const { toast } = useToast();

  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState('lead_created');
  const [actionType, setActionType] = useState('webhook');
  const [messageTemplate, setMessageTemplate] = useState('');
  const [inactiveDays, setInactiveDays] = useState('3');

  // Config fields
  const [webhookUrl, setWebhookUrl] = useState('');
  const [evolutionUrl, setEvolutionUrl] = useState('');
  const [evolutionApiKey, setEvolutionApiKey] = useState('');
  const [evolutionInstance, setEvolutionInstance] = useState('');
  const [twilioFrom, setTwilioFrom] = useState('');

  const resetForm = () => {
    setName('');
    setTriggerType('lead_created');
    setActionType('webhook');
    setMessageTemplate('');
    setInactiveDays('3');
    setWebhookUrl('');
    setEvolutionUrl('');
    setEvolutionApiKey('');
    setEvolutionInstance('');
    setTwilioFrom('');
  };

  const handleCreate = () => {
    if (!name) {
      toast({ title: 'Informe o nome da automação', variant: 'destructive' });
      return;
    }

    const config: Record<string, string> = {};
    if (actionType === 'webhook') {
      if (!webhookUrl) { toast({ title: 'Informe a URL do webhook', variant: 'destructive' }); return; }
      config.webhook_url = webhookUrl;
    } else if (actionType === 'whatsapp') {
      if (!evolutionUrl || !evolutionApiKey || !evolutionInstance) {
        toast({ title: 'Preencha todos os campos da Evolution API', variant: 'destructive' });
        return;
      }
      config.evolution_url = evolutionUrl;
      config.evolution_api_key = evolutionApiKey;
      config.evolution_instance = evolutionInstance;
    } else if (actionType === 'sms') {
      if (!twilioFrom) { toast({ title: 'Informe o número Twilio (From)', variant: 'destructive' }); return; }
      config.twilio_from = twilioFrom;
    }

    createAutomation.mutate({
      name,
      trigger_type: triggerType,
      action_type: actionType,
      config,
      message_template: messageTemplate || null,
      inactive_days: triggerType === 'lead_inactive' ? parseInt(inactiveDays) || 3 : null,
    }, {
      onSuccess: () => {
        setShowNew(false);
        resetForm();
      },
    });
  };

  const handleToggle = (id: string, active: boolean) => {
    updateAutomation.mutate({ id, active: !active });
  };

  const handleDelete = (id: string, automationName: string) => {
    if (!confirm(`Remover automação "${automationName}"?`)) return;
    deleteAutomation.mutate(id);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Automações</h1>
          <p className="text-muted-foreground text-sm">Configure mensagens automáticas via Webhook, WhatsApp e SMS</p>
        </div>
        <Button onClick={() => setShowNew(true)} className="gap-1">
          <Plus className="h-4 w-4" />
          Nova Automação
        </Button>
      </div>

      {(automations || []).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Zap className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhuma automação criada ainda</p>
            <Button variant="outline" className="mt-4" onClick={() => setShowNew(true)}>Criar primeira automação</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {(automations || []).map((auto) => (
            <Card key={auto.id} className={!auto.active ? 'opacity-50' : ''}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    {actionIcons[auto.action_type]}
                  </div>
                  <div>
                    <p className="font-medium text-sm text-foreground">{auto.name}</p>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">{triggerLabels[auto.trigger_type]}</Badge>
                      <Badge variant="secondary" className="text-xs">{actionLabels[auto.action_type]}</Badge>
                      {auto.trigger_type === 'lead_inactive' && (
                        <Badge variant="secondary" className="text-xs">{auto.inactive_days} dias</Badge>
                      )}
                    </div>
                    {auto.message_template && (
                      <p className="text-xs text-muted-foreground mt-1 max-w-md truncate">{auto.message_template}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={auto.active} onCheckedChange={() => handleToggle(auto.id, auto.active)} />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleDelete(auto.id, auto.name)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Automação</DialogTitle>
            <DialogDescription>Configure quando e como as mensagens serão enviadas</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome da Automação *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Boas-vindas via WhatsApp" />
            </div>

            <div className="space-y-2">
              <Label>Gatilho</Label>
              <Select value={triggerType} onValueChange={setTriggerType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead_created">Novo lead criado</SelectItem>
                  <SelectItem value="pipeline_changed">Mudança de etapa no pipeline</SelectItem>
                  <SelectItem value="lead_inactive">Lead sem interação</SelectItem>
                  <SelectItem value="lead_converted">Conversão para cliente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {triggerType === 'lead_inactive' && (
              <div className="space-y-2">
                <Label>Dias sem interação</Label>
                <Input type="number" value={inactiveDays} onChange={e => setInactiveDays(e.target.value)} min="1" />
              </div>
            )}

            <div className="space-y-2">
              <Label>Canal de Envio</Label>
              <Select value={actionType} onValueChange={setActionType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="webhook">Webhook (n8n)</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp (Evolution API)</SelectItem>
                  <SelectItem value="sms">SMS (Twilio)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {actionType === 'webhook' && (
              <div className="space-y-2">
                <Label>URL do Webhook *</Label>
                <Input value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} placeholder="https://seu-n8n.com/webhook/..." />
              </div>
            )}

            {actionType === 'whatsapp' && (
              <>
                <div className="space-y-2">
                  <Label>URL da Evolution API *</Label>
                  <Input value={evolutionUrl} onChange={e => setEvolutionUrl(e.target.value)} placeholder="https://api.evolution.com" />
                </div>
                <div className="space-y-2">
                  <Label>API Key da Evolution *</Label>
                  <Input value={evolutionApiKey} onChange={e => setEvolutionApiKey(e.target.value)} placeholder="Sua chave de API" />
                </div>
                <div className="space-y-2">
                  <Label>Nome da Instância *</Label>
                  <Input value={evolutionInstance} onChange={e => setEvolutionInstance(e.target.value)} placeholder="bigodao77" />
                </div>
              </>
            )}

            {actionType === 'sms' && (
              <div className="space-y-2">
                <Label>Número Twilio (From) *</Label>
                <Input value={twilioFrom} onChange={e => setTwilioFrom(e.target.value)} placeholder="+5511999999999" />
                <p className="text-xs text-muted-foreground">Conecte o Twilio nas configurações do projeto para usar SMS</p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Modelo de Mensagem</Label>
              <Textarea
                value={messageTemplate}
                onChange={e => setMessageTemplate(e.target.value)}
                placeholder="Olá {{nome}}, recebemos seu contato!"
                rows={3}
              />
              <p className="text-xs text-muted-foreground">Variáveis: {placeholderHelp}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowNew(false); resetForm(); }}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createAutomation.isPending}>
              {createAutomation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar Automação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
