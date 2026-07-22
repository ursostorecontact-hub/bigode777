import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, MessageSquare, Users, ArrowRightLeft } from 'lucide-react';
import { useWhatsAppChats } from '@/hooks/use-whatsapp-chat';
import { useProfiles } from '@/hooks/use-leads';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { MessageArea } from '@/pages/ConversationsPage';

function initials(name: string) {
  if (!name) return '?';
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';
}

function getDisplayName(chat: any) {
  const name = chat.custom_name || chat.push_name || chat.contact_name;
  const phone = chat.contact_phone || '';
  if (name && !/^\d{10,}$/.test(name)) return name;
  return phone ? `+${phone}` : 'Desconhecido';
}

function timeAgo(dateStr: string | null) {
  if (!dateStr) return '';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

// Reatribui a conversa (e o lead correspondente, se houver) para outro vendedor.
function useReassignChat() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return async (chat: any, newUserId: string) => {
    try {
      const { error } = await supabase
        .from('whatsapp_chats')
        .update({ assigned_to: newUserId })
        .eq('id', chat.id);
      if (error) throw error;

      // Melhor esforço: se existir um lead com esse telefone, move junto,
      // pra fila de leads e conversa não ficarem dessincronizadas.
      if (chat.contact_phone) {
        const cleanPhone = String(chat.contact_phone).replace(/\D/g, '');
        const last8 = cleanPhone.slice(-8);
        if (last8) {
          await supabase
            .from('leads')
            .update({ assigned_to: newUserId })
            .ilike('phone', `%${last8}%`);
        }
      }

      qc.invalidateQueries({ queryKey: ['whatsapp-chats'] });
      qc.invalidateQueries({ queryKey: ['leads'] });
      toast({ title: 'Conversa reatribuída!', description: 'A conversa (e o lead, se houver) já pertence ao novo vendedor.' });
    } catch (err: any) {
      toast({ title: 'Erro ao reatribuir', description: err.message, variant: 'destructive' });
    }
  };
}

function ChatBubble({ chat, onClick }: { chat: any; onClick: () => void }) {
  const name = getDisplayName(chat);
  const unread = chat.unread_count > 0;
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 rounded-xl border border-border bg-background hover:bg-accent/50 transition-colors p-2.5 text-left w-full"
    >
      <Avatar className="h-9 w-9 shrink-0">
        {chat.profile_picture_url && <AvatarImage src={chat.profile_picture_url} alt={name} />}
        <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
          {initials(name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <p className="text-sm font-medium truncate">{name}</p>
          <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(chat.last_message_at)}</span>
        </div>
        <p className="text-xs text-muted-foreground truncate">{chat.last_message || 'Sem mensagens'}</p>
      </div>
      {unread && <span className="h-2.5 w-2.5 rounded-full bg-green-500 shrink-0" />}
    </button>
  );
}

export default function ManagerConversationsView() {
  const { data: chats, isLoading: loadingChats } = useWhatsAppChats();
  const { data: profiles, isLoading: loadingProfiles } = useProfiles();
  const { user } = useAuth();
  const reassignChat = useReassignChat();
  const [selectedChat, setSelectedChat] = useState<any | null>(null);

  const chatsBySeller = useMemo(() => {
    const map = new Map<string, any[]>();
    (chats || []).forEach((c: any) => {
      if (!c.assigned_to) return; // sem dono ainda: só aparece na Fila de Leads
      const list = map.get(c.assigned_to) || [];
      list.push(c);
      map.set(c.assigned_to, list);
    });
    // Mais recente primeiro dentro de cada vendedor
    map.forEach((list) => list.sort((a, b) => new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime()));
    return map;
  }, [chats]);

  const sellers = useMemo(() => {
    return (profiles || [])
      .map((p: any) => ({ ...p, chats: chatsBySeller.get(p.id) || [] }))
      // Vendedor sem nenhuma conversa ativa ainda aparece, mas por último
      .sort((a, b) => b.chats.length - a.chats.length);
  }, [profiles, chatsBySeller]);

  if (loadingChats || loadingProfiles) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] overflow-y-auto p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Conversas por vendedor
        </h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe ao vivo quem está com cada lead. Clique em uma conversa pra ver, responder ou trocar de vendedor.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sellers.map((seller: any) => (
          <Card key={seller.id} className="flex flex-col">
            <CardHeader className="flex flex-row items-center gap-3 pb-3 space-y-0">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/10 text-primary font-bold">
                  {initials(seller.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{seller.full_name}</p>
                <p className="text-xs text-muted-foreground">{seller.chats.length} conversa{seller.chats.length !== 1 ? 's' : ''} ativa{seller.chats.length !== 1 ? 's' : ''}</p>
              </div>
              <Badge variant="secondary" className="shrink-0">{seller.chats.length}</Badge>
            </CardHeader>
            <CardContent className="flex-1 space-y-2 pt-0">
              {seller.chats.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-6 text-muted-foreground">
                  <MessageSquare className="h-6 w-6 mb-1 opacity-30" />
                  <p className="text-xs">Nenhuma conversa no momento</p>
                </div>
              ) : (
                seller.chats.map((chat: any) => (
                  <ChatBubble key={chat.id} chat={chat} onClick={() => setSelectedChat(chat)} />
                ))
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detalhe da conversa — o gerente entra, digita e pode trocar de vendedor */}
      <Dialog open={!!selectedChat} onOpenChange={(open) => { if (!open) setSelectedChat(null); }}>
        <DialogContent className="max-w-3xl h-[85vh] p-0 overflow-hidden flex flex-col">
          {selectedChat && (
            <MessageArea
              chatId={selectedChat.id}
              chat={selectedChat}
              onBack={() => setSelectedChat(null)}
              headerExtra={
                <Select
                  value={selectedChat.assigned_to || ''}
                  onValueChange={(newUserId) => {
                    reassignChat(selectedChat, newUserId);
                    setSelectedChat((prev: any) => prev ? { ...prev, assigned_to: newUserId } : prev);
                  }}
                >
                  <SelectTrigger className="h-9 w-[180px] text-xs gap-1">
                    <ArrowRightLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <SelectValue placeholder="Mudar vendedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {(profiles || []).map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name}{p.id === user?.id ? ' (você)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              }
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
