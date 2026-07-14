import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Send, Users, Target, Info, CheckCircle2, Save } from 'lucide-react';
import { useClients, useSettings, useUpdateSettings } from '@/hooks/use-leads';
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
  const { toast } = useToast();

  const [pixelId, setPixelId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [sending, setSending] = useState(false);
  const [settingsInit, setSettingsInit] = useState(false);

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
          <Button size="sm" onClick={handleSaveCredentials} disabled={updateSettings.isPending}>
            {updateSettings.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar Credenciais
          </Button>
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
