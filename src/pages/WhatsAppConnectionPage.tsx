import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import {
  QrCode, Smartphone, Loader2, CheckCircle2, XCircle, RefreshCw,
  Plus, Trash2, Users, Save, MessageSquare, Wifi, WifiOff, UserPlus, Phone,
  User, Mail, PhoneCall, Calendar,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  useWhatsAppInstances,
  useWhatsAppAssignments,
  useSaveWhatsAppAssignments,
} from '@/hooks/use-integrations';
import { useProfiles, useLeads } from '@/hooks/use-leads';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatDate } from '@/types/crm';

// ── helpers ──

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

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
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

// ── Instance Card ──

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
  const [status, setStatus] = useState(instance.status || 'disconnected');
  const [checking, setChecking] = useState(false);
  const [localAssignments, setLocalAssignments] = useState<Record<string, number>>({});
  const [showAddSeller, setShowAddSeller] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [connectMode, setConnectMode] = useState<'qr' | 'code'>('qr');
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingPhone, setPairingPhone] = useState('');
  const [pairingLoading, setPairingLoading] = useState(false);
  const qrInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const isConnected = status === 'connected';

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
      const result = await callWhatsAppQrcode({ action: 'status', instance_id: instance.id });
      const connected = result.status === 'connected';
      setStatus(connected ? 'connected' : 'disconnected');
      if (connected && qrInterval.current) {
        clearInterval(qrInterval.current);
        qrInterval.current = null;
        setQrCode(null);
      }
    } catch { /* ignore */ }
    setChecking(false);
  }, [instance.id]);

  useEffect(() => {
    checkStatus();
    const iv = setInterval(checkStatus, 20000);
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
        setQrCode(base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`);
      } else {
        const stateCheck = await callWhatsAppQrcode({ action: 'status', instance_id: instance.id });
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

  const handleDelete = async () => {
    if (!confirm(`Excluir instância "${instance.name}"?`)) return;
    setDeleting(true);
    try {
      await callWhatsAppQrcode({ action: 'delete', instance_id: instance.id });
      onRefresh();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
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

  return (
    <Card className="overflow-hidden">
      {/* Status strip */}
      <div className={`h-1 ${isConnected ? 'bg-green-500' : 'bg-muted-foreground/30'}`} />

      <CardContent className="p-5 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${isConnected ? 'bg-green-100 dark:bg-green-900/30' : 'bg-muted'}`}>
              {isConnected
                ? <Wifi className="h-5 w-5 text-green-600" />
                : <WifiOff className="h-5 w-5 text-muted-foreground" />}
            </div>
            <div>
              <h3 className="font-bold text-foreground text-base">{instance.name}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant={isConnected ? 'default' : 'secondary'} className="gap-1 text-[10px] h-5">
                  {isConnected ? <><CheckCircle2 className="h-2.5 w-2.5" />Online</> : <><XCircle className="h-2.5 w-2.5" />Offline</>}
                </Badge>
                <span className="text-[11px] text-muted-foreground">{instance.instance_name}</span>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={handleDelete} disabled={deleting} className="text-muted-foreground hover:text-destructive h-8 w-8">
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        </div>

        {/* Connection area (only when disconnected) */}
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
  const [instanceName, setInstanceName] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name || !instanceName) {
      toast({ title: 'Preencha nome e nome da instância', variant: 'destructive' });
      return;
    }
    setCreating(true);
    try {
      const result = await callWhatsAppQrcode({
        action: 'create',
        name,
        evolution_url: 'http://76.13.230.7:64644',
        evolution_api_key: 'bigodao77chave',
        instance_name: instanceName,
      });
      if (result.error) throw new Error(result.error);
      toast({ title: 'Instância criada com sucesso!' });
      onCreated();
      setOpen(false);
      setName('');
      setInstanceName('');
    } catch (err: any) {
      toast({ title: 'Erro ao criar instância', description: err.message, variant: 'destructive' });
    }
    setCreating(false);
  };

  return (
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
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: WhatsApp Vendas" />
          </div>
          <div className="space-y-1.5">
            <Label>Nome da instância (único)</Label>
            <Input value={instanceName} onChange={(e) => setInstanceName(e.target.value)} placeholder="Ex: vendas01" />
          </div>
          <Button onClick={handleCreate} disabled={creating} className="w-full gap-2">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
            Criar e Conectar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ──

// ── Salesperson View: My Leads ──

function SalespersonWhatsAppView() {
  const { user } = useAuth();
  const { data: leads, isLoading: leadsLoading } = useLeads();
  const { data: assignments } = useWhatsAppAssignments();
  const { data: instances } = useWhatsAppInstances();

  const myAssignments = assignments?.filter(a => a.user_id === user?.id) || [];
  const myInstanceIds = myAssignments.map(a => a.whatsapp_instance_id);
  const myInstances = instances?.filter(i => myInstanceIds.includes(i.id)) || [];

  const myLeads = leads?.filter(l => l.assigned_to === user?.id) || [];

  const statusConfig: Record<string, { label: string; color: string }> = {
    novo: { label: 'Novo', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
    contactado: { label: 'Contactado', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
    negociando: { label: 'Negociando', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
    proposta_enviada: { label: 'Proposta', color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300' },
    ganho: { label: 'Ganho', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
    perdido: { label: 'Perdido', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  };

  if (leadsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">WhatsApp</h1>
        <p className="text-muted-foreground text-sm">
          Seus leads e números vinculados
        </p>
      </div>

      {/* My WhatsApp Numbers */}
      {myInstances.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Phone className="h-4 w-4 text-primary" />
            Números vinculados a você
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {myInstances.map(inst => {
              const assignment = myAssignments.find(a => a.whatsapp_instance_id === inst.id);
              return (
                <Card key={inst.id}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${inst.status === 'connected' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-muted'}`}>
                      {inst.status === 'connected'
                        ? <Wifi className="h-4 w-4 text-green-600" />
                        : <WifiOff className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">{inst.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant={inst.status === 'connected' ? 'default' : 'secondary'} className="text-[10px] h-5">
                          {inst.status === 'connected' ? 'Online' : 'Offline'}
                        </Badge>
                        {assignment && (
                          <span className="text-xs text-muted-foreground">{assignment.percentage}% dos leads</span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* My Leads */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Meus Leads ({myLeads.length})
        </h2>

        {myLeads.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
              <User className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Nenhum lead atribuído a você ainda</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {myLeads.map(lead => {
              const st = statusConfig[lead.status] || statusConfig['novo'];
              return (
                <Card key={lead.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">{lead.name}</p>
                        <p className="text-xs text-muted-foreground">{lead.source} • {formatDate(lead.created_at)}</p>
                      </div>
                      <Badge className={`${st.color} border-0 text-[10px] h-5 shrink-0`}>{st.label}</Badge>
                    </div>

                    <div className="space-y-1.5">
                      {lead.phone && (
                        <div className="flex items-center gap-2 text-sm">
                          <PhoneCall className="h-3.5 w-3.5 text-muted-foreground" />
                          <a href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                            {lead.phone}
                          </a>
                        </div>
                      )}
                      {lead.email && (
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground truncate">{lead.email}</span>
                        </div>
                      )}
                    </div>

                    {lead.value > 0 && (
                      <p className="text-sm font-bold text-primary">{formatCurrency(lead.value)}</p>
                    )}

                    {lead.notes && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{lead.notes}</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──

export default function WhatsAppConnectionPage() {
  const { role } = useAuth();
  const isAdmin = role === 'admin' || role === 'manager';

  if (!isAdmin) {
    return <SalespersonWhatsAppView />;
  }

  return <AdminWhatsAppView />;
}

function AdminWhatsAppView() {
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
