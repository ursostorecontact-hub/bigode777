import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Progress } from '@/components/ui/progress';
import {
  QrCode, Smartphone, Loader2, CheckCircle2, XCircle, RefreshCw,
  Plus, Trash2, Users, Save, MessageSquare, Wifi, WifiOff, UserPlus, Phone, Zap,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  useWhatsAppInstances,
  useWhatsAppAssignments,
  useSaveWhatsAppAssignments,
} from '@/hooks/use-integrations';
import { useProfiles } from '@/hooks/use-leads';
import { useToast } from '@/hooks/use-toast';

// ── helpers ──

async function callEdgeFn(fn: string, body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fn}`,
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

const callWhatsAppQrcode = (body: Record<string, unknown>) => callEdgeFn('whatsapp-qrcode', body);

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

function normalizeBase64(b64: string | null | undefined): string | null {
  if (!b64) return null;
  return b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`;
}

// ── Seller Assignment Row ──

function SellerRow({ profile, percentage, onChange, onRemove }: {
  profile: { id: string; full_name: string };
  percentage: number;
  onChange: (v: number) => void;
  onRemove: () => void;
}) {
  return (
    <div className="group flex items-center gap-3 p-3 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors">
      <Avatar className="h-10 w-10 ring-2 ring-primary/20">
        <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
          {initials(profile.full_name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground truncate">{profile.full_name}</p>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-bold tabular-nums min-w-[3ch] text-right ${percentage > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
              {percentage}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={onRemove}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <Slider
          value={[percentage]}
          onValueChange={(v) => onChange(v[0])}
          max={100}
          min={0}
          step={5}
          className="w-full"
        />
      </div>
    </div>
  );
}

// ── Percentage Summary Bar ──

function PercentageSummary({ total, sellerCount }: { total: number; sellerCount: number }) {
  const isValid = total === 100;
  const remaining = 100 - total;

  return (
    <div className={`rounded-xl p-3 border-2 transition-colors ${isValid ? 'border-green-500/30 bg-green-50/50 dark:bg-green-950/20' : 'border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground">
          {sellerCount} vendedor{sellerCount !== 1 ? 'es' : ''} vinculado{sellerCount !== 1 ? 's' : ''}
        </span>
        <span className={`text-sm font-bold ${isValid ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
          {total}%
        </span>
      </div>
      <Progress value={total} className="h-2" />
      <p className="text-[11px] mt-1.5 text-muted-foreground">
        {isValid
          ? '✅ Distribuição completa — pronto para receber leads!'
          : remaining > 0
            ? `⚠️ Ajuste os sliders — faltam ${remaining}% para completar`
            : `⚠️ Total excede 100% — reduza ${Math.abs(remaining)}%`}
      </p>
    </div>
  );
}

// ── QR Code Modal ──

function QrCodeModal({ instanceId, instanceName, initialQrBase64, onConnected, onClose }: {
  instanceId: string;
  instanceName: string;
  initialQrBase64: string | null;
  onConnected: () => void;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [phase, setPhase] = useState<'connecting' | 'connected'>('connecting');
  const [qrBase64, setQrBase64] = useState<string | null>(initialQrBase64);
  const [countdown, setCountdown] = useState(20);
  const [loading, setLoading] = useState(!initialQrBase64);

  // Stable refs for callbacks and internal flags
  const onConnectedRef = useRef(onConnected);
  const onCloseRef = useRef(onClose);
  onConnectedRef.current = onConnected;
  onCloseRef.current = onClose;

  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshingRef = useRef(false);
  const countdownValRef = useRef(20);

  const stopTimers = useCallback(() => {
    if (countdownTimerRef.current) { clearInterval(countdownTimerRef.current); countdownTimerRef.current = null; }
    if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null; }
  }, []);

  const handleConnected = useCallback(() => {
    stopTimers();
    setPhase('connected');
    onConnectedRef.current();
  }, [stopTimers]);

  const refreshQr = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setLoading(true);
    try {
      const result = await callWhatsAppQrcode({ action: 'refresh_qr', instance_id: instanceId });
      if (result.connected) {
        handleConnected();
        return;
      }
      if (result.qrcode_base64) {
        setQrBase64(normalizeBase64(result.qrcode_base64 as string));
        countdownValRef.current = 20;
        setCountdown(20);
      } else if (result.error) {
        toast({ title: 'Erro ao atualizar QR', description: result.error, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Erro ao atualizar QR', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
      refreshingRef.current = false;
    }
  }, [instanceId, handleConnected, toast]);

  const checkStatus = useCallback(async () => {
    try {
      const result = await callWhatsAppQrcode({ action: 'check_status', instance_id: instanceId });
      if (result.status === 'connected') {
        handleConnected();
      }
    } catch {
      // Polling errors are silent
    }
  }, [instanceId, handleConnected]);

  // Fetch QR on mount if no initial QR was provided
  useEffect(() => {
    if (!initialQrBase64) {
      refreshQr();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Countdown + polling timers while in connecting phase
  useEffect(() => {
    if (phase !== 'connecting') return;

    countdownValRef.current = countdown;

    countdownTimerRef.current = setInterval(() => {
      countdownValRef.current -= 1;
      setCountdown(countdownValRef.current);
      if (countdownValRef.current <= 0) {
        countdownValRef.current = 20;
        setCountdown(20);
        refreshQr();
      }
    }, 1000);

    pollTimerRef.current = setInterval(checkStatus, 3000);

    return () => stopTimers();
    // Only re-run when phase changes; refreshQr/checkStatus/stopTimers are stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const handleClose = () => {
    stopTimers();
    onCloseRef.current();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            Conectar {instanceName}
          </DialogTitle>
        </DialogHeader>

        {phase === 'connected' ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="p-4 rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
            </div>
            <div className="text-center space-y-1">
              <p className="font-semibold text-foreground text-lg">Conectado!</p>
              <p className="text-sm text-muted-foreground">WhatsApp vinculado com sucesso.</p>
            </div>
            <Button onClick={handleClose} className="w-full">Fechar</Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <p className="text-xs text-muted-foreground text-center leading-relaxed">
              Abra o WhatsApp → Aparelhos conectados → Conectar aparelho → Escaneie o QR Code
            </p>

            {/* QR Code display */}
            <div className="relative">
              {loading && !qrBase64 ? (
                <div className="w-52 h-52 rounded-xl bg-muted/40 flex items-center justify-center border border-dashed border-muted-foreground/20">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : qrBase64 ? (
                <div className="relative">
                  <img
                    src={qrBase64}
                    alt="QR Code WhatsApp"
                    className={`w-52 h-52 rounded-xl shadow-lg transition-opacity duration-200 ${loading ? 'opacity-40' : 'opacity-100'}`}
                  />
                  {loading && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-xl">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-52 h-52 rounded-xl bg-muted/40 flex items-center justify-center border border-dashed border-muted-foreground/20">
                  <QrCode className="h-12 w-12 text-muted-foreground/30" />
                </div>
              )}
            </div>

            {/* Countdown bar */}
            <div className="w-full space-y-1">
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>QR expira em</span>
                <span className={countdown <= 10 ? 'text-amber-500 font-bold' : ''}>{countdown}s</span>
              </div>
              <Progress value={(countdown / 20) * 100} className="h-1.5" />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={refreshQr}
              disabled={loading}
              className="gap-1.5"
            >
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Atualizar QR
            </Button>

            <p className="text-[11px] text-muted-foreground/70 text-center">
              Verificando conexão automaticamente...
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Instance Card ──

type InstanceStatus = 'connected' | 'connecting' | 'disconnected';

function InstanceCard({ instance, profiles, onRefresh }: {
  instance: any;
  profiles: any[];
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const { data: assignments } = useWhatsAppAssignments(instance.id);
  const saveAssignments = useSaveWhatsAppAssignments();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [status, setStatus] = useState<InstanceStatus>(instance.status || 'disconnected');
  const [checking, setChecking] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const failCount = useRef(0);
  const [localAssignments, setLocalAssignments] = useState<Record<string, number>>({});
  const [showAddSeller, setShowAddSeller] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activatingWebhook, setActivatingWebhook] = useState(false);
  const [connectMode, setConnectMode] = useState<'qr' | 'code'>('qr');
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingPhone, setPairingPhone] = useState('');
  const [pairingLoading, setPairingLoading] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const qrInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting';

  useEffect(() => {
    if (assignments) {
      const map: Record<string, number> = {};
      assignments.forEach((a) => { map[a.user_id] = a.percentage; });
      setLocalAssignments(map);
    }
  }, [assignments]);

  const checkStatus = useCallback(async () => {
    setChecking(true);
    try {
      const result = await callWhatsAppQrcode({ action: 'check_status', instance_id: instance.id });
      if (result.cached) {
        setChecking(false);
        return;
      }
      if (result.status) {
        setStatus(result.status as InstanceStatus);
        failCount.current = 0;
        if (result.status === 'connected' && qrInterval.current) {
          clearInterval(qrInterval.current);
          qrInterval.current = null;
          setQrCode(null);
        }
      }
    } catch {
      failCount.current++;
    }
    setChecking(false);
  }, [instance.id]);

  const handleReconnect = async () => {
    setReconnecting(true);
    try {
      const result = await callWhatsAppQrcode({ action: 'reconnect', instance_id: instance.id });
      setStatus((result.status as InstanceStatus) || 'connecting');
      if (result.status === 'connected') {
        toast({ title: 'Reconectado com sucesso!' });
      } else {
        toast({ title: 'Tentando reconectar...', description: 'Pode levar alguns segundos' });
        setTimeout(checkStatus, 5000);
      }
    } catch (err: any) {
      toast({ title: 'Erro ao reconectar', description: err.message, variant: 'destructive' });
    }
    setReconnecting(false);
  };

  useEffect(() => {
    checkStatus();
    const iv = setInterval(checkStatus, 45000);
    return () => {
      clearInterval(iv);
      if (qrInterval.current) clearInterval(qrInterval.current);
    };
  }, [checkStatus]);

  const fetchQr = async () => {
    setQrLoading(true);
    try {
      const result = await callWhatsAppQrcode({ action: 'qrcode', instance_id: instance.id });
      if (result.error) throw new Error(result.error);
      const qr = result?.qrcode;
      const base64 = typeof qr === 'string' ? qr : qr?.base64 || null;
      if (base64) {
        setQrCode(normalizeBase64(base64));
      } else {
        const stateCheck = await callWhatsAppQrcode({ action: 'check_status', instance_id: instance.id });
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
    if (!pairingPhone) {
      toast({ title: 'Informe o número com DDD (ex: 5511999999999)', variant: 'destructive' });
      return;
    }
    setPairingLoading(true);
    try {
      const result = await callWhatsAppQrcode({
        action: 'pairing_code',
        instance_id: instance.id,
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

  const handleActivateWebhook = async () => {
    setActivatingWebhook(true);
    try {
      const result = await callWhatsAppQrcode({ action: 'check_webhook', instance_id: instance.id });
      if (result.error) throw new Error(result.error);
      toast({
        title: 'Webhook ativado!',
        description: 'Mensagens do WhatsApp serão recebidas automaticamente.',
      });
    } catch (err: any) {
      toast({ title: 'Erro ao ativar webhook', description: err.message, variant: 'destructive' });
    }
    setActivatingWebhook(false);
  };

  const handleDelete = async () => {
    setShowDeleteConfirm(false);
    setDeleting(true);
    try {
      const result = await callEdgeFn('whatsapp-delete-instance', { instance_id: instance.id });
      if (result.error) throw new Error(result.error);
      toast({ title: 'Número removido', description: 'Conversas e mensagens apagadas com sucesso.' });
      onRefresh();
    } catch (err: any) {
      toast({ title: 'Erro ao remover', description: err.message, variant: 'destructive' });
    }
    setDeleting(false);
  };

  const totalPct = Object.values(localAssignments).reduce((s, v) => s + v, 0);
  const assignedProfiles = profiles.filter((p) => p.id in localAssignments);
  const unassignedProfiles = profiles.filter((p) => !(p.id in localAssignments));

  const handleSaveAssignments = () => {
    if (totalPct !== 100 && assignedProfiles.length > 0) {
      toast({ title: `O total deve ser 100% (atual: ${totalPct}%)`, variant: 'destructive' });
      return;
    }
    const arr = Object.entries(localAssignments).map(([user_id, percentage]) => ({ user_id, percentage }));
    saveAssignments.mutate({ instanceId: instance.id, assignments: arr });
  };

  const statusStrip = isConnected ? 'bg-green-500' : isConnecting ? 'bg-amber-500' : 'bg-muted-foreground/30';
  const statusIconBg = isConnected ? 'bg-green-100 dark:bg-green-900/30' : isConnecting ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-muted';

  return (
    <Card className="overflow-hidden">
      <div className={`h-1 ${statusStrip}`} />

      <CardContent className="p-5 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${statusIconBg}`}>
              {isConnected
                ? <Wifi className="h-5 w-5 text-green-600" />
                : isConnecting
                  ? <Loader2 className="h-5 w-5 text-amber-600 animate-spin" />
                  : <WifiOff className="h-5 w-5 text-muted-foreground" />}
            </div>
            <div>
              <h3 className="font-bold text-foreground text-base">{instance.name || instance.instance_name}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                {isConnected ? (
                  <Badge variant="default" className="gap-1 text-[10px] h-5 bg-green-500 hover:bg-green-500">
                    <CheckCircle2 className="h-2.5 w-2.5" />Online
                  </Badge>
                ) : isConnecting ? (
                  <Badge variant="outline" className="gap-1 text-[10px] h-5 border-amber-500 text-amber-600">
                    <Loader2 className="h-2.5 w-2.5 animate-spin" />Conectando
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1 text-[10px] h-5">
                    <XCircle className="h-2.5 w-2.5" />Offline
                  </Badge>
                )}
                <span className="text-[11px] text-muted-foreground">{instance.instance_name}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {!isConnected && (
              <>
                <Button variant="outline" size="sm" onClick={() => setQrModalOpen(true)} className="gap-1.5 h-8 text-xs">
                  <QrCode className="h-3.5 w-3.5" />
                  Ver QR
                </Button>
                <Button variant="outline" size="sm" onClick={handleReconnect} disabled={reconnecting} className="gap-1.5 h-8 text-xs">
                  {reconnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5" />}
                  Reconectar
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" onClick={handleActivateWebhook} disabled={activatingWebhook} className="gap-1.5 h-8 text-xs">
              {activatingWebhook ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
              Ativar Webhook
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setShowDeleteConfirm(true)} disabled={deleting} className="text-muted-foreground hover:text-destructive h-8 w-8">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover número WhatsApp?</AlertDialogTitle>
              <AlertDialogDescription>
                Isso vai apagar <strong>permanentemente</strong> todas as conversas, mensagens e leads
                importados de <strong>{instance.name || instance.instance_name}</strong>.
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              >
                Sim, remover tudo
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* QR Modal for existing instance */}
        {qrModalOpen && (
          <QrCodeModal
            instanceId={instance.id}
            instanceName={instance.name || instance.instance_name}
            initialQrBase64={null}
            onConnected={() => { setStatus('connected'); onRefresh(); }}
            onClose={() => setQrModalOpen(false)}
          />
        )}

        {/* Connection area (shown only when disconnected, as fallback tabs) */}
        {!isConnected && (
          <div className="rounded-xl bg-muted/30 border border-dashed border-muted-foreground/20 overflow-hidden">
            {/* Tabs: QR Code / Código */}
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
                      <p className="text-sm text-muted-foreground">Use o botão "Ver QR" acima para abrir o modal de conexão</p>
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
        )}

        {/* Seller Assignments Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Distribuição de Mensagens
            </h4>
            <div className="flex gap-1.5">
              {unassignedProfiles.length > 0 && (
                <Dialog open={showAddSeller} onOpenChange={setShowAddSeller}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
                      <UserPlus className="h-3.5 w-3.5" />
                      Vendedor
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-sm">
                    <DialogHeader>
                      <DialogTitle>Adicionar Vendedor</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground -mt-2">
                      Selecione quem receberá mensagens deste número
                    </p>
                    <div className="space-y-1 max-h-60 overflow-y-auto">
                      {unassignedProfiles.map((p) => (
                        <Button
                          key={p.id}
                          variant="ghost"
                          className="w-full justify-start gap-3 h-12"
                          onClick={() => {
                            setLocalAssignments(prev => ({ ...prev, [p.id]: 0 }));
                            setShowAddSeller(false);
                          }}
                        >
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
                              {initials(p.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{p.full_name}</span>
                        </Button>
                      ))}
                    </div>
                  </DialogContent>
                </Dialog>
              )}
              {assignedProfiles.length > 0 && (
                <Button
                  size="sm"
                  className="gap-1.5 h-8 text-xs"
                  onClick={handleSaveAssignments}
                  disabled={saveAssignments.isPending}
                >
                  {saveAssignments.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  Salvar
                </Button>
              )}
            </div>
          </div>

          {assignedProfiles.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 rounded-xl bg-muted/20 border border-dashed border-muted-foreground/15">
              <Users className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Nenhum vendedor vinculado</p>
              <p className="text-xs text-muted-foreground/70">Adicione vendedores para distribuir as mensagens</p>
            </div>
          ) : (
            <div className="space-y-2">
              {assignedProfiles.map((p) => (
                <SellerRow
                  key={p.id}
                  profile={p}
                  percentage={localAssignments[p.id] || 0}
                  onChange={(v) => setLocalAssignments(prev => ({ ...prev, [p.id]: v }))}
                  onRemove={() => {
                    setLocalAssignments(prev => {
                      const next = { ...prev };
                      delete next[p.id];
                      return next;
                    });
                  }}
                />
              ))}
              <PercentageSummary total={totalPct} sellerCount={assignedProfiles.length} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── New Instance Dialog ──

function NewInstanceDialog({ onCreated }: { onCreated: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [qrSession, setQrSession] = useState<{
    instanceId: string;
    instanceName: string;
    qrBase64: string | null;
  } | null>(null);

  const handleCreate = async () => {
    if (!name) {
      toast({ title: 'Preencha o nome de identificação', variant: 'destructive' });
      return;
    }
    setCreating(true);
    try {
      const result = await callWhatsAppQrcode({ action: 'create', name });
      if (result.error) throw new Error(result.error);

      setOpen(false);
      setName('');
      onCreated();

      setQrSession({
        instanceId: result.instance_id,
        instanceName: result.instance_name || name,
        qrBase64: normalizeBase64(result.qrcode_base64 as string | null),
      });
    } catch (err: any) {
      toast({ title: 'Erro ao criar instância', description: err.message, variant: 'destructive' });
    }
    setCreating(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Número
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Conectar Novo Número</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground -mt-2">
            Crie uma instância para conectar um número de WhatsApp via QR Code
          </p>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Nome de identificação</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: WhatsApp Vendas"
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>
            <Button onClick={handleCreate} disabled={creating} className="w-full gap-2">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
              Criar e Conectar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {qrSession && (
        <QrCodeModal
          instanceId={qrSession.instanceId}
          instanceName={qrSession.instanceName}
          initialQrBase64={qrSession.qrBase64}
          onConnected={() => onCreated()}
          onClose={() => setQrSession(null)}
        />
      )}
    </>
  );
}

// ── Page ──

export default function WhatsAppConnectionPage() {
  const { data: instances, isLoading, refetch } = useWhatsAppInstances();
  const { data: profiles } = useProfiles();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">WhatsApp</h1>
          <p className="text-muted-foreground text-sm">
            Conecte números e distribua mensagens entre vendedores por porcentagem
          </p>
        </div>
        <NewInstanceDialog onCreated={() => refetch()} />
      </div>

      {(!instances || instances.length === 0) ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="p-4 rounded-2xl bg-muted/50">
              <MessageSquare className="h-10 w-10 text-muted-foreground/40" />
            </div>
            <div className="text-center space-y-1">
              <p className="font-medium text-foreground">Nenhum número conectado</p>
              <p className="text-sm text-muted-foreground max-w-md">
                Conecte um número de WhatsApp e configure quais vendedores receberão as mensagens com a porcentagem desejada
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {instances.map((inst) => (
            <InstanceCard
              key={inst.id}
              instance={inst}
              profiles={profiles || []}
              onRefresh={() => refetch()}
            />
          ))}
        </div>
      )}

      <Card className="bg-primary/5 border-primary/10">
        <CardContent className="p-4 flex items-start gap-3">
          <div className="p-1.5 rounded-lg bg-primary/10 mt-0.5">
            <MessageSquare className="h-4 w-4 text-primary" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Como funciona a distribuição</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Conecte um número via QR Code → Adicione vendedores → Defina a % de mensagens para cada um (total 100%) →
              Salve. Quando um lead chegar pelo WhatsApp, será automaticamente direcionado ao vendedor de acordo com a porcentagem configurada.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
