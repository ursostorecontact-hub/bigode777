import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Search, Filter, Download, Upload, MessageCircle, Eye, Pencil, Trash2 } from 'lucide-react';
import { formatCurrency, formatDate, type LeadStatus, PIPELINE_STAGES, LEAD_SOURCES } from '@/types/crm';

interface MockLead {
  id: string;
  name: string;
  phone: string;
  email: string;
  source: string;
  status: LeadStatus;
  assigned_to_name: string;
  value: number;
  created_at: string;
}

const mockLeads: MockLead[] = [
  { id: '1', name: 'Tech Solutions Ltda', phone: '11987654321', email: 'contato@techsolutions.com', source: 'Website', status: 'negociando', assigned_to_name: 'Ana Silva', value: 15000, created_at: '2025-03-15' },
  { id: '2', name: 'StartUp Innovation', phone: '21998765432', email: 'ceo@startup.com', source: 'Instagram', status: 'novo', assigned_to_name: 'Carlos Santos', value: 8500, created_at: '2025-03-20' },
  { id: '3', name: 'Empresa Global SA', phone: '31976543210', email: 'vendas@global.com', source: 'Indicação', status: 'contactado', assigned_to_name: 'Maria Oliveira', value: 32000, created_at: '2025-03-18' },
  { id: '4', name: 'Digital Marketing Co', phone: '41965432109', email: 'info@digital.com', source: 'WhatsApp', status: 'proposta_enviada', assigned_to_name: 'João Lima', value: 12000, created_at: '2025-03-22' },
  { id: '5', name: 'Consultoria Elite', phone: '51954321098', email: 'elite@consult.com', source: 'Website', status: 'ganho', assigned_to_name: 'Ana Silva', value: 45000, created_at: '2025-03-10' },
  { id: '6', name: 'Fast Commerce', phone: '61943210987', email: 'contato@fast.com', source: 'Outro', status: 'perdido', assigned_to_name: 'Carlos Santos', value: 7500, created_at: '2025-03-12' },
];

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  novo: { label: 'Novo', variant: 'default' },
  contactado: { label: 'Contactado', variant: 'secondary' },
  negociando: { label: 'Negociando', variant: 'outline' },
  proposta_enviada: { label: 'Proposta Enviada', variant: 'outline' },
  ganho: { label: 'Ganho', variant: 'default' },
  perdido: { label: 'Perdido', variant: 'destructive' },
};

export default function LeadsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isAddOpen, setIsAddOpen] = useState(false);

  const filtered = mockLeads.filter((lead) => {
    const matchesSearch = lead.name.toLowerCase().includes(search.toLowerCase()) ||
      lead.phone.includes(search) ||
      lead.email.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Leads</h1>
          <p className="text-muted-foreground text-sm">{filtered.length} leads encontrados</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm"><Upload className="h-4 w-4 mr-1" />Importar</Button>
          <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" />Exportar</Button>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" />Novo Lead</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Adicionar Novo Lead</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input placeholder="Nome da empresa ou contato" />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input placeholder="(00) 00000-0000" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>E-mail</Label>
                    <Input placeholder="email@empresa.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>Origem</Label>
                    <Select>
                      <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                      <SelectContent>
                        {LEAD_SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Valor estimado (R$)</Label>
                  <Input type="number" placeholder="0,00" />
                </div>
                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea placeholder="Notas sobre o lead..." />
                </div>
                <Button onClick={() => setIsAddOpen(false)}>Salvar Lead</Button>
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
                {PIPELINE_STAGES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
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
                {filtered.map((lead) => {
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
                      <TableCell className="hidden md:table-cell text-muted-foreground">{lead.assigned_to_name}</TableCell>
                      <TableCell className="hidden lg:table-cell font-medium">{formatCurrency(lead.value)}</TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">{formatDate(lead.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="WhatsApp">
                            <a href={`https://wa.me/${lead.phone}`} target="_blank" rel="noopener noreferrer">
                              <MessageCircle className="h-4 w-4" />
                            </a>
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Excluir">
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
    </div>
  );
}
