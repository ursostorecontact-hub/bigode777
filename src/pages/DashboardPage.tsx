import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, TrendingUp, CheckSquare, DollarSign, ArrowUp, ArrowDown, Loader2, Bell, BellOff } from 'lucide-react';
import { formatCurrency } from '@/types/crm';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend } from 'recharts';
import { useLeads, useTasks, useProfiles } from '@/hooks/use-leads';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Switch } from '@/components/ui/switch';

export default function DashboardPage() {
  const { data: leads, isLoading: leadsLoading } = useLeads();
  const { data: tasks } = useTasks();
  const { data: profiles } = useProfiles();
  const queryClient = useQueryClient();
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    const saved = localStorage.getItem('whatsapp-notifications');
    return saved !== 'false';
  });

  useEffect(() => {
    localStorage.setItem('whatsapp-notifications', String(notificationsEnabled));
  }, [notificationsEnabled]);

  useEffect(() => {
    const channel = supabase
      .channel('new-whatsapp-leads')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'leads' },
        (payload) => {
          const newLead = payload.new as any;
          if (notificationsEnabled && newLead.source === 'WhatsApp') {
            toast.success('Novo lead via WhatsApp!', {
              description: `${newLead.name} — ${newLead.phone || 'Sem telefone'}`,
              duration: 8000,
            });
          }
          queryClient.invalidateQueries({ queryKey: ['leads'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, notificationsEnabled]);

  if (leadsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const allLeads = leads || [];
  const allTasks = tasks || [];
  const allProfiles = profiles || [];

  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  const leadsThisMonth = allLeads.filter(l => {
    const d = new Date(l.created_at);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  });

  const conversionsThisMonth = allLeads.filter(l => {
    const d = new Date(l.updated_at);
    return l.status === 'ganho' && d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  });

  const openTasks = allTasks.filter(t => t.status === 'pendente').length;
  const monthlyRevenue = conversionsThisMonth.reduce((s, l) => s + Number(l.value), 0);

  const kpis = [
    { title: 'Total de Leads', value: String(allLeads.length), icon: Users, color: 'bg-primary/10 text-primary' },
    { title: 'Conversões do Mês', value: String(conversionsThisMonth.length), icon: TrendingUp, color: 'bg-success/10 text-success' },
    { title: 'Tarefas Abertas', value: String(openTasks), icon: CheckSquare, color: 'bg-warning/10 text-warning' },
    { title: 'Receita Mensal', value: formatCurrency(monthlyRevenue), icon: DollarSign, color: 'bg-primary/10 text-primary' },
  ];

  // Funnel data from pipeline_stage counts
  const stageOrder = ['novo', 'contactado', 'negociando', 'proposta_enviada', 'ganho'];
  const stageLabels: Record<string, string> = { novo: 'Novo', contactado: 'Contactado', negociando: 'Negociando', proposta_enviada: 'Proposta', ganho: 'Ganho' };
  const funnelData = stageOrder.map(s => ({
    name: stageLabels[s] || s,
    value: allLeads.filter(l => l.pipeline_stage === s).length,
  }));

  // Monthly data (last 6 months)
  const monthlyData = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(thisYear, thisMonth - i, 1);
    const m = d.getMonth();
    const y = d.getFullYear();
    const monthName = d.toLocaleString('pt-BR', { month: 'short' }).replace('.', '');
    const received = allLeads.filter(l => { const ld = new Date(l.created_at); return ld.getMonth() === m && ld.getFullYear() === y; }).length;
    const converted = allLeads.filter(l => { const ld = new Date(l.updated_at); return l.status === 'ganho' && ld.getMonth() === m && ld.getFullYear() === y; }).length;
    monthlyData.push({ mes: monthName.charAt(0).toUpperCase() + monthName.slice(1), recebidos: received, convertidos: converted });
  }

  // Top sellers
  const profileMap = Object.fromEntries(allProfiles.map(p => [p.id, p.full_name]));
  const sellerStats: Record<string, { name: string; leads: number; convertidos: number }> = {};
  allLeads.forEach(l => {
    if (!l.assigned_to) return;
    if (!sellerStats[l.assigned_to]) sellerStats[l.assigned_to] = { name: profileMap[l.assigned_to] || 'Desconhecido', leads: 0, convertidos: 0 };
    sellerStats[l.assigned_to].leads++;
    if (l.status === 'ganho') sellerStats[l.assigned_to].convertidos++;
  });
  const topSellers = Object.values(sellerStats)
    .map(s => ({ ...s, taxa: s.leads > 0 ? ((s.convertidos / s.leads) * 100).toFixed(1) + '%' : '0%' }))
    .sort((a, b) => b.convertidos - a.convertidos)
    .slice(0, 5);

  // Recent activities (last 10 leads by updated_at)
  const activities = allLeads
    .slice(0, 8)
    .map(l => {
      const assignee = l.assigned_to ? profileMap[l.assigned_to] || '' : '';
      const ago = getTimeAgo(l.updated_at);
      return {
        text: `Lead "${l.name}" - ${l.status === 'ganho' ? 'Convertido' : l.status === 'novo' ? 'Novo lead recebido' : `Status: ${l.status}`}${assignee ? ` (${assignee})` : ''}`,
        time: ago,
      };
    });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Visão geral do seu CRM</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.title} className="hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${kpi.color}`}>
                  <kpi.icon className="h-5 w-5" />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{kpi.title}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Funil de Conversão</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={funnelData} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={80} />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(221, 83%, 53%)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Leads Recebidos vs Convertidos</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="recebidos" stroke="hsl(221, 83%, 53%)" name="Recebidos" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="convertidos" stroke="hsl(142, 76%, 36%)" name="Convertidos" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Vendedores</CardTitle>
          </CardHeader>
          <CardContent>
            {topSellers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum vendedor com leads atribuídos ainda.</p>
            ) : (
              <div className="space-y-3">
                {topSellers.map((seller, i) => (
                  <div key={seller.name} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="h-8 w-8 rounded-full gradient-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{seller.name}</p>
                      <p className="text-xs text-muted-foreground">{seller.leads} leads · {seller.convertidos} conversões</p>
                    </div>
                    <span className="text-sm font-semibold text-success">{seller.taxa}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Atividades Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {activities.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma atividade recente.</p>
            ) : (
              <div className="space-y-3">
                {activities.map((activity, i) => (
                  <div key={i} className="flex gap-3 p-2">
                    <div className="h-2 w-2 rounded-full bg-primary mt-2 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm text-foreground">{activity.text}</p>
                      <p className="text-xs text-muted-foreground">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `Há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Há ${days}d`;
}
