import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatCurrency, PIPELINE_STAGES, type LeadStatus } from '@/types/crm';
import { MessageCircle, Clock, GripVertical, Loader2 } from 'lucide-react';
import { useLeads, useUpdateLead, useProfiles } from '@/hooks/use-leads';

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
  const { data: leads, isLoading } = useLeads();
  const { data: profiles } = useProfiles();
  const updateLead = useUpdateLead();
  const [draggedLead, setDraggedLead] = useState<string | null>(null);

  const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name]));

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
      updateLead.mutate({ id: draggedLead, pipeline_stage: newStatus, status: newStatus });
      setDraggedLead(null);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const allLeads = leads || [];

  const getDaysInStage = (updatedAt: string) => {
    return Math.floor((Date.now() - new Date(updatedAt).getTime()) / 86400000);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Pipeline</h1>
        <p className="text-muted-foreground text-sm">Arraste os cards para mover leads entre as etapas</p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: '70vh' }}>
        {PIPELINE_STAGES.map((stage) => {
          const stageLeads = allLeads.filter(l => l.pipeline_stage === stage.key);
          const totalValue = stageLeads.reduce((sum, l) => sum + Number(l.value), 0);

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
                {stageLeads.map((lead) => {
                  const assignedName = lead.assigned_to ? profileMap[lead.assigned_to] || '?' : '?';
                  const initials = assignedName.split(' ').map(n => n[0]).join('').slice(0, 2);
                  const days = getDaysInStage(lead.updated_at);

                  return (
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
                        <p className="text-sm font-semibold text-foreground mb-2">{formatCurrency(Number(lead.value))}</p>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className={`text-[10px] ${priorityColors[lead.priority] || ''}`}>
                            {priorityLabels[lead.priority] || lead.priority}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />{days}d
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Avatar className="h-5 w-5">
                              <AvatarFallback className="text-[8px] bg-primary/10 text-primary">{initials}</AvatarFallback>
                            </Avatar>
                            <span className="text-[11px] text-muted-foreground">{assignedName}</span>
                          </div>
                          {lead.phone && (
                            <a href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-success transition-colors">
                              <MessageCircle className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
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
