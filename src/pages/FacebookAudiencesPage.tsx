import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Send, Users, Target, Info, CheckCircle2, Save, TrendingUp, Flame, RefreshCw, AlertCircle, DollarSign } from 'lucide-react';
import { useClients, useSettings, useUpdateSettings, useLeads, useMetaEventsLog, useRetryMetaEvent } from '@/hooks/use-leads';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

function WordCloud({ words }: { words: { text: string; count: number }[] }) {
  if (words.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        Nenhum cliente cadastrado ainda.
      </div>
    );
  }

  const maxCount = Math.max(...words.map(w => w.count));
  const minCount = Math.min(...words.map(w => w.count));

  const getSize = (count: number) => {
    if (maxCount === minCount) return 'text-lg';
    const ratio = (count - minCount) / (maxCount - minCount);
    if (ratio > 0.8) return 'text-3xl font-bold';
    if (ratio > 0.6) return 'text-2xl font-semibold';
    if (ratio > 0.4) return 'text-xl font-medium';
    if (ratio > 0.2) return 'text-lg';
    return 'text-base';
  };

  const colors = [
    'text-primary', 'text-blue-500', 'text-emerald-500',
    'text-amber-500', 'text-purple-500', 'text-rose-500',
    'text-cyan-500', 'text-orange-500',
  ];

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 p-6 min-h-[200px]">
      {words.map((word, i) => (
        <span
          key={word.text}
          className={`${getSize(word.count)} ${colors[i % colors.length]} transition-transform hover:scale-110 cursor-default`}
          title={`${word.text}: ${word.count} cliente(s)`}
        >
          {word.text}
        </span>
      ))}
    </div>
  );
}

