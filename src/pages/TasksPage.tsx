import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Calendar, AlertTriangle, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { formatDate } from '@/types/crm';
import { useTasks, useCreateTask, useUpdateTask, useProfiles } from '@/hooks/use-leads';
import { useAuth } from '@/contexts/AuthContext';

const priorityConfig: Record<string, { label: string; class: string }> = {
  alta: { label: 'Alta', class: 'bg-destructive/10 text-destructive border-destructive/20' },
  media: { label: 'Média', class: 'bg-warning/10 text-warning border-warning/20' },
  baixa: { label: 'Baixa', class: 'bg-muted text-muted-foreground border-border' },
};

export default function TasksPage() {
  const { user } = useAuth();
  const { data: tasks, isLoading } = useTasks();
  const { data: profiles } = useProfiles();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();

  const [filter, setFilter] = useState<'all' | 'pendente' | 'concluida' | 'atrasada'>('all');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', due_date: '', priority: 'media', assigned_to: '' });

  const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name]));
  const allTasks = tasks || [];
  const today = new Date().toISOString().split('T')[0];

  const isOverdue = (t: any) => t.status === 'pendente' && t.due_date < today;

  const filtered = allTasks.filter(t => {
    if (filter === 'pendente') return t.status === 'pendente';
    if (filter === 'concluida') return t.status === 'concluida';
    if (filter === 'atrasada') return isOverdue(t);
    return true;
  });

  const pending = allTasks.filter(t => t.status === 'pendente').length;
  const overdue = allTasks.filter(t => isOverdue(t)).length;
  const completed = allTasks.filter(t => t.status === 'concluida').length;

  const toggleTask = (id: string, currentStatus: string) => {
    updateTask.mutate({ id, status: currentStatus === 'pendente' ? 'concluida' : 'pendente' });
  };

  const handleCreate = async () => {
    if (!form.title.trim() || !form.due_date) return;
    await createTask.mutateAsync({
      title: form.title,
      description: form.description || undefined,
      due_date: form.due_date,
      priority: form.priority,
      assigned_to: form.assigned_to || user!.id,
      created_by: user!.id,
    });
    setForm({ title: '', description: '', due_date: '', priority: 'media', assigned_to: '' });
    setIsAddOpen(false);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tarefas</h1>
          <p className="text-muted-foreground text-sm">Gerencie seus follow-ups e atividades</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" />Nova Tarefa</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Tarefa</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Título *</Label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Título da tarefa" />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Detalhes..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Data de Vencimento *</Label>
                  <Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Prioridade</Label>
                  <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="media">Média</SelectItem>
                      <SelectItem value="baixa">Baixa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Responsável</Label>
                <Select value={form.assigned_to} onValueChange={v => setForm(f => ({ ...f, assigned_to: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {(profiles || []).map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreate} disabled={createTask.isPending}>
                {createTask.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Criar Tarefa
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Todas', value: 'all' as const, count: allTasks.length, icon: CheckCircle2, color: 'text-primary' },
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
        {filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhuma tarefa encontrada.</p>
        ) : filtered.map((task) => (
          <Card key={task.id} className={`transition-all hover:shadow-sm ${isOverdue(task) ? 'border-destructive/30 bg-destructive/5' : ''} ${task.status === 'concluida' ? 'opacity-60' : ''}`}>
            <CardContent className="p-4 flex items-start gap-3">
              <Checkbox
                checked={task.status === 'concluida'}
                onCheckedChange={() => toggleTask(task.id, task.status)}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className={`font-medium text-sm ${task.status === 'concluida' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                    {task.title}
                  </p>
                  <Badge variant="outline" className={`text-[10px] shrink-0 ${(priorityConfig[task.priority]?.class) || ''}`}>
                    {priorityConfig[task.priority]?.label || task.priority}
                  </Badge>
                </div>
                {task.description && <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>}
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(task.due_date)}
                  </span>
                  <span>{profileMap[task.assigned_to] || '—'}</span>
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
