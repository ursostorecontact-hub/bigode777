import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend } from 'recharts';

const leadsBySource = [
  { name: 'Website', value: 85, color: 'hsl(221, 83%, 53%)' },
  { name: 'Instagram', value: 62, color: 'hsl(280, 67%, 55%)' },
  { name: 'WhatsApp', value: 48, color: 'hsl(142, 76%, 36%)' },
  { name: 'Indicação', value: 55, color: 'hsl(38, 92%, 50%)' },
  { name: 'Outro', value: 34, color: 'hsl(215, 16%, 47%)' },
];

const conversionBySeller = [
  { name: 'Ana Silva', leads: 45, convertidos: 12, taxa: 26.7 },
  { name: 'Carlos Santos', leads: 38, convertidos: 10, taxa: 26.3 },
  { name: 'Maria Oliveira', leads: 42, convertidos: 9, taxa: 21.4 },
  { name: 'João Lima', leads: 35, convertidos: 7, taxa: 20.0 },
];

const revenueMonthly = [
  { mes: 'Jan', receita: 45000 },
  { mes: 'Fev', receita: 52000 },
  { mes: 'Mar', receita: 38000 },
  { mes: 'Abr', receita: 65000 },
  { mes: 'Mai', receita: 78000 },
  { mes: 'Jun', receita: 127500 },
];

const leadsByStatus = [
  { name: 'Novo', value: 120 },
  { name: 'Contactado', value: 85 },
  { name: 'Negociando', value: 52 },
  { name: 'Proposta', value: 28 },
  { name: 'Ganho', value: 32 },
  { name: 'Perdido', value: 18 },
];

export default function ReportsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
        <p className="text-muted-foreground text-sm">Análise detalhada de desempenho</p>
      </div>

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
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={conversionBySeller} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 11 }} unit="%" />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={100} />
                <Tooltip formatter={(value: number) => `${value}%`} />
                <Bar dataKey="taxa" fill="hsl(142, 76%, 36%)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
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
                <Tooltip formatter={(value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)} />
                <Line type="monotone" dataKey="receita" stroke="hsl(221, 83%, 53%)" strokeWidth={2} dot={{ r: 4 }} name="Receita" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
