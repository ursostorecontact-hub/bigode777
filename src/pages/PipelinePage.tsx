import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatCurrency, PIPELINE_STAGES, type LeadStatus } from '@/types/crm';
import { MessageCircle, Clock, GripVertical } from 'lucide-react';

interface KanbanLead {
  id: string;
  name: string;
  phone: string;
  value: number;
  priority: 'alta' | 'media' | 'baixa';
  assignedName: string;
  daysInStage: number;
  status: LeadStatus;
}

const mockKanban: KanbanLead[] = [
  { id: '1', name: 'Tech Solutions', phone: '11987654321', value: 15000, priority: 'alta', assignedName: 'Ana S.', daysInStage: 2, status: 'novo' },
  { id: '2', name: 'StartUp X', phone: '21998765432', value: 8500, priority: 'media', assignedName: 'Carlos S.', daysInStage: 1, status: 'novo' },
  { id: '3', name: 'Digital Co', phone: '11955554444', value: 22000, priority: 'alta', assignedName: 'Ana S.', daysInStage: 5, status: 'novo' },
  { id: '4', name: 'Empresa Global', phone: '31976543210', value: 32000, priority: 'alta', assignedName: 'Maria O.', daysInStage: 3, status: 'contactado' },
  { id: '5', name: 'Fast Commerce', phone: '61943210987', value: 7500, priority: 'baixa', assignedName: 'João L.', daysInStage: 7, status: 'contactado' },
  { id: '6', name: 'Marketing Pro', phone: '41965432109', value: 12000, priority: 'media', assignedName: 'Carlos S.', daysInStage: 4, status: 'negociando' },
  { id: '7', name: 'Consultech', phone: '51912345678', value: 28000, priority: 'alta', assignedName: 'Maria O.', daysInStage: 2, status: 'negociando' },
  { id: '8', name: 'InnovateBR', phone: '11933332222', value: 18000, priority: 'media', assignedName: 'Ana S.', daysInStage: 1, status: 'proposta_enviada' },
  { id: '9', name: 'Consultoria Elite', phone: '51954321098', value: 45000, priority: 'alta', assignedName: 'Ana S.', daysInStage: 0, status: 'ganho' },
  { id: '10', name: 'Old Corp', phone: '31911112222', value: 5000, priority: 'baixa', assignedName: 'João L.', daysInStage: 14, status: 'perdido' },
];

const priorityColors: Record<string, string> = {
  alta: 'bg-destructive/10 text-destructive border-destructive/20',
  media: 'bg-warning/10 text-warning border-warning/20',
  baixa: 'bg-muted text-muted-foreground border-border',
};

const priorityLabels: Record<string, string> = {
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
};

export default function PipelinePage() {
  const [leads, setLeads] = useState(mockKanban);
  const [draggedLead, setDraggedLead] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    setDraggedLead(leadId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, newStatus: LeadStatus) => {
    e.preventDefault();
    if (draggedLead) {
      setLeads(prev => prev.map(l => l.id === draggedLead ? { ...l, status: newStatus, daysInStage: 0 } : l));
      setDraggedLead(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Pipeline</h1>
        <p className="text-muted-foreground text-sm">Arraste os cards para mover leads entre as etapas</p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: '70vh' }}>
        {PIPELINE_STAGES.map((stage) => {
          const stageLeads = leads.filter(l => l.status === stage.key);
          const totalValue = stageLeads.reduce((sum, l) => sum + l.value, 0);

          return (
            <div
              key={stage.key}
              className="flex-shrink-0 w-72 flex flex-col"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, stage.key)}
            >
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: stage.color }} />
                  <span className="font-semibold text-sm text-foreground">{stage.label}</span>
                  <Badge variant="secondary" className="text-xs h-5">{stageLeads.length}</Badge>
                </div>
                <span className="text-xs text-muted-foreground">{formatCurrency(totalValue)}</span>
              </div>

              <div className="flex-1 space-y-2 bg-muted/30 rounded-xl p-2 min-h-[200px]">
                {stageLeads.map((lead) => (
                  <Card
                    key={lead.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, lead.id)}
                    className={`cursor-grab active:cursor-grabbing hover:shadow-md transition-all ${draggedLead === lead.id ? 'opacity-50' : ''}`}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between mb-2">
                        <p className="font-medium text-sm text-foreground leading-tight">{lead.name}</p>
                        <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                      </div>
                      <p className="text-sm font-semibold text-foreground mb-2">{formatCurrency(lead.value)}</p>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className={`text-[10px] ${priorityColors[lead.priority]}`}>
                          {priorityLabels[lead.priority]}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />{lead.daysInStage}d
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Avatar className="h-5 w-5">
                            <AvatarFallback className="text-[8px] bg-primary/10 text-primary">{lead.assignedName.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                          </Avatar>
                          <span className="text-[11px] text-muted-foreground">{lead.assignedName}</span>
                        </div>
                        <a href={`https://wa.me/${lead.phone}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-success transition-colors">
                          <MessageCircle className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {stageLeads.length === 0 && (
                  <div className="flex items-center justify-center h-24 text-xs text-muted-foreground">
                    Solte um lead aqui
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
