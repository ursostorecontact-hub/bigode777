import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Fish, Clock, Phone, Tag } from 'lucide-react';
import { useLeadQueue, useClaimLead } from '@/hooks/use-leads';
import { formatCurrency } from '@/types/crm';

function timeAgo(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'agora mesmo';
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days}d`;
}

export default function LeadQueuePage() {
  const { data: leads, isLoading } = useLeadQueue();
  const claimLead = useClaimLead();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Fish className="h-6 w-6 text-primary" />
          Fila de Leads
        </h1>
        <p className="text-muted-foreground text-sm">
          Leads novos esperando atendimento — clique em "Pescar" pra pegar um pra você. Quem clicar primeiro, leva.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !leads?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Fish className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="font-medium text-foreground">Nenhum lead esperando agora 🎉</p>
            <p className="text-sm text-muted-foreground mt-1">Assim que um lead novo chegar sem vendedor, ele aparece aqui.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {leads.map((lead: any) => (
            <Card key={lead.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                        {lead.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-foreground truncate flex items-center gap-1">
                        {lead.name}
                        {lead.ai_temperature && (
                          <span title={lead.ai_score_reason}>
                            {lead.ai_temperature === 'quente' ? '🔥' : lead.ai_temperature === 'morno' ? '🌡️' : '❄️'}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {timeAgo(lead.created_at)}
                      </p>
                    </div>
                  </div>
                  {lead.value > 0 && (
                    <Badge variant="secondary" className="shrink-0 text-xs">{formatCurrency(lead.value)}</Badge>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                  {lead.phone && (
                    <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {lead.phone}</span>
                  )}
                  {lead.source && (
                    <span className="flex items-center gap-1"><Tag className="h-3 w-3" /> {lead.source}</span>
                  )}
                </div>

                <Button
                  className="w-full gap-2"
                  disabled={claimLead.isPending}
                  onClick={() => claimLead.mutate(lead.id)}
                >
                  {claimLead.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fish className="h-4 w-4" />}
                  Pescar esse Lead
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
