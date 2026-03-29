import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Users, ArrowRight, AlertTriangle, Loader2, Shuffle, BarChart3, Percent } from 'lucide-react';
import { useLeads, useProfiles, useUpdateLead } from '@/hooks/use-leads';
import { formatCurrency } from '@/types/crm';
import { useToast } from '@/hooks/use-toast';

type DistributionMode = 'manual' | 'round-robin' | 'capacity' | 'percentage';

export default function DistributionPage() {
  const { data: leads, isLoading } = useLeads();
  const { data: profiles } = useProfiles();
  const updateLead = useUpdateLead();
  const { toast } = useToast();
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<DistributionMode>('manual');
  const [distributing, setDistributing] = useState(false);
  const [percentages, setPercentages] = useState<Record<string, number>>({});

  const allLeads = leads || [];
  const allProfiles = profiles || [];

  const unassigned = allLeads.filter(l => !l.assigned_to && l.status !== 'ganho' && l.status !== 'perdido');

  // Initialize percentages when profiles load
  useMemo(() => {
    if (allProfiles.length > 0 && Object.keys(percentages).length === 0) {
      const equal = Math.floor(100 / allProfiles.length);
      const remainder = 100 - equal * allProfiles.length;
      const init: Record<string, number> = {};
      allProfiles.forEach((p, i) => {
        init[p.id] = equal + (i === 0 ? remainder : 0);
      });
      setPercentages(init);
    }
  }, [allProfiles]);

  const totalPercentage = Object.values(percentages).reduce((s, v) => s + v, 0);

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

  const handlePercentageChange = (profileId: string, value: number[]) => {
    setPercentages(prev => ({ ...prev, [profileId]: value[0] }));
  };

  const handleAutoDistribute = async () => {
    if (unassigned.length === 0 || allProfiles.length === 0) {
      toast({ title: 'Nenhum lead para distribuir', variant: 'destructive' });
      return;
    }

    if (mode === 'percentage' && totalPercentage !== 100) {
      toast({ title: `O total deve ser 100% (atual: ${totalPercentage}%)`, variant: 'destructive' });
      return;
    }

    setDistributing(true);

    try {
      if (mode === 'round-robin') {
        for (let i = 0; i < unassigned.length; i++) {
          const profileIndex = i % allProfiles.length;
          await updateLead.mutateAsync({
            id: unassigned[i].id,
            assigned_to: allProfiles[profileIndex].id,
          });
        }
        toast({ title: `${unassigned.length} leads distribuídos por Round-Robin!` });
      } else if (mode === 'capacity') {
        const loadMap: Record<string, number> = {};
        allProfiles.forEach(p => {
          loadMap[p.id] = allLeads.filter(l => l.assigned_to === p.id && l.status !== 'ganho' && l.status !== 'perdido').length;
        });
        for (const lead of unassigned) {
          const minId = allProfiles.reduce((best, p) =>
            (loadMap[p.id] ?? 0) < (loadMap[best.id] ?? 0) ? p : best
          ).id;
          await updateLead.mutateAsync({ id: lead.id, assigned_to: minId });
          loadMap[minId] = (loadMap[minId] || 0) + 1;
        }
        toast({ title: `${unassigned.length} leads distribuídos por Capacidade!` });
      } else if (mode === 'percentage') {
        // Distribute leads proportionally based on percentages
        const sortedProfiles = allProfiles
          .map(p => ({ id: p.id, pct: percentages[p.id] || 0 }))
          .filter(p => p.pct > 0);

        if (sortedProfiles.length === 0) {
          toast({ title: 'Defina % para ao menos um vendedor', variant: 'destructive' });
          return;
        }

        // Calculate how many leads each person gets
        const totalLeads = unassigned.length;
        let distributed = 0;
        const allocation: { id: string; count: number }[] = [];

        sortedProfiles.forEach((sp, i) => {
          const isLast = i === sortedProfiles.length - 1;
          const count = isLast ? totalLeads - distributed : Math.round((sp.pct / 100) * totalLeads);
          allocation.push({ id: sp.id, count });
          distributed += count;
        });

        let leadIndex = 0;
        for (const alloc of allocation) {
          for (let i = 0; i < alloc.count && leadIndex < totalLeads; i++) {
            await updateLead.mutateAsync({
              id: unassigned[leadIndex].id,
              assigned_to: alloc.id,
            });
            leadIndex++;
          }
        }
        toast({ title: `${unassigned.length} leads distribuídos por Porcentagem!` });
      }
    } catch {
      toast({ title: 'Erro ao distribuir leads', variant: 'destructive' });
    } finally {
      setDistributing(false);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const modeDescriptions: Record<string, string> = {
    'round-robin': 'Os leads serão distribuídos igualmente entre todos os vendedores, um a um.',
    capacity: 'Os leads serão atribuídos ao vendedor com menos leads ativos no momento.',
    percentage: 'Ajuste os sliders para definir a % de leads que cada vendedor receberá. O total deve ser 100%.',
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Distribuição de Leads</h1>
          <p className="text-muted-foreground text-sm">Distribua leads entre a equipe de vendas</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={mode} onValueChange={(v) => setMode(v as DistributionMode)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Modo de distribuição" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="round-robin">Round-Robin</SelectItem>
              <SelectItem value="capacity">Por Capacidade</SelectItem>
              <SelectItem value="percentage">Por Porcentagem</SelectItem>
            </SelectContent>
          </Select>
          {mode !== 'manual' && unassigned.length > 0 && (
            <Button
              onClick={handleAutoDistribute}
              disabled={distributing || (mode === 'percentage' && totalPercentage !== 100)}
              className="gap-2"
            >
              {distributing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : mode === 'round-robin' ? (
                <Shuffle className="h-4 w-4" />
              ) : mode === 'percentage' ? (
                <Percent className="h-4 w-4" />
              ) : (
                <BarChart3 className="h-4 w-4" />
              )}
              Distribuir ({unassigned.length})
            </Button>
          )}
        </div>
      </div>

      {/* Salesperson cards */}
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

              {/* Percentage slider */}
              {mode === 'percentage' && (
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">Porcentagem</span>
                    <span className={`text-sm font-bold ${totalPercentage === 100 ? 'text-success' : 'text-warning'}`}>
                      {percentages[sp.id] || 0}%
                    </span>
                  </div>
                  <Slider
                    value={[percentages[sp.id] || 0]}
                    onValueChange={(v) => handlePercentageChange(sp.id, v)}
                    max={100}
                    min={0}
                    step={5}
                    className="w-full"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    ≈ {Math.round(((percentages[sp.id] || 0) / 100) * unassigned.length)} leads
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {salespeople.length === 0 && (
          <p className="text-muted-foreground col-span-4 text-center py-8">Nenhum vendedor cadastrado.</p>
        )}
      </div>

      {/* Percentage total indicator */}
      {mode === 'percentage' && salespeople.length > 0 && (
        <Card className={`border-2 ${totalPercentage === 100 ? 'border-success/30 bg-success/5' : 'border-warning/30 bg-warning/5'}`}>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                Total: <span className={`text-lg font-bold ${totalPercentage === 100 ? 'text-success' : 'text-warning'}`}>{totalPercentage}%</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {totalPercentage === 100
                  ? '✅ Total correto! Pronto para distribuir.'
                  : `⚠️ Ajuste os sliders para totalizar 100% (faltam ${100 - totalPercentage}%)`}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">{unassigned.length} leads para distribuir</p>
          </CardContent>
        </Card>
      )}

      {/* Mode description */}
      {mode !== 'manual' && mode !== 'percentage' && unassigned.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <p className="text-sm text-foreground">
              <strong>Modo {mode === 'round-robin' ? 'Round-Robin' : 'Por Capacidade'}:</strong>{' '}
              {modeDescriptions[mode]}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Clique em "Distribuir" acima para atribuir automaticamente {unassigned.length} lead(s).
            </p>
          </CardContent>
        </Card>
      )}

      {/* Unassigned leads */}
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
                  {mode === 'manual' && (
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
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
