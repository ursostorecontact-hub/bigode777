import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, ArrowRight, AlertTriangle } from 'lucide-react';

const salespeople = [
  { name: 'Ana Silva', leads: 18, closed: 12, avatar: 'AS' },
  { name: 'Carlos Santos', leads: 22, closed: 10, avatar: 'CS' },
  { name: 'Maria Oliveira', leads: 15, closed: 9, avatar: 'MO' },
  { name: 'João Lima', leads: 8, closed: 7, avatar: 'JL' },
];

const unassignedLeads = [
  { id: '1', name: 'Nova Empresa SA', source: 'Website', value: 'R$ 12.000' },
  { id: '2', name: 'StartUp ABC', source: 'Instagram', value: 'R$ 5.500' },
  { id: '3', name: 'Comércio XYZ', source: 'WhatsApp', value: 'R$ 8.000' },
];

export default function DistributionPage() {
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
          <Card key={sp.name} className={`transition-all hover:shadow-md ${sp.leads > 20 ? 'border-destructive/30' : ''}`}>
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
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-muted/50 rounded-lg p-2">
                  <p className="text-lg font-bold text-foreground">{sp.leads}</p>
                  <p className="text-[10px] text-muted-foreground">Leads ativos</p>
                </div>
                <div className="bg-success/10 rounded-lg p-2">
                  <p className="text-lg font-bold text-success">{sp.closed}</p>
                  <p className="text-[10px] text-muted-foreground">Fechados/mês</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-warning" />
            <h2 className="font-semibold text-foreground">Leads Não Atribuídos ({unassignedLeads.length})</h2>
          </div>
          <div className="space-y-2">
            {unassignedLeads.map((lead) => (
              <div key={lead.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                <div>
                  <p className="font-medium text-sm text-foreground">{lead.name}</p>
                  <p className="text-xs text-muted-foreground">{lead.source} · {lead.value}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Select>
                    <SelectTrigger className="w-36 h-8 text-xs">
                      <SelectValue placeholder="Atribuir a..." />
                    </SelectTrigger>
                    <SelectContent>
                      {salespeople.map(sp => <SelectItem key={sp.name} value={sp.name}>{sp.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" className="h-8">
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
