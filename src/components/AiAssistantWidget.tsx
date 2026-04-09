import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Zap, X, Send, Loader2, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { supabase } from '@/integrations/supabase/client';

type Msg = { role: 'user' | 'assistant'; content: string };

export function AiAssistantWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');

    const userMsg: Msg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    let assistantSoFar = '';

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ messages: [...messages, userMsg] }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Erro desconhecido' }));
        setMessages(prev => [...prev, { role: 'assistant', content: `❌ ${err.error || 'Erro ao conectar com a IA'}` }]);
        setLoading(false);
        return;
      }

      const reader = resp.body?.getReader();
      if (!reader) throw new Error('No reader');
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantSoFar += content;
              const current = assistantSoFar;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: current } : m);
                }
                return [...prev, { role: 'assistant', content: current }];
              });
            }
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `❌ ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages]);

  return (
    <>
      {/* Floating Button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 shadow-lg shadow-orange-500/30 flex items-center justify-center hover:scale-110 transition-transform"
          title="Assistente IA"
        >
          <Zap className="h-7 w-7 text-white" fill="white" />
        </button>
      )}

      {/* Chat Panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] h-[520px] max-h-[calc(100vh-3rem)] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 p-3 border-b border-border bg-gradient-to-r from-yellow-400/10 to-orange-500/10">
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
              <Zap className="h-5 w-5 text-white" fill="white" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-sm text-foreground">Assistente IA</p>
              <p className="text-[10px] text-muted-foreground">CRM inteligente</p>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMessages([])} title="Limpar conversa">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-3">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <div className="h-16 w-16 rounded-full bg-gradient-to-br from-yellow-400/20 to-orange-500/20 flex items-center justify-center mb-4">
                  <Zap className="h-8 w-8 text-orange-500" />
                </div>
                <p className="font-semibold text-foreground text-sm">Olá! Sou seu Assistente IA</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-[260px]">
                  Analiso seus leads, conversas, tarefas e clientes em tempo real. Pergunte qualquer coisa!
                </p>
                <div className="flex flex-wrap gap-1.5 mt-4 justify-center">
                  {['📊 Resumo do dia', '🔥 Leads quentes', '⚠️ Tarefas atrasadas', '💡 Dicas de vendas'].map(q => (
                    <button
                      key={q}
                      onClick={() => { setInput(q); }}
                      className="text-[11px] px-2.5 py-1.5 rounded-full bg-muted hover:bg-muted/80 text-foreground transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground rounded-br-md'
                          : 'bg-muted text-foreground rounded-bl-md'
                      }`}
                    >
                      {msg.role === 'assistant' ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:m-0 [&>ul]:my-1 [&>ol]:my-1 [&>h1]:text-sm [&>h2]:text-sm [&>h3]:text-xs">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      )}
                    </div>
                  </div>
                ))}
                {loading && messages[messages.length - 1]?.role !== 'assistant' && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-2xl rounded-bl-md px-3 py-2 flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      {executing && <span className="text-xs text-muted-foreground">Executando ação...</span>}
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            )}
          </ScrollArea>

          {/* Input */}
          <div className="p-3 border-t border-border">
            <form
              onSubmit={(e) => { e.preventDefault(); send(); }}
              className="flex gap-2"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Pergunte algo..."
                className="h-9 text-sm"
                disabled={loading}
              />
              <Button type="submit" size="icon" className="h-9 w-9 shrink-0" disabled={loading || !input.trim()}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
