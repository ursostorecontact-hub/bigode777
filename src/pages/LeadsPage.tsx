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
import { Plus, Search, Filter, Download, Upload, MessageCircle, Pencil, Trash2, Loader2 } from 'lucide-react';
import { formatCurrency, formatDate, type LeadStatus, PIPELINE_STAGES, LEAD_SOURCES } from '@/types/crm';
import { useLeads, useCreateLead, useUpdateLead, useDeleteLead, useProfiles } from '@/hooks/use-leads';
import { useAuth } from '@/contexts/AuthContext';

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

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editLead, setEditLead] = useState<any>(null);

  // Form state
  const [form, setForm] = useState({ name: '', phone: '', email: '', source: 'Website', value: '', notes: '', assigned_to: '' });

  const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name]));

  const allLeads = leads || [];
  const filtered = allLeads.filter((lead) => {
    const matchesSearch = lead.name.toLowerCase().includes(search.toLowerCase()) ||
      (lead.phone || '').includes(search) ||
      (lead.email || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4 mr-1" />Exportar</Button>
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
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="hidden md:table-cell">Telefone</TableHead>
                  <TableHead className="hidden lg:table-cell">Origem</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Responsável</TableHead>
                  <TableHead className="hidden lg:table-cell">Valor</TableHead>
                  <TableHead className="hidden lg:table-cell">Criado em</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum lead encontrado. Clique em "Novo Lead" para começar.</TableCell></TableRow>
                ) : filtered.map((lead) => {
                  const sc = statusConfig[lead.status] || { label: lead.status, variant: 'outline' as const };
                  return (
                    <TableRow key={lead.id} className="hover:bg-muted/30">
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
                          {lead.phone && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="WhatsApp" asChild>
                              <a href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
                                <MessageCircle className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar" onClick={() => openEdit(lead)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Excluir" onClick={() => setDeleteId(lead.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
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
    </div>
  );
}
