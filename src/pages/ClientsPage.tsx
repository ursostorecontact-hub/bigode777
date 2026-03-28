import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, UserCheck, Phone, Mail, DollarSign } from 'lucide-react';
import { formatCurrency, formatDate } from '@/types/crm';
import { useState } from 'react';

const mockClients = [
  { id: '1', name: 'Consultoria Elite', phone: '51954321098', email: 'elite@consult.com', tags: ['VIP', 'Recorrente'], total_revenue: 125000, created_at: '2025-01-10' },
  { id: '2', name: 'Tech Solutions Ltda', phone: '11987654321', email: 'contato@techsolutions.com', tags: ['VIP'], total_revenue: 85000, created_at: '2025-02-15' },
  { id: '3', name: 'InnovateBR', phone: '11933332222', email: 'contato@innovate.com', tags: ['Recorrente'], total_revenue: 42000, created_at: '2025-03-01' },
];

const tagColors: Record<string, string> = {
  VIP: 'bg-warning/10 text-warning border-warning/20',
  Recorrente: 'bg-success/10 text-success border-success/20',
  'Em Risco': 'bg-destructive/10 text-destructive border-destructive/20',
};

export default function ClientsPage() {
  const [search, setSearch] = useState('');
  const filtered = mockClients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
          <p className="text-muted-foreground text-sm">Leads convertidos (pós-venda)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <UserCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{mockClients.length}</p>
              <p className="text-xs text-muted-foreground">Total de Clientes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-success/10 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(mockClients.reduce((s, c) => s + c.total_revenue, 0))}</p>
              <p className="text-xs text-muted-foreground">Receita Total</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-warning/10 flex items-center justify-center">
              <UserCheck className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{mockClients.filter(c => c.tags.includes('VIP')).length}</p>
              <p className="text-xs text-muted-foreground">Clientes VIP</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar cliente..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="hidden md:table-cell">Telefone</TableHead>
                <TableHead className="hidden md:table-cell">E-mail</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Receita Total</TableHead>
                <TableHead className="hidden lg:table-cell">Cliente desde</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((client) => (
                <TableRow key={client.id} className="hover:bg-muted/30 cursor-pointer">
                  <TableCell className="font-medium">{client.name}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{client.phone}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{client.email}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {client.tags.map(tag => (
                        <Badge key={tag} variant="outline" className={`text-[10px] ${tagColors[tag] || ''}`}>{tag}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="font-semibold text-success">{formatCurrency(client.total_revenue)}</TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">{formatDate(client.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
