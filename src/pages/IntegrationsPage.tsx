import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Plus, Trash2, MessageSquare, Facebook, QrCode, RefreshCw, Copy, CheckCircle2, XCircle } from 'lucide-react';
import { useWhatsAppInstances, useFacebookWebhooks, useCreateWhatsAppInstance, useWhatsAppAction, useCreateFacebookWebhook, useDeleteFacebookWebhook } from '@/hooks/use-integrations';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

function WhatsAppSection() {
  const { data: instances, isLoading } = useWhatsAppInstances();
  const createInstance = useCreateWhatsAppInstance();
  const whatsappAction = useWhatsAppAction();
  const { toast } = useToast();

  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState('');
  const [instanceName, setInstanceName] = useState('');
  const [qrData, setQrData] = useState<{ id: string; qr: string } | null>(null);

  const normalizeQrSrc = (value?: string | null) => {
    if (!value) return null;
    return value.startsWith('data:') ? value : `data:image/png;base64,${value}`;
  };

  const handleCreate = async () => {
    if (!name || !instanceName) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }
    const result = await createInstance.mutateAsync({
      name,
      evolution_url: 'http://76.13.230.7:64644',
      evolution_api_key: 'bigodao77chave',
      instance_name: instanceName,
    });

    const qrSrc = normalizeQrSrc(result.qrcode?.base64);
    if (qrSrc) {
      setQrData({ id: result.instance.id, qr: qrSrc });
    }

    setShowNew(false);
    setName('');
    setInstanceName('');
  };

  const handleGetQR = async (id: string) => {
    const result = await whatsappAction.mutateAsync({ action: 'qrcode', instance_id: id });
    const qrSrc = normalizeQrSrc(result.qrcode?.base64);

    if (qrSrc) {
      setQrData({ id, qr: qrSrc });
    } else {
      toast({ title: 'QR Code não disponível. Verifique o status da instância.' });
    }
  };

  const handleCheckStatus = async (id: string) => {
    const result = await whatsappAction.mutateAsync({ action: 'status', instance_id: id });
    toast({ title: `Status: ${result.status === 'connected' ? 'Conectado ✅' : 'Desconectado ❌'}` });
  };

  const handleDelete = async (id: string, instanceName: string) => {
    if (!confirm(`Remover instância "${instanceName}"?`)) return;
    await whatsappAction.mutateAsync({ action: 'delete', instance_id: id });
    if (qrData?.id === id) setQrData(null);
  };

  if (isLoading) return <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">WhatsApp</h2>
          <p className="text-sm text-muted-foreground">Conecte números via QR Code (Evolution API)</p>
        </div>
        <Button onClick={() => setShowNew(true)} size="sm" className="gap-1">
          <Plus className="h-4 w-4" /> Adicionar Número
        </Button>
      </div>

      {qrData && (
        <Card className="border-primary">
          <CardContent className="flex flex-col items-center py-6">
            <QrCode className="h-6 w-6 text-primary mb-2" />
            <p className="text-sm font-medium mb-3">Escaneie o QR Code com seu WhatsApp</p>
            <img src={qrData.qr} alt="QR Code" className="w-64 h-64 rounded-lg border" />
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setQrData(null)}>Fechar</Button>
          </CardContent>
        </Card>
      )}

      {(instances || []).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-8">
            <MessageSquare className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-sm">Nenhum número conectado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {(instances || []).map((inst) => (
            <Card key={inst.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <MessageSquare className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{inst.name}</p>
                    <p className="text-xs text-muted-foreground">{inst.instance_name}</p>
                  </div>
                  <Badge variant={inst.status === 'connected' ? 'default' : 'secondary'} className="text-xs">
                    {inst.status === 'connected' ? <><CheckCircle2 className="h-3 w-3 mr-1" />Conectado</> : <><XCircle className="h-3 w-3 mr-1" />Desconectado</>}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleGetQR(inst.id)} title="QR Code">
                    <QrCode className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCheckStatus(inst.id)} title="Verificar status">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(inst.id, inst.name)} title="Remover">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conectar WhatsApp</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Nome (identificação) *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: WhatsApp Comercial" />
            </div>
            <div className="space-y-1">
              <Label>Nome da Instância *</Label>
              <Input value={instanceName} onChange={e => setInstanceName(e.target.value)} placeholder="meu-whatsapp-01" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createInstance.isPending}>
              {createInstance.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar e Gerar QR Code
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FacebookSection() {
  const { data: webhooks, isLoading } = useFacebookWebhooks();
  const createWebhook = useCreateFacebookWebhook();
  const deleteWebhook = useDeleteFacebookWebhook();
  const { toast } = useToast();
  const [pageName, setPageName] = useState('');

  const webhookBaseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/facebook-webhook`;

  const handleCreate = () => {
    if (!pageName) { toast({ title: 'Informe o nome da página', variant: 'destructive' }); return; }
    createWebhook.mutate(pageName);
    setPageName('');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copiado!' });
  };

  if (isLoading) return <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Facebook Lead Ads</h2>
        <p className="text-sm text-muted-foreground">Receba leads do Facebook automaticamente via webhook gratuito</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Como configurar</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>1. Crie um webhook abaixo para sua página do Facebook</p>
          <p>2. No <strong>Facebook Business Manager</strong>, vá em Configurações → Webhooks</p>
          <p>3. Cole a <strong>URL de Callback</strong> e o <strong>Token de Verificação</strong></p>
          <p>4. Inscreva-se no campo <strong>leadgen</strong></p>
          <p>5. Os leads aparecerão automaticamente no CRM com origem "Facebook"</p>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Input value={pageName} onChange={e => setPageName(e.target.value)} placeholder="Nome da página (ex: Minha Empresa)" className="flex-1" />
        <Button onClick={handleCreate} disabled={createWebhook.isPending} className="gap-1">
          <Plus className="h-4 w-4" /> Criar Webhook
        </Button>
      </div>

      {(webhooks || []).map((wh) => (
        <Card key={wh.id}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Facebook className="h-5 w-5 text-primary" />
                <span className="font-medium text-sm">{wh.page_name || 'Página sem nome'}</span>
                <Badge variant={wh.active ? 'default' : 'secondary'} className="text-xs">
                  {wh.active ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (confirm('Remover webhook?')) deleteWebhook.mutate(wh.id); }}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2">
              <div>
                <Label className="text-xs text-muted-foreground">URL de Callback</Label>
                <div className="flex gap-1">
                  <Input value={webhookBaseUrl} readOnly className="text-xs font-mono" />
                  <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => copyToClipboard(webhookBaseUrl)}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Token de Verificação</Label>
                <div className="flex gap-1">
                  <Input value={wh.verify_token} readOnly className="text-xs font-mono" />
                  <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => copyToClipboard(wh.verify_token)}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function IntegrationsPage() {
  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Integrações</h1>
        <p className="text-muted-foreground text-sm">Conecte seus canais de comunicação e captação de leads</p>
      </div>

      <Tabs defaultValue="whatsapp">
        <TabsList>
          <TabsTrigger value="whatsapp" className="gap-1"><MessageSquare className="h-4 w-4" />WhatsApp</TabsTrigger>
          <TabsTrigger value="facebook" className="gap-1"><Facebook className="h-4 w-4" />Facebook</TabsTrigger>
        </TabsList>
        <TabsContent value="whatsapp" className="mt-4">
          <WhatsAppSection />
        </TabsContent>
        <TabsContent value="facebook" className="mt-4">
          <FacebookSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
