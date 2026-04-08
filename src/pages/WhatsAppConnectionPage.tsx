import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { QrCode, Smartphone, Loader2, CheckCircle2, XCircle, RefreshCw, LogOut, Phone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function WhatsAppConnectionPage() {
  const { toast } = useToast();
  const [status, setStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [connectedPhone, setConnectedPhone] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingPhone, setPairingPhone] = useState('');
  const [pairingLoading, setPairingLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const qrIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const callFunction = useCallback(async (body: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-connect`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(body),
      }
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Erro');
    return json;
  }, []);

  const checkStatus = useCallback(async () => {
    try {
      const result = await callFunction({ action: 'status' });
      setStatus(result.status === 'connected' ? 'connected' : 'disconnected');
      setConnectedPhone(result.phone || null);
      if (result.status === 'connected') {
        // Stop QR refresh if connected
        if (qrIntervalRef.current) {
          clearInterval(qrIntervalRef.current);
          qrIntervalRef.current = null;
        }
        setQrCode(null);
        setPairingCode(null);
      }
    } catch {
      setStatus('disconnected');
    }
  }, [callFunction]);

  useEffect(() => {
    checkStatus();
    const statusInterval = setInterval(checkStatus, 15000);
    return () => {
      clearInterval(statusInterval);
      if (qrIntervalRef.current) clearInterval(qrIntervalRef.current);
    };
  }, [checkStatus]);

  const fetchQrCode = useCallback(async () => {
    setQrLoading(true);
    try {
      const result = await callFunction({ action: 'qrcode' });
      if (result.qrcode) {
        setQrCode(result.qrcode);
      } else {
        toast({ title: 'QR Code não disponível', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setQrLoading(false);
    }
  }, [callFunction, toast]);

  const startQrRefresh = useCallback(() => {
    fetchQrCode();
    if (qrIntervalRef.current) clearInterval(qrIntervalRef.current);
    qrIntervalRef.current = setInterval(fetchQrCode, 30000);
  }, [fetchQrCode]);

  const requestPairingCode = async () => {
    if (!pairingPhone) {
      toast({ title: 'Informe seu número de telefone', variant: 'destructive' });
      return;
    }
    setPairingLoading(true);
    try {
      const result = await callFunction({ action: 'pairing_code', phone: pairingPhone });
      if (result.pairingCode) {
        setPairingCode(result.pairingCode);
      } else {
        toast({ title: 'Código não disponível. Tente o QR Code.', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setPairingLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Deseja desconectar o WhatsApp?')) return;
    setDisconnecting(true);
    try {
      await callFunction({ action: 'disconnect' });
      setStatus('disconnected');
      setConnectedPhone(null);
      toast({ title: 'WhatsApp desconectado' });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setDisconnecting(false);
    }
  };

  if (status === 'checking') {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Conexão WhatsApp</h1>
        <p className="text-muted-foreground text-sm">Gerencie a conexão do WhatsApp com o CRM</p>
      </div>

      {/* Status Card */}
      <Card>
        <CardContent className="flex items-center justify-between p-5">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-full ${status === 'connected' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-muted'}`}>
              <Smartphone className={`h-5 w-5 ${status === 'connected' ? 'text-green-600' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <p className="font-semibold text-foreground">
                {status === 'connected' ? 'WhatsApp Conectado' : 'WhatsApp Desconectado'}
              </p>
              {connectedPhone && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {connectedPhone}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={status === 'connected' ? 'default' : 'secondary'} className="gap-1">
              {status === 'connected' ? <><CheckCircle2 className="h-3 w-3" />Online</> : <><XCircle className="h-3 w-3" />Offline</>}
            </Badge>
            {status === 'connected' && (
              <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={disconnecting} className="gap-1 text-destructive hover:text-destructive">
                {disconnecting ? <Loader2 className="h-3 w-3 animate-spin" /> : <LogOut className="h-3 w-3" />}
                Desconectar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Connection Options - only show when disconnected */}
      {status === 'disconnected' && (
        <Tabs defaultValue="qrcode" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="qrcode" className="gap-1.5"><QrCode className="h-4 w-4" />QR Code</TabsTrigger>
            <TabsTrigger value="pairing" className="gap-1.5"><Smartphone className="h-4 w-4" />Código de Pareamento</TabsTrigger>
          </TabsList>

          <TabsContent value="qrcode" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Conectar via QR Code</CardTitle>
                <CardDescription>Abra o WhatsApp no celular → Menu (⋮) → Dispositivos conectados → Conectar dispositivo → Escaneie o QR Code abaixo</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center space-y-4">
                {qrCode ? (
                  <>
                    <div className="relative">
                      <img
                        src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
                        alt="QR Code WhatsApp"
                        className="w-72 h-72 rounded-xl border-2 border-primary/20 shadow-lg"
                      />
                      <div className="absolute -bottom-2 -right-2 bg-background rounded-full p-1 shadow">
                        <RefreshCw className="h-4 w-4 text-muted-foreground animate-spin" style={{ animationDuration: '30s' }} />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">Atualiza automaticamente a cada 30 segundos</p>
                    <Button variant="outline" size="sm" onClick={fetchQrCode} disabled={qrLoading} className="gap-1">
                      {qrLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                      Atualizar Agora
                    </Button>
                  </>
                ) : (
                  <Button onClick={startQrRefresh} disabled={qrLoading} className="gap-2">
                    {qrLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                    Gerar QR Code
                  </Button>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pairing" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Conectar via Código de Pareamento</CardTitle>
                <CardDescription>Abra o WhatsApp no celular → Menu (⋮) → Dispositivos conectados → Conectar dispositivo → Vincular com número de telefone</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Seu número de telefone (com DDI)</Label>
                  <div className="flex gap-2">
                    <Input
                      value={pairingPhone}
                      onChange={e => setPairingPhone(e.target.value)}
                      placeholder="5511999999999"
                      className="flex-1"
                    />
                    <Button onClick={requestPairingCode} disabled={pairingLoading} className="gap-1">
                      {pairingLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
                      Gerar Código
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Ex: 5511999999999 (Brasil + DDD + número)</p>
                </div>

                {pairingCode && (
                  <div className="bg-muted/50 rounded-xl p-6 text-center space-y-3">
                    <p className="text-sm text-muted-foreground">Digite este código no WhatsApp:</p>
                    <p className="text-4xl font-mono font-bold tracking-[0.3em] text-foreground">{pairingCode}</p>
                    <p className="text-xs text-muted-foreground">O código expira em alguns minutos</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Info Card */}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong>Instância:</strong> bigodao77 • <strong>Servidor:</strong> Evolution API • A conexão é mantida automaticamente enquanto o celular estiver com internet.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