export default function FacebookAudiencesPage() {
  const { data: clients, isLoading: clientsLoading } = useClients();
  const { data: settings, isLoading: settingsLoading } = useSettings();
  const updateSettings = useUpdateSettings();
  const { data: leads } = useLeads();
  const { data: eventsLog, isLoading: eventsLoading } = useMetaEventsLog();
  const retryEvent = useRetryMetaEvent();
  const { toast } = useToast();

  const [pixelId, setPixelId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [sending, setSending] = useState(false);
  const [settingsInit, setSettingsInit] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string; pixel_name?: string } | null>(null);

  const handleTestConnection = async () => {
    if (!pixelId || !accessToken) {
      toast({ title: 'Preencha o Pixel ID e o Access Token primeiro', variant: 'destructive' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/facebook-test-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pixel_id: pixelId, access_token: accessToken }),
      });
      const result = await res.json();
      setTestResult(result);
    } catch (err: any) {
      setTestResult({ ok: false, error: err.message });
    } finally {
      setTesting(false);
    }
  };

  // Initialize fields from settings
  React.useEffect(() => {
    if (settings && !settingsInit) {
      setPixelId((settings as any).facebook_pixel_id || '');
      setAccessToken((settings as any).facebook_access_token || '');
      setSettingsInit(true);
    }
  }, [settings, settingsInit]);

  // Generate word cloud from real client sources (WhatsApp, Facebook, Indicação, etc)
  const wordCloudData = useMemo(() => {
    if (!clients?.length) return [];
    const sourceCounts: Record<string, number> = {};
    clients.forEach((c: any) => {
      const src = (c.source || 'Origem desconhecida').trim();
      sourceCounts[src] = (sourceCounts[src] || 0) + 1;
    });
    return Object.entries(sourceCounts)
      .map(([text, count]) => ({ text, count }))
      .sort((a, b) => b.count - a.count);
  }, [clients]);

  // Funil completo por origem: quantos leads entraram × quantos viraram cliente × R$ gerado
  const funnelBySource = useMemo(() => {
    if (!leads) return [];
    const bySource: Record<string, { totalLeads: number; converted: number; revenue: number }> = {};
    leads.forEach((l: any) => {
      const src = (l.source || 'Origem desconhecida').trim();
      if (!bySource[src]) bySource[src] = { totalLeads: 0, converted: 0, revenue: 0 };
      bySource[src].totalLeads++;
      if (l.status === 'ganho') {
        bySource[src].converted++;
        bySource[src].revenue += Number(l.value) || 0;
      }
    });
    return Object.entries(bySource)
      .map(([source, d]) => ({
        source,
        ...d,
        conversionRate: d.totalLeads > 0 ? Math.round((d.converted / d.totalLeads) * 100) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [leads]);

  const hotLeads = useMemo(() => {
    if (!leads) return [];
    return leads
      .filter((l: any) => l.ai_temperature === 'quente' && l.status !== 'ganho' && l.status !== 'perdido')
      .sort((a: any, b: any) => (b.ai_score || 0) - (a.ai_score || 0));
  }, [leads]);

  const handleSaveCredentials = () => {
    if (!settings) return;
    updateSettings.mutate({
      id: settings.id,
      facebook_pixel_id: pixelId,
      facebook_access_token: accessToken,
    } as any);
  };

  const handleSendToCAPI = async () => {
    if (!pixelId || !accessToken) {
      toast({ title: 'Configure o Pixel ID e Access Token primeiro', variant: 'destructive' });
      return;
    }
    if (!clients?.length) {
      toast({ title: 'Nenhum cliente para enviar', variant: 'destructive' });
      return;
    }

    setSending(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/facebook-capi`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          pixel_id: pixelId,
          access_token: accessToken,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erro ao enviar dados');

      toast({
        title: 'Dados enviados com sucesso!',
        description: `${result.sent_count} eventos enviados ao Facebook.`,
      });
    } catch (err: any) {
      toast({ title: 'Erro ao enviar', description: err.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  if (clientsLoading || settingsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Audiências Facebook</h1>
        <p className="text-muted-foreground text-sm">
          Envie dados de compradores ao Facebook para criar públicos semelhantes (Lookalike)
        </p>
      </div>

      {/* Word Cloud */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Nuvem de Origem dos Compradores
          </CardTitle>
          <CardDescription>
            De onde vêm seus clientes reais — quanto maior a origem, mais compradores vieram dali
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WordCloud words={wordCloudData} />
          <div className="text-center mt-2">
            <Badge variant="secondary">{clients?.length || 0} clientes cadastrados</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Funil completo por origem */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Funil por Origem
          </CardTitle>
          <CardDescription>
            Quantos leads entraram, quantos viraram cliente, e quanto cada origem gerou em vendas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {funnelBySource.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum lead cadastrado ainda.</p>
          ) : (
            <div className="space-y-3">
              {funnelBySource.map((f) => (
                <div key={f.source} className="border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{f.source}</span>
                    <span className="text-sm font-bold text-success flex items-center gap-1">
                      <DollarSign className="h-3.5 w-3.5" />
                      {f.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{f.totalLeads} leads</span>
                    <span>→</span>
                    <span>{f.converted} clientes</span>
                    <Badge variant={f.conversionRate >= 20 ? 'default' : 'secondary'} className="text-[10px]">
                      {f.conversionRate}% conversão
                    </Badge>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${f.conversionRate}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Leads quentes agora */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Flame className="h-4 w-4 text-destructive" />
            Leads Quentes Agora
          </CardTitle>
          <CardDescription>
            Classificados pela IA como prontos pra fechar — priorize esses no atendimento
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hotLeads.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum lead quente no momento.</p>
          ) : (
            <div className="space-y-2">
              {hotLeads.map((l: any) => (
                <div key={l.id} className="flex items-center justify-between p-2 rounded-md border bg-card">
                  <div>
                    <p className="text-sm font-medium">🔥 {l.name}</p>
                    <p className="text-xs text-muted-foreground">{l.ai_score_reason}</p>
                  </div>
                  <Badge variant="destructive" className="shrink-0">{l.ai_score}/100</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Log de eventos enviados à Meta */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Histórico de Envios à Meta
          </CardTitle>
          <CardDescription>
            Toda tentativa de envio (Purchase, Qualified, mudança de estágio) fica registrada aqui — falhas podem ser reenviadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {eventsLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : !eventsLog?.length ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum evento enviado ainda.</p>
          ) : (
            <div className="space-y-1.5 max-h-96 overflow-y-auto">
              {eventsLog.map((ev: any) => (
                <div key={ev.id} className="flex items-center gap-2 p-2 rounded-md border bg-card text-sm">
                  {ev.status === 'success' ? (
                    <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="truncate">
                      <span className="font-medium">{ev.event_name}</span>
                      {(ev.leads?.name || ev.clients?.name) && ` — ${ev.leads?.name || ev.clients?.name}`}
                    </p>
                    {ev.error_message && <p className="text-xs text-destructive truncate">{ev.error_message}</p>}
                    <p className="text-[10px] text-muted-foreground">{new Date(ev.created_at).toLocaleString('pt-BR')}</p>
                  </div>
                  {ev.status === 'error' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 shrink-0"
                      disabled={retryEvent.isPending || !pixelId || !accessToken}
                      onClick={() => retryEvent.mutate({ logId: ev.id, eventSource: ev.event_source, pixelId, accessToken })}
                    >
                      <RefreshCw className="h-3 w-3" />
                      Reenviar
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Credentials */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" />
            Credenciais do Facebook
          </CardTitle>
          <CardDescription>
            Configure o Pixel ID e Access Token da API de Conversões
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Facebook Pixel ID</Label>
            <Input
              value={pixelId}
              onChange={e => setPixelId(e.target.value)}
              placeholder="Ex: 1234567890123456"
            />
          </div>
          <div className="space-y-2">
            <Label>Access Token (Conversions API)</Label>
            <Input
              type="password"
              value={accessToken}
              onChange={e => setAccessToken(e.target.value)}
              placeholder="EAAxxxxxxxxx..."
            />
            <p className="text-xs text-muted-foreground">
              Gere o token no{' '}
              <a
                href="https://business.facebook.com/events_manager2"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                Gerenciador de Eventos do Facebook
              </a>
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSaveCredentials} disabled={updateSettings.isPending}>
              {updateSettings.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar Credenciais
            </Button>
            <Button size="sm" variant="outline" onClick={handleTestConnection} disabled={testing}>
              {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Target className="h-4 w-4 mr-2" />}
              Testar Conexão
            </Button>
          </div>
          {testResult && (
            <div className={`rounded-lg p-3 text-sm flex items-start gap-2 ${testResult.ok ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
              {testResult.ok ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" /> : <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />}
              <div>
                {testResult.ok ? (
                  <>
                    <p className="font-medium">Conectado com sucesso! ✅</p>
                    <p className="text-xs opacity-80">Pixel: {testResult.pixel_name} — o token tem permissão pra enviar eventos.</p>
                  </>
                ) : (
                  <>
                    <p className="font-medium">Não conectou ❌</p>
                    <p className="text-xs opacity-80">{testResult.error}</p>
                  </>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Send to CAPI */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Send className="h-4 w-4" />
            Enviar para Facebook Conversions API
          </CardTitle>
          <CardDescription>
            Os dados de e-mail, telefone e nome dos compradores serão hasheados em SHA256 antes do envio
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 p-4 rounded-lg space-y-2 text-sm">
            <p className="font-medium flex items-center gap-2"><Info className="h-4 w-4 text-primary" />O que será enviado:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-6">
              <li>E-mail (hash SHA256)</li>
              <li>Telefone (hash SHA256)</li>
              <li>Nome (hash SHA256)</li>
              <li>Valor total de compras</li>
            </ul>
            <p className="text-muted-foreground mt-2">
              Todos os dados pessoais são convertidos em hash antes do envio, garantindo privacidade.
            </p>
          </div>
          <Button
            onClick={handleSendToCAPI}
            disabled={sending || !pixelId || !accessToken}
            className="w-full"
          >
            {sending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enviando...</>
            ) : (
              <><Send className="h-4 w-4 mr-2" />Enviar {clients?.length || 0} compradores ao Facebook</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Lookalike Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" />
            Como Criar Público Lookalike
          </CardTitle>
          <CardDescription>
            Após enviar os dados, siga estes passos no Facebook Ads Manager
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              {
                step: 1,
                title: 'Envie os dados dos compradores',
                desc: 'Use o botão acima para enviar os dados hasheados dos seus clientes ao Facebook via Conversions API.',
              },
              {
                step: 2,
                title: 'Acesse o Gerenciador de Públicos',
                desc: 'No Facebook Ads Manager, vá em Públicos → Criar Público → Público Personalizado → do seu Pixel.',
              },
              {
                step: 3,
                title: 'Crie um Público Personalizado',
                desc: 'Selecione "Eventos do site" e filtre por "Purchase". O Facebook vai encontrar os compradores enviados.',
              },
              {
                step: 4,
                title: 'Crie o Público Lookalike',
                desc: 'Com o público personalizado criado, clique em "Criar Lookalike". Escolha o país (Brasil) e o tamanho (1% a 10%). Públicos de 1% são os mais semelhantes.',
              },
              {
                step: 5,
                title: 'Use nas campanhas',
                desc: 'O público Lookalike estará disponível para usar como segmentação nas suas campanhas de Facebook e Instagram Ads.',
              },
            ].map(item => (
              <div key={item.step} className="flex gap-3">
                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-bold text-primary">{item.step}</span>
                </div>
                <div>
                  <p className="font-medium text-sm text-foreground">{item.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
