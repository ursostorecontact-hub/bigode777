import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, TrendingUp, CheckSquare, DollarSign, ArrowUp, ArrowDown } from 'lucide-react';
import { formatCurrency } from '@/types/crm';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend } from 'recharts';

const kpis = [
  { title: 'Total de Leads', value: '284', change: '+12%', up: true, icon: Users, color: 'bg-primary/10 text-primary' },
  { title: 'Conversões do Mês', value: '32', change: '+8%', up: true, icon: TrendingUp, color: 'bg-success/10 text-success' },
  { title: 'Tarefas Abertas', value: '18', change: '-3', up: false, icon: CheckSquare, color: 'bg-warning/10 text-warning' },
  { title: 'Receita Mensal', value: formatCurrency(127500), change: '+15%', up: true, icon: DollarSign, color: 'bg-primary/10 text-primary' },
];

const funnelData = [
  { name: 'Novo', value: 120 },
  { name: 'Contactado', value: 85 },
  { name: 'Negociando', value: 52 },
  { name: 'Proposta', value: 28 },
  { name: 'Ganho', value: 18 },
];

const monthlyData = [
  { mes: 'Jan', recebidos: 45, convertidos: 12 },
  { mes: 'Fev', recebidos: 52, convertidos: 15 },
  { mes: 'Mar', recebidos: 38, convertidos: 10 },
  { mes: 'Abr', recebidos: 65, convertidos: 22 },
  { mes: 'Mai', recebidos: 58, convertidos: 18 },
  { mes: 'Jun', recebidos: 72, convertidos: 28 },
];

const topSellers = [
  { name: 'Ana Silva', leads: 45, convertidos: 12, taxa: '26.7%' },
  { name: 'Carlos Santos', leads: 38, convertidos: 10, taxa: '26.3%' },
  { name: 'Maria Oliveira', leads: 42, convertidos: 9, taxa: '21.4%' },
  { name: 'João Lima', leads: 35, convertidos: 7, taxa: '20.0%' },
];

const activities = [
  { text: 'Ana Silva converteu o lead "Tech Solutions"', time: 'Há 2 horas' },
  { text: 'Novo lead "StartUp X" recebido via Website', time: 'Há 3 horas' },
  { text: 'Carlos Santos completou tarefa de follow-up', time: 'Há 5 horas' },
  { text: 'Lead "Empresa Y" movido para Negociando', time: 'Há 6 horas' },
  { text: 'Maria Oliveira adicionou nota em "Corp Z"', time: 'Há 8 horas' },
];

export default function DashboardPage() {
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
                <span className={`text-xs font-medium flex items-center gap-0.5 ${kpi.up ? 'text-success' : 'text-destructive'}`}>
                  {kpi.up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                  {kpi.change}
                </span>
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
            <CardTitle className="text-base">Top Vendedores do Mês</CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Atividades Recentes</CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
