import React, { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileText, Mic, MapPin, User, Trash2, Download, X } from 'lucide-react';
import { Check, CheckCheck, Clock } from 'lucide-react';

function isMediaAccessible(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const { hostname } = new URL(url);
    if (hostname === 'localhost' || hostname === '127.0.0.1') return false;
    if (/^10\.|^172\.(1[6-9]|2\d|3[01])\.|^192\.168\./.test(hostname)) return false;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

function StatusIcon({ status, fromMe }: { status: string; fromMe: boolean }) {
  if (!fromMe) return null;
  switch (status) {
    case 'read': return <CheckCheck className="h-3.5 w-3.5 text-blue-400" />;
    case 'delivered': return <CheckCheck className="h-3.5 w-3.5 opacity-60" />;
    case 'sent': return <Check className="h-3.5 w-3.5 opacity-60" />;
    default: return <Clock className="h-3 w-3 opacity-60" />;
  }
}

function ImageMessage({ url, caption }: { url: string; caption?: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(true)} className="block focus:outline-none">
        <img
          src={url}
          alt="Imagem"
          className="rounded-lg max-w-[250px] max-h-[300px] object-cover cursor-pointer hover:opacity-90 transition-opacity"
          loading="lazy"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      </button>
      {caption && <p className="whitespace-pre-wrap break-words mt-1 text-sm">{caption}</p>}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl p-2 bg-black/90 border-0">
          <div className="relative flex items-center justify-center">
            <button onClick={() => setOpen(false)} className="absolute top-2 right-2 z-10 text-white bg-black/40 rounded-full p-1 hover:bg-black/60">
              <X className="h-5 w-5" />
            </button>
            <img src={url} alt="Imagem ampliada" className="max-w-full max-h-[80vh] object-contain rounded-lg" />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AudioMessage({ url }: { url: string }) {
  return (
    <div className="flex items-center gap-2 min-w-[240px]">
      <Mic className="h-4 w-4 shrink-0 opacity-70" />
      <audio controls preload="auto" className="h-10 w-full max-w-[260px]" style={{ minWidth: '200px' }}>
        <source src={url} type="audio/ogg; codecs=opus" />
        <source src={url} type="audio/ogg" />
        <source src={url} type="audio/mpeg" />
        <source src={url} type="audio/mp4" />
        <source src={url} />
        Seu navegador não suporta áudio.
      </audio>
    </div>
  );
}

function VideoMessage({ url, caption }: { url: string; caption?: string | null }) {
  return (
    <div>
      <video controls preload="metadata" className="rounded-lg max-w-[250px] max-h-[300px]" playsInline>
        <source src={url} type="video/mp4" />
        <source src={url} />
      </video>
      {caption && <p className="whitespace-pre-wrap break-words mt-1 text-sm">{caption}</p>}
    </div>
  );
}

function DocumentMessage({ url, filename, mimeType }: { url: string; filename?: string | null; mimeType?: string | null }) {
  const ext = filename?.split('.').pop()?.toUpperCase() || 'FILE';
  const displayName = filename || 'Documento';

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      download={filename || undefined}
      className="flex items-center gap-3 p-2 rounded-lg bg-black/10 hover:bg-black/15 transition-colors no-underline max-w-[280px]"
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
        <FileText className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{displayName}</p>
        <p className="text-[10px] opacity-60">{ext}</p>
      </div>
      <Download className="h-4 w-4 opacity-60 shrink-0" />
    </a>
  );
}

function LocationMessage({ content }: { content: string }) {
  let lat: number | null = null;
  let lng: number | null = null;
  let name: string | null = null;

  try {
    const parsed = JSON.parse(content);
    lat = parsed.lat ?? parsed.degreesLatitude ?? null;
    lng = parsed.lng ?? parsed.degreesLongitude ?? null;
    name = parsed.name ?? null;
  } catch {
    // Content might be plain text
  }

  const label = name || 'Ver localização';
  const mapsUrl = lat != null && lng != null
    ? `https://www.google.com/maps?q=${lat},${lng}`
    : null;

  return (
    <div className="flex items-center gap-2">
      <MapPin className="h-4 w-4 text-green-500 shrink-0" />
      {mapsUrl ? (
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="text-sm underline">
          {label}
        </a>
      ) : (
        <span className="text-sm">{content || '📍 Localização'}</span>
      )}
    </div>
  );
}

function ContactMessage({ content }: { content: string }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-black/10 max-w-[220px]">
      <div className="w-8 h-8 rounded-full bg-muted-foreground/20 flex items-center justify-center shrink-0">
        <User className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{content || 'Contato'}</p>
        <p className="text-[10px] opacity-60">WhatsApp</p>
      </div>
    </div>
  );
}

