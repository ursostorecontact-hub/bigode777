import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  QrCode, Smartphone, Loader2, CheckCircle2, XCircle, RefreshCw,
  LogOut, Phone, Plus, Trash2, Users, Save, MessageSquare,
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

function callWhatsAppConnect(action: string, extra: Record<string, unknown> = {}) {
  return async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-connect`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ action, ...extra }),
      },
    );
    return res.json();
  };
}

function callWhatsAppQrcode(body: Record<string, unknown>) {
  return async () => {
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
  };
}

// ── Instance card ──

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
  const [phone, setPhone] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [localAssignments, setLocalAssignments] = useState<Record<string, number>>({});
  const [showAssign, setShowAssign] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const qrInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync assignments from DB
  useEffect(() => {
    if (assignments) {
      const map: Record<string, number> = {};
      assignments.forEach((a) => { map[a.user_id] = a.percentage; });
      setLocalAssignments(map);
    }
  }, [assignments]);

  // Check status
  const checkStatus = useCallback(async () => {
    setChecking(true);
    try {
      const result = await callWhatsAppQrcode({ action: 'status', instance_id: instance.id })();
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
      const result = await callWhatsAppQrcode({ action: 'qrcode', instance_id: instance.id })();
      const qr = result?.qrcode;
      const base64 = typeof qr === 'string' ? qr : qr?.base64 || null;
      if (base64) setQrCode(base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`);
      else toast({ title: 'QR Code não disponível', variant: 'destructive' });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
    setQrLoading(false);
  };

  const startQr = () => {
    fetchQr();
    if (qrInterval.current) clearInterval(qrInterval.current);
    qrInterval.current = setInterval(fetchQr, 30000);
  };

  const handleDelete = async () => {
    if (!confirm(`Excluir instância "${instance.name}"?`)) return;
    setDeleting(true);
    try {
      await callWhatsAppQrcode({ action: 'delete', instance_id: instance.id })();
      onRefresh();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
    setDeleting(false);
  };

  // Assignments
  const totalPct = Object.values(localAssignments).reduce((s, v) => s + v, 0);
  const assignedProfiles = profiles.filter((p) => p.id in localAssignments);
  const unassignedProfiles = profiles.filter((p) => !(p.id in localAssignments));

  const addUser = (userId: string) => {
    setLocalAssignments((prev) => ({ ...prev, [userId]: 0 }));
  };
  const removeUser = (userId: string) => {
    setLocalAssignments((prev) => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  };
  const setPct = (userId: string, v: number) => {
    setLocalAssignments((prev) => ({ ...prev, [userId]: v }));
  };

  const handleSaveAssignments = () => {
    const arr = Object.entries(localAssignments).map(([user_id, percentage]) => ({ user_id, percentage }));
    saveAssignments.mutate({ instanceId: instance.id, assignments: arr });
  };

  const initials = (name: string) => name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${status === 'connected' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-muted'}`}>
              <Smartphone className={`h-5 w-5 ${status === 'connected' ? 'text-green-600' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <p className="font-semibold text-foreground">{instance.name}</p>
              <p className="text-xs text-muted-foreground">{instance.instance_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={status === 'connected' ? 'default' : 'secondary'} className="gap-1">
              {status === 'connected' ? <><CheckCircle2 className="h-3 w-3" />Online</> : <><XCircle className="h-3 w-3" />Offline</>}
            </Badge>
            <Button variant="ghost" size="icon" onClick={handleDelete} disabled={deleting} className="text-destructive h-8 w-8">
              {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            </Button>
          </div>
        </div>

        {/* QR Code area (only when disconnected) */}
        {status === 'disconnected' && (
          <div className="flex flex-col items-center gap-3 pt-2">
            {qrCode ? (
              <>
                <img src={qrCode} alt="QR Code" className="w-48 h-48 rounded-xl border-2 border-primary/20" />
                <p className="text-[10px] text-muted-foreground">Atualiza a cada 30s</p>
                <Button variant="outline" size="sm" onClick={fetchQr} disabled={qrLoading} className="gap-1">
                  {qrLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  Atualizar
                </Button>
              </>
            ) : (
              <Button onClick={startQr} disabled={qrLoading} className="gap-2">
                {qrLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                Gerar QR Code
              </Button>
            )}
          </div>
        )}

        {/* Assigned users */}
        <div className="border-t pt-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-foreground flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              Vendedores ({assignedProfiles.length})
            </h3>
            <div className="flex gap-1">
              {unassignedProfiles.length > 0 && (
                <Dialog open={showAssign} onOpenChange={setShowAssign}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1 h-7 text-xs">
                      <Plus className="h-3 w-3" />Adicionar
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-sm">
                    <DialogHeader><DialogTitle>Adicionar Vendedor</DialogTitle></DialogHeader>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {unassignedProfiles.map((p) => (
                        <Button key={p.id} variant="ghost" className="w-full justify-start gap-2" onClick={() => { addUser(p.id); setShowAssign(false); }}>
                          <Avatar className="h-6 w-6"><AvatarFallback className="text-[10px] bg-primary/10 text-primary">{initials(p.full_name)}</AvatarFallback></Avatar>
                          {p.full_name}
                        </Button>
                      ))}
                    </div>
                  </DialogContent>
                </Dialog>
              )}
              {assignedProfiles.length > 0 && (
                <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={handleSaveAssignments} disabled={saveAssignments.isPending}>
                  {saveAssignments.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  Salvar
                </Button>
              )}
            </div>
          </div>

          {assignedProfiles.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">Nenhum vendedor vinculado</p>
          ) : (
            <div className="space-y-3">
              {assignedProfiles.map((p) => (
                <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">{initials(p.full_name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{p.full_name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Slider
                        value={[localAssignments[p.id] || 0]}
                        onValueChange={(v) => setPct(p.id, v[0])}
                        max={100} min={0} step={5}
                        className="flex-1"
                      />
                      <span className="text-xs font-bold text-primary w-10 text-right">{localAssignments[p.id] || 0}%</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeUser(p.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              {/* Total indicator */}
              <div className={`text-xs font-medium text-center py-1 rounded ${totalPct === 100 ? 'text-green-600 bg-green-50 dark:bg-green-900/20' : 'text-amber-600 bg-amber-50 dark:bg-amber-900/20'}`}>
                Total: {totalPct}% {totalPct === 100 ? '✅' : `⚠️ (faltam ${100 - totalPct}%)`}
              </div>
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
      })();
      if (result.error) throw new Error(result.error);
      toast({ title: 'Instância criada!' });
      onCreated();
      setOpen(false);
      setName('');
      setInstanceName('');
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
    setCreating(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Plus className="h-4 w-4" />Novo Número</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Conectar Novo Número</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome (identificação)</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: WhatsApp Vendas" /></div>
          <div><Label>Nome da Instância</Label><Input value={instanceName} onChange={(e) => setInstanceName(e.target.value)} placeholder="Ex: vendas01" /></div>
          <Button onClick={handleCreate} disabled={creating} className="w-full gap-2">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Criar Instância
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ──

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
          <h1 className="text-2xl font-bold text-foreground">Conexão WhatsApp</h1>
          <p className="text-muted-foreground text-sm">
            Conecte números de WhatsApp e distribua vendedores por porcentagem
          </p>
        </div>
        <NewInstanceDialog onCreated={() => refetch()} />
      </div>

      {(!instances || instances.length === 0) ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
            <MessageSquare className="h-12 w-12 text-muted-foreground/30" />
            <p className="text-muted-foreground text-sm">Nenhum número conectado</p>
            <p className="text-xs text-muted-foreground">Clique em "Novo Número" para conectar via QR Code</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong>Como funciona:</strong> Conecte um ou mais números via QR Code. Para cada número, adicione
            vendedores e defina a porcentagem de leads que cada um receberá. O total deve somar 100%.
            Na página de Distribuição, os leads serão atribuídos automaticamente conforme as porcentagens configuradas.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}