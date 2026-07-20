import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import {
  MessageSquare, Send, Loader2, Search, Phone, ArrowLeft,
  Check, CheckCheck, Clock, Mic, MicOff, UserPlus, Paperclip,
  Image as ImageIcon, Video, FileText, X, Trash2, Tag, Settings2, Sparkles, Users, Zap, MapPin, ListChecks,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { AISalesPanel } from '@/components/AISalesPanel';
import {
  useWhatsAppChats,
  useWhatsAppMessages,
  useSendWhatsAppMessage,
  useMarkChatRead,
  useDeleteWhatsAppMessage,
} from '@/hooks/use-whatsapp-chat';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useLabels, useLabelAssignments, useAssignLabel, useUnassignLabel } from '@/hooks/use-labels';
import { LabelManagerDialog, LabelAssignPopover, LabelBadges } from '@/components/LabelManager';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useQuickReplies, fetchMediaAsBase64, type QuickReply } from '@/hooks/use-quick-replies';
import { QuickReplyManagerDialog } from '@/components/QuickReplyManager';

// Returns true when a media_url is publicly accessible by the browser.
// URLs pointing to localhost, private IPs, or internal hostnames are not accessible.
function isMediaAccessible(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const { hostname } = new URL(url);
    if (hostname === 'localhost' || hostname === '127.0.0.1') return false;
    // 10.x.x.x / 172.16-31.x.x / 192.168.x.x
    if (/^10\.|^172\.(1[6-9]|2\d|3[01])\.|^192\.168\./.test(hostname)) return false;
    // Raw IP that looks like a private/VPS address (heuristic: no TLD)
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

function formatPhoneDisplay(phone: string) {
  if (!phone) return '';
  // Remove non-digits
  const digits = phone.replace(/\D/g, '');
  // If it doesn't look like a phone number (too long or no country code pattern), return empty
  if (digits.length > 15 || digits.length < 8) return '';
  // Format as +XX (XX) XXXXX-XXXX for BR numbers
  if (digits.startsWith('55') && digits.length >= 12) {
    const ddd = digits.slice(2, 4);
    const num = digits.slice(4);
    return `+55 (${ddd}) ${num.slice(0, -4)}-${num.slice(-4)}`;
  }
  return `+${digits}`;
}

function getDisplayName(chat: any) {
  // Prioridade: nome customizado > push_name do WhatsApp > contact_name legado
  const name = chat.custom_name || chat.push_name || chat.contact_name;
  const phone = chat.contact_phone || '';
  if (name && !/^\d{10,}$/.test(name)) return name;
  const formatted = formatPhoneDisplay(phone);
  if (formatted) return formatted;
  return phone || 'Desconhecido';
}

function initials(name: string) {
  if (!name) return '?';
  // If it starts with + (phone number), use last 2 digits
  if (name.startsWith('+')) return name.slice(-2);
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';

}

function formatTime(date: string) {
  const d = new Date(date);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Ontem';
  if (diffDays < 7) return d.toLocaleDateString('pt-BR', { weekday: 'short' });
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'read': return <CheckCheck className="h-3.5 w-3.5 text-blue-500" />;
    case 'delivered': return <CheckCheck className="h-3.5 w-3.5 text-muted-foreground" />;
    case 'sent': return <Check className="h-3.5 w-3.5 text-muted-foreground" />;
    default: return <Clock className="h-3 w-3 text-muted-foreground" />;
  }
}

