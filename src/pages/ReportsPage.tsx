import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';
import { Loader2 } from 'lucide-react';
import { useLeads, useProfiles } from '@/hooks/use-leads';
import { formatCurrency } from '@/types/crm';

const COLORS = ['hsl(221, 83%, 53%)', 'hsl(280, 67%, 55%)', 'hsl(142, 76%, 36%)', 'hsl(38, 92%, 50%)', 'hsl(215, 16%, 47%)'];

export default function ReportsPage() {
  const { data: leads, isLoading } = useLeads();
  const { data: profiles } = useProfiles();

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const allLeads = leads || [];
  const allProfiles = profiles || [];
  const profileMap = Object.fromEntries(allProfiles.map(p => [p.id, p.full_name]));

  // Leads by source
  const sourceMap: Record<string, number> = {};
  allLeads.forEach(l => { sourceMap[l.source] = (sourceMap[l.source] || 0) + 1; });
  const leadsBySource = Object.entries(sourceMap).map(([name, value], i) => ({
    name, value, color: COLORS[i % COLORS.length],
  }));

  // Leads by status
  const statusMap: Record<string, number> = {};
  const statusLabels: Record<string, string> = { novo: 'Novo', contactado: 'Contactado', negociando: 'Negociando', proposta_enviada: 'Proposta', ganho: 'Ganho', perdido: 'Perdido' };
  allLeads.forEach(l => { statusMap[l.status] = (statusMap[l.status] || 0) + 1; });
  const leadsByStatus = Object.entries(statusMap).map(([key, value]) => ({
    name: statusLabels[key] || key, value,
  }));

  // Conversion rate by seller
  const sellerStats: Record<string, { name: string; leads: number; convertidos: number }> = {};
  allLeads.forEach(l => {
    if (!l.assigned_to) return;
    if (!sellerStats[l.assigned_to]) sellerStats[l.assigned_to] = { name: profileMap[l.assigned_to] || 'Desconhecido', leads: 0, convertidos: 0 };
    sellerStats[l.assigned_to].leads++;
    if (l.status === 'ganho') sellerStats[l.assigned_to].convertidos++;
  });
  const conversionBySeller = Object.values(sellerStats).map(s => ({
    name: s.name,
    taxa: s.leads > 0 ? Number(((s.convertidos / s.leads) * 100).toFixed(1)) : 0,
  }));

  // Monthly revenue (last 6 months)
  const now = new Date();
  const revenueMonthly = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const m = d.getMonth();
    const y = d.getFullYear();
    const monthName = d.toLocaleString('pt-BR', { month: 'short' }).replace('.', '');
    const receita = allLeads
      .filter(l => {
        if (l.status !== 'ganho') return false;
        const ld = new Date(l.updated_at);
        return ld.getMonth() === m && ld.getFullYear() === y;
      })
      .reduce((s, l) => s + Number(l.value), 0);
    revenueMonthly.push({ mes: monthName.charAt(0).toUpperCase() + monthName.slice(1), receita });
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
        <p className="text-muted-foreground text-sm">Análise detalhada de desempenho</p>
      </div>

      {allLeads.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">Nenhum dado disponível. Adicione leads para ver os relatórios.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Leads por Origem</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={leadsBySource} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50} paddingAngle={2} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {leadsBySource.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Leads por Status</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={leadsByStatus}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(221, 83%, 53%)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Taxa de Conversão por Vendedor</CardTitle></CardHeader>
            <CardContent>
              {conversionBySeller.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum vendedor com leads.</p>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={conversionBySeller} layout="vertical">
                    <XAxis type="number" tick={{ fontSize: 11 }} unit="%" />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={100} />
                    <Tooltip formatter={(value: number) => `${value}%`} />
                    <Bar dataKey="taxa" fill="hsl(142, 76%, 36%)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Tendência de Receita Mensal</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={revenueMonthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Line type="monotone" dataKey="receita" stroke="hsl(221, 83%, 53%)" strokeWidth={2} dot={{ r: 4 }} name="Receita" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
