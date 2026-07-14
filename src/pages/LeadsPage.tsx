import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Search, Filter, Download, MessageCircle, Pencil, Trash2, Loader2, ArrowRightLeft, Users, Tag, Settings2, ShoppingBag } from 'lucide-react';
import { formatCurrency, formatDate, type LeadStatus, PIPELINE_STAGES, LEAD_SOURCES } from '@/types/crm';
import { useLeads, useCreateLead, useUpdateLead, useDeleteLead, useProfiles, useMarkLeadAsPurchased } from '@/hooks/use-leads';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useLabels, useLabelAssignments, useAssignLabel, useUnassignLabel } from '@/hooks/use-labels';
import { LabelManagerDialog, LabelAssignPopover, LabelBadges } from '@/components/LabelManager';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  novo: { label: 'Novo', variant: 'default' },
  contactado: { label: 'Contactado', variant: 'secondary' },
  negociando: { label: 'Negociando', variant: 'outline' },
  proposta_enviada: { label: 'Proposta Enviada', variant: 'outline' },
  ganho: { label: 'Ganho', variant: 'default' },
  perdido: { label: 'Perdido', variant: 'destructive' },
};

export default function LeadsPage() {
  const { user } = useAuth();
  const { data: leads, isLoading } = useLeads();
  const { data: profiles } = useProfiles();
  const createLead = useCreateLead();
  const updateLead = useUpdateLead();
  const deleteLead = useDeleteLead();
  const markAsPurchased = useMarkLeadAsPurchased();
  const queryClient = useQueryClient();
  const { data: labels } = useLabels();
  const { data: leadAssignments } = useLabelAssignments('lead');
  const assignLabel = useAssignLabel();
  const unassignLabel = useUnassignLabel();
  const [purchaseTarget, setPurchaseTarget] = useState<any | null>(null);
  const [purchaseValue, setPurchaseValue] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [labelFilter, setLabelFilter] = useState<string | null>(null);
  const [showLabelManager, setShowLabelManager] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editLead, setEditLead] = useState<any>(null);

  // Selection state
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());

  // Transfer dialogs
  const [transferAllOpen, setTransferAllOpen] = useState(false);
  const [transferSelectedOpen, setTransferSelectedOpen] = useState(false);
  const [transferFromSeller, setTransferFromSeller] = useState('');
  const [transferToSeller, setTransferToSeller] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);

  // Form state
  const [form, setForm] = useState({ name: '', phone: '', email: '', source: 'Website', value: '', notes: '', assigned_to: '' });

  const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name]));

  const allLeads = leads || [];
  const baseFiltered = allLeads.filter((lead) => {
    const matchesSearch = lead.name.toLowerCase().includes(search.toLowerCase()) ||
      (lead.phone || '').includes(search) ||
      (lead.email || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
    return matchesSearch && matchesStatus;
  });
  const filtered = labelFilter
    ? baseFiltered.filter((lead) => (leadAssignments || []).some((a) => a.lead_id === lead.id && a.label_id === labelFilter))
    : baseFiltered;

  const resetForm = () => setForm({ name: '', phone: '', email: '', source: 'Website', value: '', notes: '', assigned_to: '' });

  const handleSave = async () => {
    if (!form.name.trim()) return;
    const payload = {
      name: form.name,
      phone: form.phone || null,
      email: form.email || null,
      source: form.source,
      value: Number(form.value) || 0,
      notes: form.notes || null,
      assigned_to: form.assigned_to || (user?.id ?? null),
    };

    if (editLead) {
      await updateLead.mutateAsync({ id: editLead.id, ...payload });
      setEditLead(null);
    } else {
      await createLead.mutateAsync(payload);
    }
    resetForm();
    setIsAddOpen(false);
  };

  const openEdit = (lead: any) => {
    setForm({
      name: lead.name,
      phone: lead.phone || '',
      email: lead.email || '',
      source: lead.source,
      value: String(lead.value),
      notes: lead.notes || '',
      assigned_to: lead.assigned_to || '',
    });
    setEditLead(lead);
    setIsAddOpen(true);
  };

  const handleExport = () => {
    const headers = ['Nome', 'Telefone', 'Email', 'Origem', 'Status', 'Valor', 'Criado em'];
    const rows = allLeads.map(l => [l.name, l.phone, l.email, l.source, l.status, l.value, l.created_at]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'leads.csv';
    a.click();
  };

  // Toggle lead selection
  const toggleSelect = (id: string) => {
    setSelectedLeads(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedLeads.size === filtered.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(filtered.map(l => l.id)));
    }
  };

  // Transfer ALL leads from one seller to another
  const handleTransferAll = async () => {
    if (!transferFromSeller || !transferToSeller || transferFromSeller === transferToSeller) {
      toast.error('Selecione vendedores diferentes');
      return;
    }
    setIsTransferring(true);
    try {
      const leadsToTransfer = allLeads.filter(l => l.assigned_to === transferFromSeller);
      if (leadsToTransfer.length === 0) {
        toast.error('Este vendedor não possui leads');
        setIsTransferring(false);
        return;
      }
      const promises = leadsToTransfer.map(l =>
        supabase.from('leads').update({ assigned_to: transferToSeller }).eq('id', l.id)
      );
      await Promise.all(promises);
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success(`${leadsToTransfer.length} leads transferidos com sucesso!`);
      setTransferAllOpen(false);
      setTransferFromSeller('');
      setTransferToSeller('');
    } catch {
      toast.error('Erro ao transferir leads');
    }
    setIsTransferring(false);
  };

  // Transfer selected leads to another seller
  const handleTransferSelected = async () => {
    if (!transferToSeller) {
      toast.error('Selecione o vendedor de destino');
      return;
    }
    if (selectedLeads.size === 0) {
      toast.error('Nenhum lead selecionado');
      return;
    }
    setIsTransferring(true);
    try {
      const promises = Array.from(selectedLeads).map(id =>
        supabase.from('leads').update({ assigned_to: transferToSeller }).eq('id', id)
      );
      await Promise.all(promises);
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success(`${selectedLeads.size} leads transferidos com sucesso!`);
      setTransferSelectedOpen(false);
      setTransferToSeller('');
      setSelectedLeads(new Set());
    } catch {
      toast.error('Erro ao transferir leads');
    }
    setIsTransferring(false);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Leads</h1>
          <p className="text-muted-foreground text-sm">{filtered.length} leads encontrados</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4 mr-1" />Exportar</Button>
          <Button variant="outline" size="sm" onClick={() => setShowLabelManager(true)}><Settings2 className="h-4 w-4 mr-1" />Etiquetas</Button>

          {/* Transfer ALL leads */}
          <Dialog open={transferAllOpen} onOpenChange={setTransferAllOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm"><Users className="h-4 w-4 mr-1" />Transferir Todos</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Transferir Todos os Leads de um Vendedor</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>De (vendedor atual)</Label>
                  <Select value={transferFromSeller} onValueChange={v => setTransferFromSeller(v)}>
                    <SelectTrigger><SelectValue placeholder="Selecionar vendedor de origem" /></SelectTrigger>
                    <SelectContent>
                      {(profiles || []).map(p => {
                        const count = allLeads.filter(l => l.assigned_to === p.id).length;
                        return <SelectItem key={p.id} value={p.id}>{p.full_name} ({count} leads)</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Para (novo vendedor)</Label>
                  <Select value={transferToSeller} onValueChange={v => setTransferToSeller(v)}>
                    <SelectTrigger><SelectValue placeholder="Selecionar vendedor de destino" /></SelectTrigger>
                    <SelectContent>
                      {(profiles || []).filter(p => p.id !== transferFromSeller).map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {transferFromSeller && (
                  <p className="text-sm text-muted-foreground">
                    {allLeads.filter(l => l.assigned_to === transferFromSeller).length} leads serão transferidos.
                  </p>
                )}
                <Button onClick={handleTransferAll} disabled={isTransferring || !transferFromSeller || !transferToSeller}>
                  {isTransferring && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Transferir Todos
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Transfer SELECTED leads */}
          <Dialog open={transferSelectedOpen} onOpenChange={v => { setTransferSelectedOpen(v); if (!v) setTransferToSeller(''); }}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={selectedLeads.size === 0}>
                <ArrowRightLeft className="h-4 w-4 mr-1" />
                Transferir Selecionados{selectedLeads.size > 0 && ` (${selectedLeads.size})`}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Transferir Leads Selecionados</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <p className="text-sm text-muted-foreground">
                  {selectedLeads.size} lead{selectedLeads.size > 1 ? 's' : ''} selecionado{selectedLeads.size > 1 ? 's' : ''}.
                </p>
                <div className="space-y-2">
                  <Label>Novo responsável</Label>
                  <Select value={transferToSeller} onValueChange={v => setTransferToSeller(v)}>
                    <SelectTrigger><SelectValue placeholder="Selecionar vendedor de destino" /></SelectTrigger>
                    <SelectContent>
                      {(profiles || []).map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleTransferSelected} disabled={isTransferring || !transferToSeller}>
                  {isTransferring && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Transferir {selectedLeads.size} Lead{selectedLeads.size > 1 ? 's' : ''}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) { setEditLead(null); resetForm(); } }}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" />Novo Lead</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editLead ? 'Editar Lead' : 'Adicionar Novo Lead'}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Nome *</Label>
                    <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome da empresa ou contato" />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(00) 00000-0000" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>E-mail</Label>
                    <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@empresa.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>Origem</Label>
                    <Select value={form.source} onValueChange={v => setForm(f => ({ ...f, source: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {LEAD_SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Valor estimado (R$)</Label>
                    <Input type="number" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} placeholder="0" />
                  </div>
                  <div className="space-y-2">
                    <Label>Responsável</Label>
                    <Select value={form.assigned_to} onValueChange={v => setForm(f => ({ ...f, assigned_to: v }))}>
                      <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                      <SelectContent>
                        {(profiles || []).map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notas sobre o lead..." />
                </div>
                <Button onClick={handleSave} disabled={createLead.isPending || updateLead.isPending}>
                  {(createLead.isPending || updateLead.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editLead ? 'Atualizar Lead' : 'Salvar Lead'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por nome, telefone ou e-mail..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                {PIPELINE_STAGES.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {/* Label filter tabs */}
          {(labels || []).length > 0 && (
            <div className="flex gap-1 items-center overflow-x-auto pt-2">
              <button
                onClick={() => setLabelFilter(null)}
                className={`shrink-0 text-xs px-2.5 py-1 rounded-full transition-colors ${!labelFilter ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
              >
                Todas
              </button>
              {(labels || []).map((label) => (
                <button
                  key={label.id}
                  onClick={() => setLabelFilter(label.id === labelFilter ? null : label.id)}
                  className="shrink-0 text-xs px-2.5 py-1 rounded-full transition-colors flex items-center gap-1"
                  style={{
                    backgroundColor: label.id === labelFilter ? label.color : label.color + '20',
                    color: label.id === labelFilter ? '#fff' : label.color,
                  }}
                >
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: label.id === labelFilter ? '#fff' : label.color }} />
                  {label.name}
                </button>
              ))}
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={filtered.length > 0 && selectedLeads.size === filtered.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead className="hidden md:table-cell">Telefone</TableHead>
                  <TableHead className="hidden lg:table-cell">Origem</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Responsável</TableHead>
                  <TableHead className="hidden lg:table-cell">Valor</TableHead>
                  <TableHead className="hidden lg:table-cell">Criado em</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                  <TableHead className="w-[40px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhum lead encontrado. Clique em "Novo Lead" para começar.</TableCell></TableRow>
                ) : filtered.map((lead) => {
                  const sc = statusConfig[lead.status] || { label: lead.status, variant: 'outline' as const };
                  const isSelected = selectedLeads.has(lead.id);
                  return (
                    <TableRow key={lead.id} className={`hover:bg-muted/30 ${isSelected ? 'bg-primary/5' : ''}`}>
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(lead.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">{lead.name}</p>
                          <p className="text-xs text-muted-foreground md:hidden">{lead.phone}</p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">{lead.phone}</TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">{lead.source}</TableCell>
                      <TableCell>
                        <Badge variant={sc.variant} className={lead.status === 'ganho' ? 'bg-success text-success-foreground' : ''}>
                          {sc.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">{lead.assigned_to ? profileMap[lead.assigned_to] || '—' : '—'}</TableCell>
                      <TableCell className="hidden lg:table-cell font-medium">{formatCurrency(Number(lead.value))}</TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">{formatDate(lead.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <LabelBadges labelIds={(leadAssignments || []).filter(a => a.lead_id === lead.id).map(a => a.label_id)} labels={labels || []} />
                          {lead.phone && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="WhatsApp" asChild>
                              <a href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
                                <MessageCircle className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-success hover:text-success"
                            title="Marcar como Comprou"
                            onClick={() => { setPurchaseTarget(lead); setPurchaseValue(String(lead.value || '')); }}
                          >
                            <ShoppingBag className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar" onClick={() => openEdit(lead)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Excluir" onClick={() => setDeleteId(lead.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <LabelAssignPopover
                          leadId={lead.id}
                          currentAssignments={(leadAssignments || []).filter(a => a.lead_id === lead.id).map(a => a.label_id)}
                          onAssign={(labelId) => assignLabel.mutate({ labelId, leadId: lead.id })}
                          onUnassign={(labelId) => unassignLabel.mutate({ labelId, leadId: lead.id })}
                        >
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Etiquetar">
                            <Tag className="h-4 w-4" />
                          </Button>
                        </LabelAssignPopover>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lead?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita. O lead será removido permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteId) { deleteLead.mutate(deleteId); setDeleteId(null); } }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!purchaseTarget} onOpenChange={(open) => { if (!open) setPurchaseTarget(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-success" />
              Marcar como Comprou
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              {purchaseTarget?.name} vai virar um cliente (comprador). O valor informado é enviado
              automaticamente para o Facebook, se as credenciais estiverem configuradas em Audiências Facebook.
            </p>
            <div className="space-y-2">
              <Label>Valor da compra (R$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={purchaseValue}
                onChange={(e) => setPurchaseValue(e.target.value)}
                placeholder="0,00"
                autoFocus
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPurchaseTarget(null)}>Cancelar</Button>
            <Button
              className="bg-success text-success-foreground hover:bg-success/90"
              disabled={markAsPurchased.isPending || !purchaseValue}
              onClick={() => {
                markAsPurchased.mutate(
                  { lead: purchaseTarget, value: parseFloat(purchaseValue) || 0 },
                  { onSuccess: () => setPurchaseTarget(null) }
                );
              }}
            >
              {markAsPurchased.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar Compra
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <LabelManagerDialog open={showLabelManager} onOpenChange={setShowLabelManager} />
    </div>
  );
}
