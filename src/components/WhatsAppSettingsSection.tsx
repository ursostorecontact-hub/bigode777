import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  QrCode, Smartphone, Loader2, CheckCircle2, XCircle,
  Wifi, WifiOff, Phone, Trash2, MessageSquare, RefreshCw, Zap,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useWhatsAppInstances } from '@/hooks/use-integrations';
import { useTenant } from '@/contexts/TenantContext';
import { useToast } from '@/hooks/use-toast';

const EVOLUTION_URL = 'https://api.flashcrms.com.br';
const EVOLUTION_API_KEY = 'bigodao77chave';
const WEBHOOK_RECEIVER_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`;

async function callWhatsAppQrcode(body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-qrcode`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify(body),
    },
  );
  return res.json();
}

export function WhatsAppSettingsSection() {
  const { toast } = useToast();
  const { tenant } = useTenant();
  const { data: instances, isLoading, refetch } = useWhatsAppInstances();

  // Find instance for this tenant
  const tenantInstance = instances?.find(i =>
    i.instance_name === tenant?.slug || i.tenant_id === tenant?.id
  );

  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [status, setStatus] = useState<string>('disconnected');
  const [checking, setChecking] = useState(false);
  const [connectMode, setConnectMode] = useState<'qr' | 'code'>('qr');
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingPhone, setPairingPhone] = useState('');
  const [pairingLoading, setPairingLoading] = useState(false);
  const qrInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const [activatingWebhook, setActivatingWebhook] = useState(false);
  // Track whether we have already auto-registered the webhook this session
  const webhookRegisteredRef = useRef(false);

  const isConnected = status === 'connected';

  const checkStatus = useCallback(async () => {
    if (!tenantInstance) return;
    setChecking(true);
    try {
      const result = await callWhatsAppQrcode({ action: 'status', instance_id: tenantInstance.id });
      const connected = result.status === 'connected';
      setStatus(connected ? 'connected' : 'disconnected');
      if (connected && qrInterval.current) {
        clearInterval(qrInterval.current);
        qrInterval.current = null;
        setQrCode(null);
      }
    } catch { /* ignore */ }
    setChecking(false);
  }, [tenantInstance?.id]);

  useEffect(() => {
    if (!tenantInstance) return;
    checkStatus();
    const iv = setInterval(checkStatus, 30000);
    return () => {
      clearInterval(iv);
      if (qrInterval.current) clearInterval(qrInterval.current);
    };
  }, [checkStatus, tenantInstance]);

  // Auto-register webhook once when instance is detected as connected
  useEffect(() => {
    if (isConnected && tenantInstance && !webhookRegisteredRef.current) {
      webhookRegisteredRef.current = true;
      callWhatsAppQrcode({ action: 'check_webhook', instance_id: tenantInstance.id })
        .then(() => console.log('Webhook auto-registered'))
        .catch(() => {});
    }
  }, [isConnected, tenantInstance]);

  const handleCreate = async () => {
    if (!tenant) return;
    setCreating(true);
    try {
      const result = await callWhatsAppQrcode({
        action: 'create',
        evolution_url: EVOLUTION_URL,
        evolution_api_key: EVOLUTION_API_KEY,
        instance_name: tenant.slug,
      });
      if (result.error) throw new Error(result.error);
      toast({ title: 'Instância criada! Agora conecte via QR Code.' });
      refetch();
    } catch (err: any) {
      toast({ title: 'Erro ao criar instância', description: err.message, variant: 'destructive' });
    }
    setCreating(false);
  };

  const fetchQr = async () => {
    if (!tenantInstance) return;
    setQrLoading(true);
    try {
      const result = await callWhatsAppQrcode({ action: 'qrcode', instance_id: tenantInstance.id });
      if (result.error) throw new Error(result.error);
      const qr = result?.qrcode;
      const base64 = typeof qr === 'string' ? qr : qr?.base64 || null;
      if (base64) {
        setQrCode(base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`);
      } else {
        const stateCheck = await callWhatsAppQrcode({ action: 'status', instance_id: tenantInstance.id });
        if (stateCheck.status === 'connected') {
          setStatus('connected');
          toast({ title: 'Número já conectado!' });
        } else {
          toast({ title: 'QR Code não disponível, tente novamente', variant: 'destructive' });
        }
      }
    } catch (err: any) {
      toast({ title: 'Erro ao gerar QR Code', description: err.message, variant: 'destructive' });
    }
    setQrLoading(false);
  };

  const startQr = () => {
    fetchQr();
    if (qrInterval.current) clearInterval(qrInterval.current);
    qrInterval.current = setInterval(fetchQr, 30000);
  };

  const fetchPairingCode = async () => {
    if (!tenantInstance || !pairingPhone) {
      toast({ title: 'Informe o número com DDD (ex: 5511999999999)', variant: 'destructive' });
      return;
    }
    setPairingLoading(true);
    try {
      const result = await callWhatsAppQrcode({
        action: 'pairing_code',
        instance_id: tenantInstance.id,
        phone: pairingPhone,
      });
      if (result.error) throw new Error(result.error);
      if (result.pairingCode) {
        setPairingCode(result.pairingCode);
      } else {
        toast({ title: 'Código não disponível, tente novamente', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Erro ao gerar código', description: err.message, variant: 'destructive' });
    }
    setPairingLoading(false);
  };

  const handleDelete = async () => {
    if (!tenantInstance || !confirm('Desconectar e remover a instância do WhatsApp?')) return;
    setDeleting(true);
    try {
      await callWhatsAppQrcode({ action: 'delete', instance_id: tenantInstance.id });
      setStatus('disconnected');
      setQrCode(null);
      refetch();
      toast({ title: 'WhatsApp desconectado' });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
    setDeleting(false);
  };

  const handleActivateWebhook = async () => {
    if (!tenantInstance) return;
    setActivatingWebhook(true);
    try {
      const evoUrl = (tenantInstance as any).evolution_url || EVOLUTION_URL;
      const evoKey = (tenantInstance as any).evolution_api_key || EVOLUTION_API_KEY;
      const instanceName = tenantInstance.instance_name;
      const res = await fetch(`${evoUrl}/webhook/set/${instanceName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: evoKey },
        body: JSON.stringify({
          webhook: {
            enabled: true,
            url: WEBHOOK_RECEIVER_URL,
            events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE', 'QRCODE_UPDATED'],
          },
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText.slice(0, 200));
      }
      toast({
        title: 'Webhook ativado!',
        description: 'Mensagens do WhatsApp serão recebidas automaticamente.',
      });
    } catch (err: any) {
      toast({ title: 'Erro ao ativar webhook', description: err.message, variant: 'destructive' });
    }
    setActivatingWebhook(false);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  // No instance yet — show create button
  if (!tenantInstance) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Smartphone className="h-4 w-4" />
            WhatsApp da Empresa
          </CardTitle>
          <CardDescription>
            Conecte o WhatsApp da sua empresa para receber e enviar mensagens pelo CRM
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="p-4 rounded-2xl bg-muted/50">
              <MessageSquare className="h-10 w-10 text-muted-foreground/40" />
            </div>
            <div className="text-center space-y-1">
              <p className="font-medium text-foreground">Nenhum número conectado</p>
              <p className="text-sm text-muted-foreground max-w-md">
                Clique abaixo para configurar o WhatsApp da sua empresa. A instância será criada automaticamente.
              </p>
            </div>
            <Button onClick={handleCreate} disabled={creating} className="gap-2">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
              Conectar WhatsApp
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Instance exists — show connection/status
  return (
    <Card className="overflow-hidden">
      <div className={`h-1 ${isConnected ? 'bg-green-500' : 'bg-muted-foreground/30'}`} />
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${isConnected ? 'bg-green-100 dark:bg-green-900/30' : 'bg-muted'}`}>
              {isConnected
                ? <Wifi className="h-5 w-5 text-green-600" />
                : <WifiOff className="h-5 w-5 text-muted-foreground" />}
            </div>
            <div>
              <CardTitle className="text-base">WhatsApp da Empresa</CardTitle>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant={isConnected ? 'default' : 'secondary'} className="gap-1 text-[10px] h-5">
                  {isConnected ? <><CheckCircle2 className="h-2.5 w-2.5" />Online</> : <><XCircle className="h-2.5 w-2.5" />Offline</>}
                </Badge>
                <span className="text-[11px] text-muted-foreground">{tenantInstance.instance_name}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={handleActivateWebhook} disabled={activatingWebhook} className="gap-1.5 h-8 text-xs">
              {activatingWebhook ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
              Ativar Webhook
            </Button>
            <Button variant="ghost" size="icon" onClick={handleDelete} disabled={deleting} className="text-muted-foreground hover:text-destructive h-8 w-8">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {!isConnected && (
        <CardContent>
          <div className="rounded-xl bg-muted/30 border border-dashed border-muted-foreground/20 overflow-hidden">
            <div className="flex border-b border-muted-foreground/10">
              <button
                onClick={() => setConnectMode('qr')}
                className={`flex-1 py-2.5 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${connectMode === 'qr' ? 'bg-background text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <QrCode className="h-3.5 w-3.5" />
                QR Code
              </button>
              <button
                onClick={() => setConnectMode('code')}
                className={`flex-1 py-2.5 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${connectMode === 'code' ? 'bg-background text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Phone className="h-3.5 w-3.5" />
                Código (remoto)
              </button>
            </div>

            <div className="p-4">
              {connectMode === 'qr' ? (
                <div className="flex flex-col items-center gap-3">
                  {qrCode ? (
                    <>
                      <img src={qrCode} alt="QR Code" className="w-52 h-52 rounded-xl shadow-lg" />
                      <p className="text-[11px] text-muted-foreground">Escaneie com seu WhatsApp • Atualiza a cada 30s</p>
                      <Button variant="outline" size="sm" onClick={fetchQr} disabled={qrLoading} className="gap-1.5">
                        {qrLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                        Atualizar QR
                      </Button>
                    </>
                  ) : (
                    <>
                      <QrCode className="h-10 w-10 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">Escaneie o QR Code para conectar</p>
                      <Button onClick={startQr} disabled={qrLoading} className="gap-2">
                        {qrLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                        Gerar QR Code
                      </Button>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <Phone className="h-10 w-10 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground text-center">
                    Conecte à distância: insira o número e digite o código no WhatsApp do celular
                  </p>
                  <div className="w-full max-w-xs space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Número com código do país</Label>
                      <Input
                        value={pairingPhone}
                        onChange={(e) => setPairingPhone(e.target.value)}
                        placeholder="5511999999999"
                        className="text-center text-sm"
                      />
                    </div>
                    {pairingCode ? (
                      <div className="text-center space-y-2">
                        <p className="text-xs text-muted-foreground">Digite este código no WhatsApp:</p>
                        <p className="text-3xl font-mono font-bold tracking-[0.3em] text-primary select-all">
                          {pairingCode}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Abra WhatsApp → ⋮ → Aparelhos conectados → Conectar → Conectar com número
                        </p>
                        <Button variant="outline" size="sm" onClick={fetchPairingCode} disabled={pairingLoading} className="gap-1.5">
                          {pairingLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                          Gerar novo código
                        </Button>
                      </div>
                    ) : (
                      <Button onClick={fetchPairingCode} disabled={pairingLoading || !pairingPhone} className="w-full gap-2">
                        {pairingLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
                        Gerar Código
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