// ── Save Contact Dialog ──
function SaveContactDialog({
  open,
  onOpenChange,
  phone,
  currentName,
  chatId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  phone: string;
  currentName: string;
  chatId: string;
}) {
  const [name, setName] = useState(currentName || '');
  const [saving, setSaving] = useState(false);
  const [savingLead, setSavingLead] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (open) setName(currentName || '');
  }, [open, currentName]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('whatsapp_chats')
        .update({
          custom_name: name.trim(),
          contact_name: name.trim(),
          custom_name_updated_by: user?.id ?? null,
          custom_name_updated_at: new Date().toISOString(),
        })
        .eq('id', chatId);
      if (error) throw error;
      toast({ title: 'Contato salvo', description: `${name.trim()} foi salvo com sucesso.` });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAsLead = async () => {
    const contactName = name.trim() || currentName || phone;
    setSavingLead(true);
    try {
      const { data: existing } = await supabase.from('leads').select('id').eq('phone', phone).maybeSingle();
      if (existing) {
        toast({ title: 'Lead já existe', description: 'Este número já está cadastrado como lead.' });
        setSavingLead(false);
        return;
      }
      const { data: newLead, error } = await supabase.from('leads').insert({
        name: contactName,
        phone,
        source: null, // a IA descobre a origem real lendo a conversa, em vez de fixar "WhatsApp"
        status: 'novo',
        pipeline_stage: 'novo',
      }).select('id').single();
      if (error) throw error;
      toast({ title: 'Lead criado!', description: `${contactName} adicionado ao pipeline. A IA vai analisar a origem e o interesse dele.` });
      if (newLead) {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-lead-scoring`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ lead_id: newLead.id }),
        }).catch((err) => console.error('Erro ao analisar lead com IA:', err));
      }
    } catch (err: any) {
      toast({ title: 'Erro ao criar lead', description: err.message, variant: 'destructive' });
    } finally {
      setSavingLead(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Salvar Contato</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Telefone</Label>
            <Input value={`+${phone}`} disabled />
          </div>
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do contato"
              autoFocus
            />
          </div>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="sm:mr-auto">Cancelar</Button>
          <Button variant="outline" onClick={handleSaveAsLead} disabled={savingLead}>
            {savingLead ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            💾 Salvar como Lead
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Salvar Nome
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ── Chat List ──
type ChatTab = 'conversations' | 'groups';

function ChatList({
  chats,
  selectedId,
  onSelect,
  search,
  onSearchChange,
  labels,
  assignments,
  onAssign,
  onUnassign,
  activeLabel,
  onLabelFilter,
  onManageLabels,
  activeTab,
  onTabChange,
}: {
  chats: any[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  search: string;
  onSearchChange: (v: string) => void;
  labels: any[];
  assignments: any[];
  onAssign: (labelId: string, chatId: string) => void;
  onUnassign: (labelId: string, chatId: string) => void;
  activeLabel: string | null;
  onLabelFilter: (id: string | null) => void;
  onManageLabels: () => void;
  activeTab: ChatTab;
  onTabChange: (tab: ChatTab) => void;
}) {
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  // Filtro por tab (grupo vs conversa individual)
  const tabFiltered = chats.filter((c) => {
    const isGroup = c.is_group ?? (c.remote_jid || '').endsWith('@g.us');
    return activeTab === 'groups' ? isGroup : !isGroup;
  });

  const searchFiltered = tabFiltered.filter(
    (c) =>
      (c.contact_name || c.contact_phone || '').toLowerCase().includes(search.toLowerCase()) ||
      getDisplayName(c).toLowerCase().includes(search.toLowerCase())
  );
  const filtered = activeLabel
    ? searchFiltered.filter((c) => assignments.some((a: any) => a.chat_id === c.id && a.label_id === activeLabel))
    : searchFiltered;

  // Contadores de não-lidos por tab
  const unreadConversations = chats.filter((c) => {
    const isGroup = c.is_group ?? (c.remote_jid || '').endsWith('@g.us');
    return !isGroup && c.unread_count > 0;
  }).length;
  const unreadGroups = chats.filter((c) => {
    const isGroup = c.is_group ?? (c.remote_jid || '').endsWith('@g.us');
    return isGroup && c.unread_count > 0;
  }).length;

  return (
    <div className="flex flex-col h-full border-r border-border">
      <div className="p-3 border-b border-border bg-card">
        {/* Tabs: Conversas / Grupos */}
        <div className="flex gap-1 mb-3">
          <button
            onClick={() => onTabChange('conversations')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'conversations'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Conversas
            {unreadConversations > 0 && (
              <span className={`text-[10px] rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none ${
                activeTab === 'conversations' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-green-500 text-white'
              }`}>
                {unreadConversations}
              </span>
            )}
          </button>
          <button
            onClick={() => onTabChange('groups')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'groups'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            Grupos
            {unreadGroups > 0 && (
              <span className={`text-[10px] rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none ${
                activeTab === 'groups' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-green-500 text-white'
              }`}>
                {unreadGroups}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center justify-between mb-2">
          <h2 className="font-bold text-foreground text-lg">{activeTab === 'groups' ? 'Grupos' : 'Conversas'}</h2>
          <div className="flex items-center gap-1">
            <Button
              variant={selectMode ? 'secondary' : 'ghost'}
              size="icon"
              className="h-7 w-7"
              onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
              title="Selecionar várias conversas"
            >
              <ListChecks className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onManageLabels} title="Gerenciar etiquetas">
            <Settings2 className="h-4 w-4" />
          </Button>
          </div>
        </div>
        {selectMode && (
          <div className="flex items-center justify-between mb-2 px-1 py-1.5 bg-primary/5 rounded-lg">
            <span className="text-xs text-muted-foreground">
              {selectedIds.size === 0 ? 'Toque nas conversas pra selecionar' : `${selectedIds.size} selecionada(s)`}
            </span>
            {selectedIds.size > 0 && (
              <LabelAssignPopover
                currentAssignments={[]}
                onAssign={(labelId) => { selectedIds.forEach((id) => onAssign(labelId, id)); exitSelectMode(); }}
                onUnassign={(labelId) => { selectedIds.forEach((id) => onUnassign(labelId, id)); exitSelectMode(); }}
              >
                <Button size="sm" className="h-7 gap-1.5 text-xs">
                  <Tag className="h-3 w-3" />
                  Aplicar etiqueta
                </Button>
              </LabelAssignPopover>
            )}
          </div>
        )}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Pesquisar conversa..."
            className="pl-9 h-9 text-sm"
          />
        </div>
        {/* Label tabs */}
        {labels.length > 0 && (
          <div className="flex gap-1 mt-2 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => onLabelFilter(null)}
              className={`shrink-0 text-[11px] px-2 py-1 rounded-full transition-colors ${!activeLabel ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
            >
              Todas
            </button>
            {labels.map((label: any) => (
              <button
                key={label.id}
                onClick={() => onLabelFilter(label.id === activeLabel ? null : label.id)}
                className={`shrink-0 text-[11px] px-2 py-1 rounded-full transition-colors flex items-center gap-1`}
                style={{
                  backgroundColor: label.id === activeLabel ? label.color : label.color + '20',
                  color: label.id === activeLabel ? '#fff' : label.color,
                }}
              >
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: label.id === activeLabel ? '#fff' : label.color }} />
                {label.name}
              </button>
            ))}
          </div>
        )}
      </div>
      <ScrollArea className="flex-1">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <MessageSquare className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma conversa ainda</p>
            <p className="text-xs text-muted-foreground mt-1">As mensagens recebidas pelo WhatsApp aparecerão aqui</p>
          </div>
        ) : (
          filtered.map((chat) => {
            const isGroup = (chat.remote_jid || '').endsWith('@g.us');
            return (
            <div
              key={chat.id}
              className={`w-full flex items-center gap-3 p-3 text-left transition-colors hover:bg-muted/50 ${
                selectedId === chat.id ? 'bg-primary/5 border-l-2 border-primary' : ''
              }`}
            >
              {selectMode && (
                <Checkbox
                  checked={selectedIds.has(chat.id)}
                  onCheckedChange={() => toggleSelected(chat.id)}
                  className="ml-1 shrink-0"
                />
              )}
              <button
                onClick={() => (selectMode ? toggleSelected(chat.id) : onSelect(chat.id))}
                className="flex items-center gap-3 flex-1 min-w-0 text-left"
              >
                <Avatar className="h-11 w-11 shrink-0">
                  {chat.profile_picture_url && <AvatarImage src={chat.profile_picture_url} alt={getDisplayName(chat)} />}
                  <AvatarFallback className={`text-xs font-bold ${isGroup ? 'bg-blue-500/10 text-blue-600' : 'bg-primary/10 text-primary'}`}>
                    {isGroup ? <Users className="h-5 w-5" /> : initials(getDisplayName(chat))}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={`h-2.5 w-2.5 rounded-full shrink-0 ${chat.unread_count > 0 ? 'bg-success animate-pulse' : 'bg-destructive'}`}
                        title={chat.unread_count > 0 ? 'Não lida' : 'Já aberta'}
                      />
                      <p className={`text-sm truncate ${chat.unread_count > 0 ? 'font-bold text-foreground' : 'font-semibold text-foreground'}`}>
                        {getDisplayName(chat)}
                      </p>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0 ml-1">
                      {chat.last_message_at ? formatTime(chat.last_message_at) : ''}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className={`text-xs truncate pr-2 ${chat.unread_count > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                      {chat.last_message || 'Sem mensagens'}
                    </p>
                    {chat.unread_count > 0 && (
                      <Badge className="h-5 min-w-[20px] text-[10px] bg-green-500 text-white shrink-0">
                        {chat.unread_count}
                      </Badge>
                    )}
                  </div>
                  <LabelBadges labelIds={(assignments || []).filter((a: any) => a.chat_id === chat.id).map((a: any) => a.label_id)} labels={labels} />
                </div>
              </button>
              <LabelAssignPopover
                chatId={chat.id}
                currentAssignments={(assignments || []).filter((a: any) => a.chat_id === chat.id).map((a: any) => a.label_id)}
                onAssign={(labelId) => onAssign(labelId, chat.id)}
                onUnassign={(labelId) => onUnassign(labelId, chat.id)}
              >
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100" title="Etiquetar">
                  <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </LabelAssignPopover>
            </div>
          );
          })
        )}
      </ScrollArea>
    </div>
  );
}

// ── Message Area ──
function MessageArea({
  chatId,
  chat,
  onBack,
  onToggleAI,
  aiPanelOpen,
}: {
  chatId: string;
  chat: any;
  onBack: () => void;
  onToggleAI: () => void;
  aiPanelOpen: boolean;
}) {
  const { data: messages, isLoading } = useWhatsAppMessages(chatId);
  const { role } = useAuth();
  const isAdminOrManager = role === 'admin' || role === 'manager';
  const sendMessage = useSendWhatsAppMessage();
  const markRead = useMarkChatRead();
  const deleteMessage = useDeleteWhatsAppMessage();
  const { toast } = useToast();
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const audio = useAudioRecorder();
  const { data: quickReplies } = useQuickReplies();
  const [quickReplyManagerOpen, setQuickReplyManagerOpen] = useState(false);
  const [quickReplyIndex, setQuickReplyIndex] = useState(0);
  const textInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Detecta se o usuário está digitando um atalho de mensagem rápida (ex: "/orc")
  // Só ativa quando a "/" é o primeiro caractere do texto (sem espaços depois).
  const slashMatch = /^\/([a-zA-Z0-9_-]*)$/.exec(text);
  const quickReplyQuery = slashMatch ? slashMatch[1].toLowerCase() : null;
  const filteredQuickReplies: QuickReply[] =
    quickReplyQuery !== null
      ? (quickReplies || []).filter((qr) => qr.shortcut.toLowerCase().startsWith(quickReplyQuery))
      : [];
  const showQuickReplyMenu = quickReplyQuery !== null && filteredQuickReplies.length > 0;

  useEffect(() => {
    setQuickReplyIndex(0);
  }, [text]);

  const handleSelectQuickReply = async (qr: QuickReply) => {
    setText('');
    if (qr.type === 'text') {
      setText(qr.content || '');
      textInputRef.current?.focus();
      return;
    }
    // Mídia (foto, vídeo, áudio, documento): envia direto, pois não dá pra "editar" no campo de texto
    if (!qr.media_url) return;
    setSending(true);
    try {
      const base64 = await fetchMediaAsBase64(qr.media_url);
      await sendMessage.mutateAsync({
        chatId,
        content: qr.content || '',
        messageType: qr.type,
        mediaBase64: base64,
        // Áudio sempre é enviado como audio/ogg — é o formato que a função whatsapp-send
        // salva no storage e envia pra Evolution API/WhatsApp. Usar o mimetype real do
        // arquivo (ex: audio/webm de gravações do navegador) faz o áudio chegar mudo.
        mediaMimetype: qr.type === 'audio' ? 'audio/ogg' : (qr.media_mimetype || undefined),
      });
    } catch (err: any) {
      toast({ title: 'Erro ao enviar mensagem rápida', description: err.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (chatId && chat?.unread_count > 0) {
      markRead.mutate(chatId);
    }
  }, [chatId]);

  const handleSend = async () => {
    const msg = text.trim();
    if (!msg) return;
    setText('');
    try {
      await sendMessage.mutateAsync({ chatId, content: msg });
    } catch (err: any) {
      toast({ title: 'Erro ao enviar', description: err.message, variant: 'destructive' });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showQuickReplyMenu) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setQuickReplyIndex((i) => (i + 1) % filteredQuickReplies.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setQuickReplyIndex((i) => (i - 1 + filteredQuickReplies.length) % filteredQuickReplies.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        handleSelectQuickReply(filteredQuickReplies[quickReplyIndex]);
        return;
      }
      if (e.key === 'Escape') {
        setText('');
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleAudioToggle = async () => {
    if (audio.recording) {
      try {
        const blob = await audio.stop();
        setSending(true);
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(',')[1];
          try {
            await sendMessage.mutateAsync({
              chatId,
              content: '🎵 Áudio',
              messageType: 'audio',
              mediaBase64: base64,
              mediaMimetype: 'audio/ogg',
            });
          } catch (err: any) {
            toast({ title: 'Erro ao enviar áudio', description: err.message, variant: 'destructive' });
          } finally {
            setSending(false);
          }
        };
        reader.readAsDataURL(blob);
      } catch (err: any) {
        toast({ title: 'Erro', description: err.message, variant: 'destructive' });
        setSending(false);
      }
    } else {
      try {
        await audio.start();
      } catch (err: any) {
        toast({ title: 'Microfone', description: err.message, variant: 'destructive' });
      }
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setSending(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1];
        let messageType = 'document';
        if (file.type.startsWith('image/')) messageType = 'image';
        else if (file.type.startsWith('video/')) messageType = 'video';

        try {
          await sendMessage.mutateAsync({
            chatId,
            content: '',
            messageType,
            mediaBase64: base64,
            mediaMimetype: file.type,
            mediaFilename: file.name,
          });
        } catch (err: any) {
          toast({ title: 'Erro ao enviar', description: err.message, variant: 'destructive' });
        } finally {
          setSending(false);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setSending(false);
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeleteMessage = (msgId: string) => {
    setDeleteTarget(msgId);
  };

  const confirmDeleteMessage = async (deleteForEveryone: boolean) => {
    if (!deleteTarget) return;
    const msgId = deleteTarget;
    setDeleteTarget(null);
    try {
      await deleteMessage.mutateAsync({ messageId: msgId, chatId, deleteForEveryone });
      toast({ title: deleteForEveryone ? 'Mensagem apagada para o cliente e no CRM' : 'Mensagem apagada só no CRM' });
    } catch (err: any) {
      toast({ title: 'Erro ao apagar', description: err.message, variant: 'destructive' });
    }
  };

  const contactName = getDisplayName(chat);
  const contactPhone = chat?.contact_phone || '';
  const isGroup = (chat?.remote_jid || '').endsWith('@g.us');

  const aiMessages = (messages ?? [])
    .filter((m) => m.content?.trim())
    .slice(-30)
    .map((m) => ({ role: m.from_me ? 'assistant' as const : 'user' as const, content: m.content }));

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Chat column ── */}
      <div className="flex flex-col flex-1 min-w-0">
      {/* Chat Header */}
      <div className="flex items-center gap-3 p-3 border-b border-border bg-card">
        <Button variant="ghost" size="icon" className="md:hidden h-8 w-8" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Avatar className="h-10 w-10">
          {chat?.profile_picture_url && <AvatarImage src={chat.profile_picture_url} alt={contactName} />}
          <AvatarFallback className={`text-xs font-bold ${isGroup ? 'bg-blue-500/10 text-blue-600' : 'bg-primary/10 text-primary'}`}>
            {isGroup ? <Users className="h-4 w-4" /> : initials(contactName)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-semibold text-sm text-foreground truncate">{contactName}</p>
            {isGroup && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1 shrink-0">Grupo</Badge>
            )}
          </div>
          {!isGroup && contactPhone && (
            <p className="text-xs text-muted-foreground">+{contactPhone}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            title="Gerenciar mensagens rápidas"
            onClick={() => setQuickReplyManagerOpen(true)}
          >
            <Zap className="h-4 w-4 text-muted-foreground" />
          </Button>
          {onToggleAI && (
            <Button
              variant={aiPanelOpen ? 'secondary' : 'ghost'}
              size="icon"
              className="h-9 w-9"
              title="IA de Vendas"
              onClick={onToggleAI}
            >
              <Sparkles className="h-4 w-4 text-primary" />
            </Button>
          )}
          {contactPhone && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              title="Salvar contato"
              onClick={() => setSaveDialogOpen(true)}
            >
              <UserPlus className="h-4 w-4" />
            </Button>
          )}
          {contactPhone && (
            <a href={`https://wa.me/${contactPhone}`} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="icon" className="h-9 w-9" title="Ligar via WhatsApp">
                <Phone className="h-4 w-4" />
              </Button>
            </a>
          )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !messages || messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare className="h-10 w-10 text-muted-foreground/20 mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma mensagem ainda</p>
          </div>
        ) : (
          <div className="space-y-1">
            {messages.map((msg, i) => {
              const showDate =
                i === 0 ||
                new Date(msg.created_at).toDateString() !== new Date(messages[i - 1].created_at).toDateString();

              return (
                <React.Fragment key={msg.id}>
                  {showDate && (
                    <div className="flex justify-center my-3">
                      <span className="text-[10px] bg-muted px-3 py-1 rounded-full text-muted-foreground">
                        {new Date(msg.created_at).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  )}
                  <div className={`flex ${msg.from_me ? 'justify-end' : 'justify-start'}`}>
                    <div className="group relative">
                      <div
                        className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                          msg.from_me
                            ? 'bg-primary text-primary-foreground rounded-br-md'
                            : 'bg-muted text-foreground rounded-bl-md'
                        } ${(msg as any).deleted_at ? 'opacity-60 italic' : ''}`}
                      >
                      {/* Sender name in group chats (received messages only) */}
                      {isGroup && !msg.from_me && (msg as any).sender_name && (
                        <p className="text-[10px] font-semibold text-primary mb-0.5">
                          {(msg as any).sender_name}
                        </p>
                      )}
                      {(msg as any).deleted_at ? (
                          <div>
                            <p className="text-[10px] text-destructive/70 mb-0.5 flex items-center gap-1">
                              <Trash2 className="h-3 w-3" /> Apagada para o cliente
                            </p>
                            {msg.message_type === 'audio' && isMediaAccessible(msg.media_url) ? (
                              <div className="flex items-center gap-2 min-w-[240px]">
                                <Mic className="h-4 w-4 shrink-0 opacity-70" />
                                <audio controls preload="auto" className="h-10 w-full max-w-[260px]" style={{ minWidth: '200px' }}>
                                  <source src={msg.media_url!} type="audio/ogg; codecs=opus" />
                                  <source src={msg.media_url!} type="audio/ogg" />
                                  <source src={msg.media_url!} />
                                </audio>
                              </div>
                            ) : msg.message_type === 'image' && isMediaAccessible(msg.media_url) ? (
                              <a href={msg.media_url!} target="_blank" rel="noopener noreferrer">
                                <img src={msg.media_url!} alt="Imagem" className="rounded-lg max-w-[250px] max-h-[300px] object-cover cursor-pointer" loading="lazy" />
                              </a>
                            ) : (
                              <p className="whitespace-pre-wrap break-words text-sm">{msg.content}</p>
                            )}
                          </div>
                        ) : msg.message_type === 'audio' && isMediaAccessible(msg.media_url) ? (
                          <div className="flex items-center gap-2 min-w-[240px]">
                            <Mic className="h-4 w-4 shrink-0 opacity-70" />
                            <audio
                              controls
                              preload="auto"
                              className="h-10 w-full max-w-[260px]"
                              style={{ minWidth: '200px' }}
                            >
                              <source src={msg.media_url!} type="audio/ogg; codecs=opus" />
                              <source src={msg.media_url!} type="audio/ogg" />
                              <source src={msg.media_url!} type="audio/mpeg" />
                              <source src={msg.media_url!} type="audio/mp4" />
                              <source src={msg.media_url!} />
                              Seu navegador não suporta áudio.
                            </audio>
                          </div>
                        ) : msg.message_type === 'audio' ? (
                          <div className="flex items-center gap-2">
                            <Mic className="h-4 w-4 shrink-0 opacity-70" />
                            <span className="text-sm">🎤 Áudio (mídia indisponível)</span>
                          </div>
                        ) : msg.message_type === 'image' && isMediaAccessible(msg.media_url) ? (
                          <div>
                            <a href={msg.media_url!} target="_blank" rel="noopener noreferrer">
                              <img
                                src={msg.media_url!}
                                alt="Imagem"
                                className="rounded-lg max-w-[250px] max-h-[300px] object-cover cursor-pointer"
                                loading="lazy"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                  const fallback = document.createElement('p');
                                  fallback.textContent = '📷 Imagem (mídia expirada)';
                                  fallback.className = 'text-xs opacity-70';
                                  (e.target as HTMLImageElement).parentElement?.appendChild(fallback);
                                }}
                              />
                            </a>
                            {msg.content && msg.content !== '📷 Imagem' && (
                              <p className="whitespace-pre-wrap break-words mt-1">{msg.content}</p>
                            )}
                          </div>
                        ) : msg.message_type === 'video' && isMediaAccessible(msg.media_url) ? (
                          <div>
                            <video
                              controls
                              preload="metadata"
                              className="rounded-lg max-w-[250px] max-h-[300px]"
                              playsInline
                            >
                              <source src={msg.media_url!} type="video/mp4" />
                              <source src={msg.media_url!} />
                            </video>
                            {msg.content && msg.content !== '🎥 Vídeo' && (
                              <p className="whitespace-pre-wrap break-words mt-1">{msg.content}</p>
                            )}
                          </div>
                        ) : msg.message_type === 'document' && isMediaAccessible(msg.media_url) ? (
                          <a
                            href={msg.media_url!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 underline"
                          >
                            <FileText className="h-4 w-4 shrink-0" />
                            <span className="text-sm">{msg.content || '📄 Documento'}</span>
                          </a>
                        ) : msg.message_type === 'sticker' && isMediaAccessible(msg.media_url) ? (
                          <img
                            src={msg.media_url!}
                            alt="Sticker"
                            className="max-w-[150px] max-h-[150px]"
                            loading="lazy"
                          />
                        ) : (msg.message_type === 'location' || (msg.content?.startsWith('{"lat"') ?? false)) ? (
                          (() => {
                            let loc: { lat?: number; lng?: number; name?: string | null } = {};
                            try { loc = JSON.parse(msg.content || '{}'); } catch { /* conteúdo antigo/inválido */ }
                            if (loc.lat == null || loc.lng == null) {
                              return <p className="text-sm opacity-80">📍 Localização (dados indisponíveis)</p>;
                            }
                            return (
                              <a
                                href={`https://www.google.com/maps?q=${loc.lat},${loc.lng}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 underline"
                              >
                                <MapPin className="h-4 w-4 shrink-0" />
                                <span className="text-sm">{loc.name || 'Ver localização no mapa'}</span>
                              </a>
                            );
                          })()
                        ) : (
                          <>
                            {msg.message_type !== 'text' && (
                              <p className="text-xs opacity-70 mb-0.5">
                                {msg.message_type === 'image' ? '📷 Imagem (mídia indisponível)' : msg.message_type === 'video' ? '🎥 Vídeo (mídia indisponível)' : msg.message_type === 'audio' ? '🎤 Áudio (mídia indisponível)' : msg.message_type}
                              </p>
                            )}
                            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                          </>
                        )}
                        <div className={`flex items-center justify-end gap-1 mt-0.5 ${msg.from_me ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                          <span className="text-[10px]">
                            {new Date(msg.created_at).toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          {msg.from_me && <StatusIcon status={msg.status} />}
                        </div>
                      </div>
                      {/* Delete button - visible on hover */}
                      {!(msg as any).deleted_at && (
                        <button
                          onClick={() => handleDeleteMessage(msg.id)}
                          className={`absolute top-1 ${msg.from_me ? 'left-0 -translate-x-full' : 'right-0 translate-x-full'} opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-destructive/10`}
                          title="Apagar mensagem"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </button>
                      )}
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input Bar */}
      <div className="p-3 border-t border-border bg-card relative">
        {showQuickReplyMenu && (
          <div className="absolute bottom-full left-3 right-3 mb-1 bg-popover border border-border rounded-lg shadow-lg max-h-56 overflow-y-auto z-10">
            {filteredQuickReplies.map((qr, i) => (
              <button
                key={qr.id}
                type="button"
                className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm ${i === quickReplyIndex ? 'bg-accent' : 'hover:bg-accent/50'}`}
                onMouseEnter={() => setQuickReplyIndex(i)}
                onClick={() => handleSelectQuickReply(qr)}
              >
                <Badge variant="secondary" className="shrink-0">/{qr.shortcut}</Badge>
                <span className="text-muted-foreground truncate">
                  {qr.type === 'text' ? qr.content : `${qr.type === 'image' ? '📷' : qr.type === 'video' ? '🎥' : qr.type === 'audio' ? '🎤' : '📄'} ${qr.content || qr.type}`}
                </span>
              </button>
            ))}
          </div>
        )}
        {sending && (
          <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Enviando mídia...</span>
          </div>
        )}
        {audio.recording ? (
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-10 w-10 text-destructive" onClick={audio.cancel} title="Cancelar">
              <MicOff className="h-5 w-5" />
            </Button>
            <div className="flex-1 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
              <span className="text-sm text-destructive font-medium">Gravando {formatDuration(audio.duration)}</span>
            </div>
            <Button
              onClick={handleAudioToggle}
              disabled={sending}
              size="icon"
              className="h-10 w-10 shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0"
              onClick={() => fileInputRef.current?.click()}
              title="Enviar foto, vídeo ou arquivo"
              disabled={sending}
            >
              <Paperclip className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0"
              onClick={handleAudioToggle}
              title="Gravar áudio"
              disabled={sending}
            >
              <Mic className="h-5 w-5" />
            </Button>
            <Input
              ref={textInputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite uma mensagem... (use / para mensagens rápidas)"
              className="flex-1"
              disabled={sendMessage.isPending || sending}
            />
            {/* Botão IA — dentro do flow, não flutuante */}
            <Button
              variant="ghost"
              size="icon"
              className={`h-10 w-10 shrink-0 ${aiPanelOpen ? 'text-orange-500' : 'text-muted-foreground hover:text-orange-500'}`}
              onClick={onToggleAI}
              title="Sugestão de IA"
              disabled={sending}
            >
              <Sparkles className="h-5 w-5" />
            </Button>
            <Button
              onClick={handleSend}
              disabled={!text.trim() || sendMessage.isPending || sending}
              size="icon"
              className="h-10 w-10 shrink-0"
            >
              {sendMessage.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Save Contact Dialog */}
      {contactPhone && (
        <SaveContactDialog
          open={saveDialogOpen}
          onOpenChange={setSaveDialogOpen}
          phone={contactPhone}
          currentName={chat?.contact_name || ''}
          chatId={chatId}
        />
      )}
      <QuickReplyManagerDialog open={quickReplyManagerOpen} onOpenChange={setQuickReplyManagerOpen} />

      {/* Escolha de como apagar a mensagem */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar mensagem</AlertDialogTitle>
            <AlertDialogDescription>
              {isAdminOrManager
                ? 'Escolha como deseja apagar esta mensagem.'
                : 'A mensagem será apagada do WhatsApp do cliente. O registro continua visível para administradores e gerentes no CRM.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
            {isAdminOrManager && (
              <AlertDialogAction
                onClick={() => confirmDeleteMessage(false)}
                className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/80"
              >
                Apagar só no CRM (mantém no WhatsApp do cliente)
              </AlertDialogAction>
            )}
            <AlertDialogAction
              onClick={() => confirmDeleteMessage(true)}
              className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Apagar para o cliente também
            </AlertDialogAction>
            <AlertDialogCancel className="w-full mt-0">Cancelar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>{/* end chat column */}

      {/* ── AI Sales Panel ── */}
      {aiPanelOpen && (
        <AISalesPanel
          chatId={chatId}
          contactName={contactName}
          messages={aiMessages}
          onApplySuggestion={setText}
          onClose={onToggleAI}
        />
      )}
    </div>
  );
}

// ── Empty State ──
function EmptyChat() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <div className="p-6 rounded-full bg-muted/50 mb-4">
        <MessageSquare className="h-12 w-12 text-muted-foreground/30" />
      </div>
      <h2 className="text-lg font-semibold text-foreground mb-1">WhatsApp</h2>
      <p className="text-sm text-muted-foreground max-w-sm">
        Selecione uma conversa para começar a responder seus leads pelo WhatsApp
      </p>
    </div>
  );
}

// ── Main Page ──
export default function ConversationsPage() {
  const { data: chats, isLoading } = useWhatsAppChats();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [showLabelManager, setShowLabelManager] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ChatTab>('conversations');
  const { data: labels } = useLabels();
  const { data: chatAssignments } = useLabelAssignments('chat');
  const assignLabel = useAssignLabel();
  const unassignLabel = useUnassignLabel();

  const selectedChat = chats?.find((c) => c.id === selectedChatId);

  // DEBUG: track state changes
  useEffect(() => {
    console.log('[ConversationsPage] selectedChatId=', selectedChatId, '→ selectedChat=', selectedChat?.id ?? null, 'chats.length=', chats?.length ?? 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChatId, chats?.length]);

  // Close AI panel when switching chats so it doesn't carry stale context
  const handleSelectChat = (id: string) => {
    console.log('[handleSelectChat] id=', id, 'chats.length=', chats?.length ?? 0, 'chats ids=', chats?.map(c => c.id));
    setSelectedChatId(id);
    setAiPanelOpen(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  console.log('[render] selectedChatId=', selectedChatId, 'selectedChat=', !!selectedChat, 'chats.length=', chats?.length ?? 0);

  return (
    <div className="h-[calc(100vh-4rem)] flex overflow-hidden rounded-xl border border-border bg-background">
      <div className={`w-full md:w-80 lg:w-96 shrink-0 ${selectedChatId ? 'hidden md:flex md:flex-col' : 'flex flex-col'}`}>
        <ChatList
          chats={chats || []}
          selectedId={selectedChatId}
          onSelect={handleSelectChat}
          search={search}
          onSearchChange={setSearch}
          labels={labels || []}
          assignments={chatAssignments || []}
          onAssign={(labelId, chatId) => assignLabel.mutate({ labelId, chatId })}
          onUnassign={(labelId, chatId) => unassignLabel.mutate({ labelId, chatId })}
          activeLabel={activeLabel}
          onLabelFilter={setActiveLabel}
          onManageLabels={() => setShowLabelManager(true)}
          activeTab={activeTab}
          onTabChange={(tab) => { setActiveTab(tab); setSelectedChatId(null); }}
        />
      </div>
      <div className={`flex-1 min-w-0 ${!selectedChatId ? 'hidden md:flex md:flex-col' : 'flex flex-col'}`}>
        {selectedChatId && selectedChat ? (
          <MessageArea
            chatId={selectedChatId}
            chat={selectedChat}
            onBack={() => setSelectedChatId(null)}
            onToggleAI={() => setAiPanelOpen((o) => !o)}
            aiPanelOpen={aiPanelOpen}
          />
        ) : (
          <EmptyChat />
        )}
      </div>
      <LabelManagerDialog open={showLabelManager} onOpenChange={setShowLabelManager} />
    </div>
  );
}
