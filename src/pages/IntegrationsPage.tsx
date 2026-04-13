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
      evolution_url: 'https://api.flashcrms.com.br',
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
  const [currentStep, setCurrentStep] = useState(0);

  const webhookBaseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/facebook-webhook`;

  const handleCreate = () => {
    if (!pageName) { toast({ title: 'Informe o nome da página', variant: 'destructive' }); return; }
    createWebhook.mutate(pageName);
    setPageName('');
    setCurrentStep(1);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copiado!` });
  };

  if (isLoading) return <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />;

  const hasWebhooks = (webhooks || []).length > 0;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Facebook className="h-5 w-5 text-blue-600" />
          Facebook Lead Ads
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Capture leads automaticamente dos formulários do Facebook e receba direto no CRM
        </p>
      </div>

      {/* Step-by-step guide */}
      <Card className="border-blue-200 bg-blue-50/30 dark:bg-blue-950/10 dark:border-blue-900">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold">?</span>
            Guia Passo a Passo
          </CardTitle>
          <CardDescription className="text-xs">Siga estes passos para conectar sua página do Facebook</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {/* Step 1 */}
          <div className={`flex gap-3 p-3 rounded-lg transition-colors ${currentStep === 0 ? 'bg-blue-100/50 dark:bg-blue-900/20 ring-1 ring-blue-300' : 'bg-background/50'}`}>
            <span className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0 ${hasWebhooks ? 'bg-green-500 text-white' : 'bg-blue-600 text-white'}`}>
              {hasWebhooks ? '✓' : '1'}
            </span>
            <div className="space-y-2 flex-1">
              <p className="font-medium">Crie um webhook para sua página</p>
              <p className="text-muted-foreground text-xs">Digite o nome da sua página do Facebook abaixo e clique em "Criar Webhook". Isso gera uma URL e um token únicos.</p>
              {!hasWebhooks && (
                <div className="flex gap-2 mt-2">
                  <Input value={pageName} onChange={e => setPageName(e.target.value)} placeholder="Ex: Minha Empresa" className="flex-1 h-9 text-sm" />
                  <Button onClick={handleCreate} disabled={createWebhook.isPending} size="sm" className="gap-1 shrink-0">
                    {createWebhook.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                    Criar Webhook
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Step 2 */}
          <div className={`flex gap-3 p-3 rounded-lg transition-colors ${currentStep === 1 ? 'bg-blue-100/50 dark:bg-blue-900/20 ring-1 ring-blue-300' : 'bg-background/50'}`}>
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-muted text-muted-foreground text-xs font-bold shrink-0">2</span>
            <div>
              <p className="font-medium">Acesse o Facebook Business Manager</p>
              <p className="text-muted-foreground text-xs mt-1">
                Vá em{' '}
                <a href="https://business.facebook.com/settings/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">
                  business.facebook.com/settings
                </a>
                {' '}→ Selecione sua conta → No menu lateral, clique em <strong>"Webhooks"</strong>
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className={`flex gap-3 p-3 rounded-lg transition-colors ${currentStep === 2 ? 'bg-blue-100/50 dark:bg-blue-900/20 ring-1 ring-blue-300' : 'bg-background/50'}`}>
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-muted text-muted-foreground text-xs font-bold shrink-0">3</span>
            <div>
              <p className="font-medium">Configure o Webhook no Facebook</p>
              <p className="text-muted-foreground text-xs mt-1">
                Clique em <strong>"Adicionar assinatura"</strong> ou <strong>"Editar"</strong>. Cole a <strong>URL de Callback</strong> e o <strong>Token de Verificação</strong> que aparecem abaixo nos campos correspondentes.
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div className={`flex gap-3 p-3 rounded-lg transition-colors ${currentStep === 3 ? 'bg-blue-100/50 dark:bg-blue-900/20 ring-1 ring-blue-300' : 'bg-background/50'}`}>
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-muted text-muted-foreground text-xs font-bold shrink-0">4</span>
            <div>
              <p className="font-medium">Inscreva-se no campo "leadgen"</p>
              <p className="text-muted-foreground text-xs mt-1">
                Após verificar o webhook, marque a caixa <strong>"leadgen"</strong> na lista de campos. Isso ativa o envio automático de leads para seu CRM.
              </p>
            </div>
          </div>

          {/* Step 5 */}
          <div className="flex gap-3 p-3 rounded-lg bg-background/50">
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-muted text-muted-foreground text-xs font-bold shrink-0">5</span>
            <div>
              <p className="font-medium">Pronto! 🎉</p>
              <p className="text-muted-foreground text-xs mt-1">
                Novos leads do Facebook aparecerão automaticamente na aba <strong>Leads</strong> com a origem "Facebook".
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add new webhook if already has some */}
      {hasWebhooks && (
        <div className="flex gap-2">
          <Input value={pageName} onChange={e => setPageName(e.target.value)} placeholder="Nome da página (ex: Minha Empresa)" className="flex-1" />
          <Button onClick={handleCreate} disabled={createWebhook.isPending} className="gap-1 shrink-0">
            {createWebhook.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Adicionar Página
          </Button>
        </div>
      )}

      {/* Webhook cards */}
      {(webhooks || []).map((wh) => (
        <Card key={wh.id} className="border-green-200 dark:border-green-900">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <Facebook className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <span className="font-medium text-sm">{wh.page_name || 'Página sem nome'}</span>
                  <p className="text-xs text-muted-foreground">Webhook configurado</p>
                </div>
                <Badge variant={wh.active ? 'default' : 'secondary'} className="text-xs">
                  {wh.active ? <><CheckCircle2 className="h-3 w-3 mr-1" />Ativo</> : <><XCircle className="h-3 w-3 mr-1" />Inativo</>}
                </Badge>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (confirm('Remover webhook?')) deleteWebhook.mutate(wh.id); }}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  📋 URL de Callback
                  <span className="text-[10px] text-blue-600">(cole no Facebook)</span>
                </Label>
                <div className="flex gap-1">
                  <Input value={webhookBaseUrl} readOnly className="text-xs font-mono bg-muted/50" />
                  <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => copyToClipboard(webhookBaseUrl, 'URL de Callback')}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  🔑 Token de Verificação
                  <span className="text-[10px] text-blue-600">(cole no Facebook)</span>
                </Label>
                <div className="flex gap-1">
                  <Input value={wh.verify_token} readOnly className="text-xs font-mono bg-muted/50" />
                  <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => copyToClipboard(wh.verify_token, 'Token de Verificação')}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Empty state */}
      {!hasWebhooks && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-8 text-center">
            <Facebook className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-sm">Nenhum webhook criado ainda</p>
            <p className="text-muted-foreground text-xs mt-1">Crie um webhook acima para começar a receber leads do Facebook</p>
          </CardContent>
        </Card>
      )}
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
