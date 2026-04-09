import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  MessageSquare, Send, Loader2, Search, Phone, ArrowLeft,
  Check, CheckCheck, Clock, Mic, MicOff, UserPlus, Paperclip,
  Image as ImageIcon, Video, FileText, X, Trash2, Tag, Settings2,
} from 'lucide-react';
import {
  useWhatsAppChats,
  useWhatsAppMessages,
  useSendWhatsAppMessage,
  useMarkChatRead,
  useDeleteWhatsAppMessage,
} from '@/hooks/use-whatsapp-chat';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useLabels, useLabelAssignments, useAssignLabel, useUnassignLabel } from '@/hooks/use-labels';
import { LabelManagerDialog, LabelAssignPopover, LabelBadges } from '@/components/LabelManager';

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
  const name = chat.contact_name;
  const phone = chat.contact_phone || '';
  // If name exists and is NOT just digits (i.e. not a raw ID), use it
  if (name && !/^\d{10,}$/.test(name)) return name;
  // Try to format phone
  const formatted = formatPhoneDisplay(phone);
  if (formatted) return formatted;
  // Fallback
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
  const { toast } = useToast();

  useEffect(() => {
    if (open) setName(currentName || '');
  }, [open, currentName]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('whatsapp_chats')
        .update({ contact_name: name.trim() })
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
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!name.trim() || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Audio Recorder Hook ──
function useAudioRecorder() {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.start();
      setRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } catch {
      throw new Error('Permissão de microfone negada');
    }
  }, []);

  const stop = useCallback((): Promise<Blob> => {
    return new Promise((resolve) => {
      const mr = mediaRecorderRef.current;
      if (!mr) return;
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm;codecs=opus' });
        mr.stream.getTracks().forEach((t) => t.stop());
        resolve(blob);
      };
      mr.stop();
      setRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    });
  }, []);

  const cancel = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== 'inactive') {
      mr.stream.getTracks().forEach((t) => t.stop());
      mr.stop();
    }
    setRecording(false);
    setDuration(0);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  return { recording, duration, start, stop, cancel };
}

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ── Chat List ──
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
}) {
  const searchFiltered = chats.filter(
    (c) =>
      (c.contact_name || c.contact_phone || '').toLowerCase().includes(search.toLowerCase()) ||
      getDisplayName(c).toLowerCase().includes(search.toLowerCase())
  );
  const filtered = activeLabel
    ? searchFiltered.filter((c) => assignments.some((a: any) => a.chat_id === c.id && a.label_id === activeLabel))
    : searchFiltered;

  return (
    <div className="flex flex-col h-full border-r border-border">
      <div className="p-3 border-b border-border bg-card">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-bold text-foreground text-lg">Conversas</h2>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onManageLabels} title="Gerenciar etiquetas">
            <Settings2 className="h-4 w-4" />
          </Button>
        </div>
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
          filtered.map((chat) => (
            <div
              key={chat.id}
              className={`w-full flex items-center gap-3 p-3 text-left transition-colors hover:bg-muted/50 ${
                selectedId === chat.id ? 'bg-primary/5 border-l-2 border-primary' : ''
              }`}
            >
              <button onClick={() => onSelect(chat.id)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                <Avatar className="h-11 w-11 shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                    {initials(getDisplayName(chat))}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm text-foreground truncate">
                      {getDisplayName(chat)}
                    </p>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {chat.last_message_at ? formatTime(chat.last_message_at) : ''}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-xs text-muted-foreground truncate pr-2">
                      {chat.last_message || 'Sem mensagens'}
                    </p>
                    {chat.unread_count > 0 && (
                      <Badge className="h-5 min-w-[20px] text-[10px] bg-primary text-primary-foreground shrink-0">
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
          ))
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
}: {
  chatId: string;
  chat: any;
  onBack: () => void;
}) {
  const { data: messages, isLoading } = useWhatsAppMessages(chatId);
  const sendMessage = useSendWhatsAppMessage();
  const markRead = useMarkChatRead();
  const deleteMessage = useDeleteWhatsAppMessage();
  const { toast } = useToast();
  const { role } = useAuth();
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const audio = useAudioRecorder();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  const handleDeleteMessage = async (msgId: string) => {
    try {
      await deleteMessage.mutateAsync({ messageId: msgId, chatId });
      toast({ title: 'Mensagem apagada' });
    } catch (err: any) {
      toast({ title: 'Erro ao apagar', description: err.message, variant: 'destructive' });
    }
  };

  const contactName = getDisplayName(chat);
  const contactPhone = chat?.contact_phone || '';

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="flex items-center gap-3 p-3 border-b border-border bg-card">
        <Button variant="ghost" size="icon" className="md:hidden h-8 w-8" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Avatar className="h-10 w-10">
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
            {initials(contactName)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground truncate">{contactName}</p>
          {contactPhone && (
            <p className="text-xs text-muted-foreground">+{contactPhone}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
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
            <a href={`tel:+${contactPhone}`}>
              <Button variant="ghost" size="icon" className="h-9 w-9" title="Ligar">
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
                      {(msg as any).deleted_at ? (
                          <p className="text-xs">🚫 Mensagem apagada</p>
                        ) : msg.message_type === 'audio' && msg.media_url ? (
                          <div className="flex items-center gap-2 min-w-[240px]">
                            <Mic className="h-4 w-4 shrink-0 opacity-70" />
                            <audio
                              controls
                              preload="metadata"
                              className="h-10 w-full max-w-[260px]"
                              src={msg.media_url}
                              style={{ minWidth: '200px' }}
                            >
                              Seu navegador não suporta áudio.
                            </audio>
                          </div>
                        ) : msg.message_type === 'audio' ? (
                          <div className="flex items-center gap-2">
                            <Mic className="h-4 w-4 shrink-0 opacity-70" />
                            <span className="text-sm">🎤 Áudio</span>
                          </div>
                        ) : msg.message_type === 'image' && msg.media_url ? (
                          <div>
                            <a href={msg.media_url} target="_blank" rel="noopener noreferrer">
                              <img
                                src={msg.media_url}
                                alt="Imagem"
                                className="rounded-lg max-w-[250px] max-h-[300px] object-cover cursor-pointer"
                                loading="lazy"
                              />
                            </a>
                            {msg.content && msg.content !== '📷 Imagem' && (
                              <p className="whitespace-pre-wrap break-words mt-1">{msg.content}</p>
                            )}
                          </div>
                        ) : msg.message_type === 'video' && msg.media_url ? (
                          <div>
                            <video
                              controls
                              preload="none"
                              className="rounded-lg max-w-[250px] max-h-[300px]"
                              src={msg.media_url}
                            />
                            {msg.content && msg.content !== '🎥 Vídeo' && (
                              <p className="whitespace-pre-wrap break-words mt-1">{msg.content}</p>
                            )}
                          </div>
                        ) : msg.message_type === 'document' && msg.media_url ? (
                          <a
                            href={msg.media_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 underline"
                          >
                            <FileText className="h-4 w-4 shrink-0" />
                            <span className="text-sm">{msg.content || '📄 Documento'}</span>
                          </a>
                        ) : (
                          <>
                            {msg.message_type !== 'text' && (
                              <p className="text-xs opacity-70 mb-0.5">
                                {msg.message_type === 'image' ? '📷 Imagem' : msg.message_type === 'video' ? '🎥 Vídeo' : msg.message_type}
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
      <div className="p-3 border-t border-border bg-card">
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
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite uma mensagem..."
              className="flex-1"
              disabled={sendMessage.isPending || sending}
            />
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
  const { data: labels } = useLabels();
  const { data: chatAssignments } = useLabelAssignments('chat');
  const assignLabel = useAssignLabel();
  const unassignLabel = useUnassignLabel();

  const selectedChat = chats?.find((c) => c.id === selectedChatId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex overflow-hidden rounded-xl border border-border bg-background">
      <div className={`w-full md:w-80 lg:w-96 shrink-0 ${selectedChatId ? 'hidden md:flex md:flex-col' : 'flex flex-col'}`}>
        <ChatList
          chats={chats || []}
          selectedId={selectedChatId}
          onSelect={setSelectedChatId}
          search={search}
          onSearchChange={setSearch}
          labels={labels || []}
          assignments={chatAssignments || []}
          onAssign={(labelId, chatId) => assignLabel.mutate({ labelId, chatId })}
          onUnassign={(labelId, chatId) => unassignLabel.mutate({ labelId, chatId })}
          activeLabel={activeLabel}
          onLabelFilter={setActiveLabel}
          onManageLabels={() => setShowLabelManager(true)}
        />
      </div>
      <div className={`flex-1 ${!selectedChatId ? 'hidden md:flex md:flex-col' : 'flex flex-col'}`}>
        {selectedChatId && selectedChat ? (
          <MessageArea
            chatId={selectedChatId}
            chat={selectedChat}
            onBack={() => setSelectedChatId(null)}
          />
        ) : (
          <EmptyChat />
        )}
      </div>
      <LabelManagerDialog open={showLabelManager} onOpenChange={setShowLabelManager} />
    </div>
  );
}