export interface MessageBubbleMessage {
  id: string;
  from_me: boolean;
  message_type: string;
  content: string | null;
  media_url: string | null;
  media_mime_type?: string | null;
  media_filename?: string | null;
  media_caption?: string | null;
  status: string;
  created_at: string;
  deleted_at?: string | null;
  sender_name?: string | null;
  is_group?: boolean;
}

interface Props {
  message: MessageBubbleMessage;
  isGroup: boolean;
  onDelete?: (id: string) => void;
}

export function MessageBubble({ message: msg, isGroup, onDelete }: Props) {
  const accessible = isMediaAccessible(msg.media_url);
  const content = msg.content || '';
  const caption = msg.media_caption || (
    msg.message_type !== 'text' ? content : null
  );

  const renderContent = () => {
    if (msg.deleted_at) {
      return (
        <div>
          <p className="text-[10px] text-destructive/70 mb-0.5 flex items-center gap-1">
            <Trash2 className="h-3 w-3" /> Apagada para o cliente
          </p>
          <p className="italic text-sm opacity-70">{content}</p>
        </div>
      );
    }

    switch (msg.message_type) {
      case 'image':
        return accessible
          ? <ImageMessage url={msg.media_url!} caption={caption !== content ? caption : null} />
          : <p className="text-sm">📷 Imagem (mídia indisponível)</p>;

      case 'video':
        return accessible
          ? <VideoMessage url={msg.media_url!} caption={caption !== content ? caption : null} />
          : <p className="text-sm">🎥 Vídeo (mídia indisponível)</p>;

      case 'audio':
        return accessible
          ? <AudioMessage url={msg.media_url!} />
          : (
            <div className="flex items-center gap-2">
              <Mic className="h-4 w-4 opacity-70" />
              <span className="text-sm">🎤 Áudio (mídia indisponível)</span>
            </div>
          );

      case 'document':
        return accessible
          ? <DocumentMessage url={msg.media_url!} filename={msg.media_filename} mimeType={msg.media_mime_type} />
          : (
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 opacity-70" />
              <span className="text-sm">{content || '📄 Documento (mídia indisponível)'}</span>
            </div>
          );

      case 'sticker':
        return accessible
          ? <img src={msg.media_url!} alt="Sticker" className="w-32 h-32 object-contain" loading="lazy" />
          : <p className="text-sm">🎨 Sticker</p>;

      case 'location':
        return <LocationMessage content={content} />;

      case 'contact':
        return <ContactMessage content={content} />;

      case 'reaction':
        return <p className="text-2xl">{content}</p>;

      case 'unsupported':
        return <p className="text-sm opacity-60 italic">📎 Mensagem não suportada</p>;

      default:
        return <p className="whitespace-pre-wrap break-words text-sm">{content}</p>;
    }
  };

  return (
    <div className={`flex ${msg.from_me ? 'justify-end' : 'justify-start'}`}>
      <div className="group relative">
        <div
          className={`max-w-[75%] rounded-2xl px-3 py-2 ${
            msg.from_me
              ? 'bg-primary text-primary-foreground rounded-br-md'
              : 'bg-muted text-foreground rounded-bl-md'
          } ${msg.deleted_at ? 'opacity-60 italic' : ''}`}
        >
          {/* Nome do remetente em grupos (mensagens recebidas) */}
          {isGroup && !msg.from_me && msg.sender_name && (
            <p className="text-[10px] font-semibold text-primary mb-0.5">{msg.sender_name}</p>
          )}

          {renderContent()}

          <div className={`flex items-center justify-end gap-1 mt-0.5 ${msg.from_me ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
            <span className="text-[10px]">
              {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
            <StatusIcon status={msg.status} fromMe={msg.from_me} />
          </div>
        </div>

        {/* Botão apagar (hover) */}
        {!msg.deleted_at && onDelete && (
          <button
            onClick={() => onDelete(msg.id)}
            className={`absolute top-1 ${msg.from_me ? 'left-0 -translate-x-full' : 'right-0 translate-x-full'} opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-destructive/10`}
            title="Apagar mensagem"
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </button>
        )}
      </div>
    </div>
  );
}
