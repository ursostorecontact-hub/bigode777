import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Loader2, Sparkles, Send, RefreshCw, AlertTriangle, ShoppingBag, ImageOff, X,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useProducts } from '@/hooks/use-catalog';
import { useTenant } from '@/contexts/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface SalesResponse {
  suggestedResponse: string;
  productsToShow: string[];
  confidence: number;
  requiresHumanHandoff: boolean;
}

interface Props {
  chatId: string;
  contactName: string;
  messages: Message[];
  onApplySuggestion: (text: string) => void;
  onClose: () => void;
}

function formatPrice(price: number | null) {
  if (price === null) return '—';
  return price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function AISalesPanel({ chatId, contactName, messages, onApplySuggestion, onClose }: Props) {
  const { tenant } = useTenant();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState('');
  const [aiResult, setAiResult] = useState<SalesResponse | null>(null);
  const [hasResult, setHasResult] = useState(false);

  const { data: allProducts = [] } = useProducts({ is_active: true });
  const recommendedProducts = allProducts.filter((p) => aiResult?.productsToShow?.includes(p.id));

  const callAI = async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-sales-agent', {
        body: {
          messageHistory: messages.slice(-30),
          tenantId: tenant.id,
          chatId,
          contactName,
        },
      });
      if (error) throw error;
      const result = data as SalesResponse;
      setAiResult(result);
      setSuggestion(result.suggestedResponse);
      setHasResult(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: 'Erro ao chamar IA', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const confidence = aiResult?.confidence ?? 0;
  const confidenceColor =
    confidence >= 0.8 ? 'text-green-600' :
    confidence >= 0.6 ? 'text-yellow-600' :
    'text-red-500';

  return (
    <div className="flex flex-col h-full border-l border-border bg-card/50 w-80 shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">IA de Vendas</span>
          <Badge variant="secondary" className="text-[10px] h-4">Beta</Badge>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {/* Suggest button */}
          <Button
            className="w-full"
            onClick={callAI}
            disabled={loading || messages.length === 0}
          >
            {loading
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analisando conversa...</>
              : hasResult
              ? <><RefreshCw className="h-4 w-4 mr-2" />Nova sugestão</>
              : <><Sparkles className="h-4 w-4 mr-2" />Sugerir resposta com IA</>}
          </Button>

          {messages.length === 0 && (
            <p className="text-xs text-muted-foreground text-center">
              Aguarde o cliente enviar uma mensagem para ativar a IA.
            </p>
          )}

          {/* Human handoff warning */}
          {aiResult?.requiresHumanHandoff && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive">
                Situação delicada detectada. Recomendado encaminhar para atendente humano.
              </p>
            </div>
          )}

          {/* Suggested response */}
          {hasResult && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Resposta sugerida
                </p>
                {aiResult && (
                  <span className={cn('text-[10px] font-medium', confidenceColor)}>
                    {Math.round(confidence * 100)}% confiança
                  </span>
                )}
              </div>

              <Textarea
                value={suggestion}
                onChange={(e) => setSuggestion(e.target.value)}
                className="text-sm min-h-[120px] resize-none"
                placeholder="Sugestão da IA aparecerá aqui..."
              />

              <Button
                className="w-full"
                variant="default"
                onClick={() => { onApplySuggestion(suggestion); }}
                disabled={!suggestion.trim()}
              >
                <Send className="h-4 w-4 mr-2" />
                Usar esta resposta
              </Button>
            </div>
          )}

          {/* Recommended products */}
          {recommendedProducts.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <ShoppingBag className="h-3.5 w-3.5 text-primary" />
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Produtos recomendados
                  </p>
                </div>
                {recommendedProducts.map((product) => (
                  <div key={product.id}
                    className="flex items-center gap-2.5 p-2 rounded-lg border bg-background hover:bg-muted/30 transition-colors">
                    <div className="h-10 w-10 shrink-0 rounded overflow-hidden bg-muted flex items-center justify-center">
                      {product.images?.[0]
                        ? <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover" />
                        : <ImageOff className="h-4 w-4 text-muted-foreground/40" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatPrice(product.price)} · {product.stock} em estoque
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs shrink-0"
                      onClick={() => {
                        const price = product.price !== null
                          ? product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                          : 'consulte o preço';
                        const text = `*${product.name}* — ${price}${product.description ? `\n${product.description.slice(0, 100)}` : ''}`;
                        onApplySuggestion(text);
                      }}
                    >
                      Enviar
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </ScrollArea>

      {/* Footer info */}
      <div className="px-3 py-2 border-t border-border">
        <p className="text-[10px] text-muted-foreground/60 text-center">
          Powered by Claude · Revise antes de enviar
        </p>
      </div>
    </div>
  );
}
