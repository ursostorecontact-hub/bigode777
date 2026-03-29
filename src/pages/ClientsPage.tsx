import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, UserCheck, DollarSign, Loader2 } from 'lucide-react';
import { formatCurrency, formatDate } from '@/types/crm';
import { useClients } from '@/hooks/use-leads';

const tagColors: Record<string, string> = {
  VIP: 'bg-warning/10 text-warning border-warning/20',
  Recorrente: 'bg-success/10 text-success border-success/20',
  'Em Risco': 'bg-destructive/10 text-destructive border-destructive/20',
};

export default function ClientsPage() {
  const { data: clients, isLoading } = useClients();
  const [search, setSearch] = useState('');

  const allClients = clients || [];
  const filtered = allClients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalRevenue = allClients.reduce((s, c) => s + Number(c.total_revenue), 0);
  const vipCount = allClients.filter(c => (c.tags || []).includes('VIP')).length;

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
        <p className="text-muted-foreground text-sm">Leads convertidos (pós-venda)</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <UserCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{allClients.length}</p>
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
              <p className="text-2xl font-bold text-foreground">{formatCurrency(totalRevenue)}</p>
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
              <p className="text-2xl font-bold text-foreground">{vipCount}</p>
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
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum cliente encontrado.</TableCell></TableRow>
              ) : filtered.map((client) => (
                <TableRow key={client.id} className="hover:bg-muted/30 cursor-pointer">
                  <TableCell className="font-medium">{client.name}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{client.phone}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{client.email}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {(client.tags || []).map(tag => (
                        <Badge key={tag} variant="outline" className={`text-[10px] ${tagColors[tag] || ''}`}>{tag}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="font-semibold text-success">{formatCurrency(Number(client.total_revenue))}</TableCell>
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
