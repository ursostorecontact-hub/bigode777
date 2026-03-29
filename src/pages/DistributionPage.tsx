import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, ArrowRight, AlertTriangle, Loader2 } from 'lucide-react';
import { useLeads, useProfiles, useUpdateLead } from '@/hooks/use-leads';
import { formatCurrency } from '@/types/crm';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

export default function DistributionPage() {
  const { data: leads, isLoading } = useLeads();
  const { data: profiles } = useProfiles();
  const updateLead = useUpdateLead();
  const { toast } = useToast();
  const [assignments, setAssignments] = useState<Record<string, string>>({});

  const allLeads = leads || [];
  const allProfiles = profiles || [];

  const unassigned = allLeads.filter(l => !l.assigned_to && l.status !== 'ganho' && l.status !== 'perdido');

  // Stats per salesperson
  const salespeople = allProfiles.map(p => {
    const assigned = allLeads.filter(l => l.assigned_to === p.id && l.status !== 'ganho' && l.status !== 'perdido');
    const closedThisMonth = allLeads.filter(l => {
      if (l.assigned_to !== p.id || l.status !== 'ganho') return false;
      const d = new Date(l.updated_at);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const totalAssignedEver = allLeads.filter(l => l.assigned_to === p.id).length;
    const totalWon = allLeads.filter(l => l.assigned_to === p.id && l.status === 'ganho').length;
    const conversionRate = totalAssignedEver > 0 ? Math.round((totalWon / totalAssignedEver) * 100) : 0;
    const initials = p.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    return {
      id: p.id,
      name: p.full_name,
      leads: assigned.length,
      closed: closedThisMonth.length,
      conversionRate,
      avatar: initials,
    };
  });

  const handleAssign = async (leadId: string) => {
    const targetId = assignments[leadId];
    if (!targetId) return;
    await updateLead.mutateAsync({ id: leadId, assigned_to: targetId });
    toast({ title: 'Lead atribuído com sucesso!' });
    setAssignments(a => { const c = { ...a }; delete c[leadId]; return c; });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Distribuição de Leads</h1>
          <p className="text-muted-foreground text-sm">Distribua leads entre a equipe de vendas</p>
        </div>
        <Select defaultValue="manual">
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="round-robin">Round-Robin</SelectItem>
            <SelectItem value="capacity">Por Capacidade</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {salespeople.map((sp) => (
          <Card key={sp.id} className={`transition-all hover:shadow-md ${sp.leads > 20 ? 'border-destructive/30' : ''}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">{sp.avatar}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm text-foreground">{sp.name}</p>
                  {sp.leads > 20 && (
                    <span className="text-[10px] text-destructive flex items-center gap-0.5">
                      <AlertTriangle className="h-3 w-3" />Sobrecarregado
                    </span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-muted/50 rounded-lg p-2">
                  <p className="text-lg font-bold text-foreground">{sp.leads}</p>
                  <p className="text-[10px] text-muted-foreground">Leads ativos</p>
                </div>
                <div className="bg-success/10 rounded-lg p-2">
                  <p className="text-lg font-bold text-success">{sp.closed}</p>
                  <p className="text-[10px] text-muted-foreground">Fechados/mês</p>
                </div>
                <div className="bg-primary/10 rounded-lg p-2">
                  <p className="text-lg font-bold text-primary">{sp.conversionRate}%</p>
                  <p className="text-[10px] text-muted-foreground">Conversão</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {salespeople.length === 0 && (
          <p className="text-muted-foreground col-span-4 text-center py-8">Nenhum vendedor cadastrado.</p>
        )}
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-warning" />
            <h2 className="font-semibold text-foreground">Leads Não Atribuídos ({unassigned.length})</h2>
          </div>
          {unassigned.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Todos os leads estão atribuídos!</p>
          ) : (
            <div className="space-y-2">
              {unassigned.map((lead) => (
                <div key={lead.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div>
                    <p className="font-medium text-sm text-foreground">{lead.name}</p>
                    <p className="text-xs text-muted-foreground">{lead.source} · {formatCurrency(Number(lead.value))}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={assignments[lead.id] || ''} onValueChange={v => setAssignments(a => ({ ...a, [lead.id]: v }))}>
                      <SelectTrigger className="w-36 h-8 text-xs">
                        <SelectValue placeholder="Atribuir a..." />
                      </SelectTrigger>
                      <SelectContent>
                        {allProfiles.map(sp => <SelectItem key={sp.id} value={sp.id}>{sp.full_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="outline" className="h-8" onClick={() => handleAssign(lead.id)} disabled={!assignments[lead.id]}>
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
