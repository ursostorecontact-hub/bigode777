import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Calendar, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { formatDate } from '@/types/crm';

interface MockTask {
  id: string;
  title: string;
  description: string;
  due_date: string;
  priority: 'alta' | 'media' | 'baixa';
  status: 'pendente' | 'concluida';
  assigned_to_name: string;
  lead_name: string | null;
}

const mockTasks: MockTask[] = [
  { id: '1', title: 'Follow-up com Tech Solutions', description: 'Enviar proposta atualizada', due_date: '2025-03-28', priority: 'alta', status: 'pendente', assigned_to_name: 'Ana Silva', lead_name: 'Tech Solutions' },
  { id: '2', title: 'Ligar para StartUp X', description: 'Primeiro contato por telefone', due_date: '2025-03-27', priority: 'media', status: 'pendente', assigned_to_name: 'Carlos Santos', lead_name: 'StartUp X' },
  { id: '3', title: 'Reunião com Empresa Global', description: 'Apresentação do produto', due_date: '2025-03-25', priority: 'alta', status: 'pendente', assigned_to_name: 'Maria Oliveira', lead_name: 'Empresa Global' },
  { id: '4', title: 'Enviar contrato para Elite', description: 'Contrato de serviço anual', due_date: '2025-03-22', priority: 'baixa', status: 'concluida', assigned_to_name: 'Ana Silva', lead_name: 'Consultoria Elite' },
  { id: '5', title: 'Atualizar CRM dos leads inativos', description: 'Revisar e limpar leads antigos', due_date: '2025-03-30', priority: 'baixa', status: 'pendente', assigned_to_name: 'João Lima', lead_name: null },
];

const priorityConfig: Record<string, { label: string; class: string }> = {
  alta: { label: 'Alta', class: 'bg-destructive/10 text-destructive border-destructive/20' },
  media: { label: 'Média', class: 'bg-warning/10 text-warning border-warning/20' },
  baixa: { label: 'Baixa', class: 'bg-muted text-muted-foreground border-border' },
};

export default function TasksPage() {
  const [tasks, setTasks] = useState(mockTasks);
  const [filter, setFilter] = useState<'all' | 'pendente' | 'concluida' | 'atrasada'>('all');

  const today = new Date().toISOString().split('T')[0];

  const toggleTask = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: t.status === 'pendente' ? 'concluida' : 'pendente' } : t));
  };

  const isOverdue = (task: MockTask) => task.status === 'pendente' && task.due_date < today;

  const filtered = tasks.filter(t => {
    if (filter === 'pendente') return t.status === 'pendente';
    if (filter === 'concluida') return t.status === 'concluida';
    if (filter === 'atrasada') return isOverdue(t);
    return true;
  });

  const pending = tasks.filter(t => t.status === 'pendente').length;
  const overdue = tasks.filter(t => isOverdue(t)).length;
  const completed = tasks.filter(t => t.status === 'concluida').length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tarefas</h1>
          <p className="text-muted-foreground text-sm">Gerencie seus follow-ups e atividades</p>
        </div>
        <Button size="sm"><Plus className="h-4 w-4 mr-1" />Nova Tarefa</Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Todas', value: 'all' as const, count: tasks.length, icon: CheckCircle2, color: 'text-primary' },
          { label: 'Pendentes', value: 'pendente' as const, count: pending, icon: Clock, color: 'text-warning' },
          { label: 'Atrasadas', value: 'atrasada' as const, count: overdue, icon: AlertTriangle, color: 'text-destructive' },
          { label: 'Concluídas', value: 'concluida' as const, count: completed, icon: CheckCircle2, color: 'text-success' },
        ].map((item) => (
          <Card
            key={item.value}
            className={`cursor-pointer transition-all hover:shadow-md ${filter === item.value ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setFilter(item.value)}
          >
            <CardContent className="p-3 flex items-center gap-2">
              <item.icon className={`h-4 w-4 ${item.color}`} />
              <div>
                <p className="text-lg font-bold text-foreground">{item.count}</p>
                <p className="text-[11px] text-muted-foreground">{item.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map((task) => (
          <Card key={task.id} className={`transition-all hover:shadow-sm ${isOverdue(task) ? 'border-destructive/30 bg-destructive/5' : ''} ${task.status === 'concluida' ? 'opacity-60' : ''}`}>
            <CardContent className="p-4 flex items-start gap-3">
              <Checkbox
                checked={task.status === 'concluida'}
                onCheckedChange={() => toggleTask(task.id)}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className={`font-medium text-sm ${task.status === 'concluida' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                    {task.title}
                  </p>
                  <Badge variant="outline" className={`text-[10px] shrink-0 ${priorityConfig[task.priority].class}`}>
                    {priorityConfig[task.priority].label}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(task.due_date)}
                  </span>
                  <span>{task.assigned_to_name}</span>
                  {task.lead_name && <Badge variant="secondary" className="text-[10px] h-4">{task.lead_name}</Badge>}
                  {isOverdue(task) && <span className="text-destructive font-medium flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Atrasada</span>}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
