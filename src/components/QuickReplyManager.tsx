import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Zap, Plus, Trash2, Loader2, Type, Image as ImageIcon, Video, Mic, FileText, MicOff, Send, Paperclip } from 'lucide-react';
import {
  useQuickReplies, useCreateQuickReply, useDeleteQuickReply, uploadQuickReplyMedia,
  type QuickReplyType,
} from '@/hooks/use-quick-replies';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';

const TYPE_ICON: Record<QuickReplyType, React.ReactNode> = {
  text: <Type className="h-3.5 w-3.5" />,
  image: <ImageIcon className="h-3.5 w-3.5" />,
  video: <Video className="h-3.5 w-3.5" />,
  audio: <Mic className="h-3.5 w-3.5" />,
  document: <FileText className="h-3.5 w-3.5" />,
};

const ACCEPT_BY_TYPE: Record<Exclude<QuickReplyType, 'text'>, string> = {
  image: 'image/*',
  video: 'video/*',
  audio: 'audio/*',
  document: '.pdf,.doc,.docx,.xls,.xlsx',
};

export function QuickReplyManagerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { user } = useAuth();
  const { data: quickReplies, isLoading } = useQuickReplies();
  const createReply = useCreateQuickReply();
  const deleteReply = useDeleteQuickReply();
  const { toast } = useToast();

  const [shortcut, setShortcut] = useState('');
  const [type, setType] = useState<QuickReplyType>('text');
  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audio = useAudioRecorder();
  const [recordedPreviewUrl, setRecordedPreviewUrl] = useState<string | null>(null);

  const handleRecordToggle = async () => {
    if (audio.recording) {
      try {
        const blob = await audio.stop();
        const recordedFile = new File([blob], `mensagem-rapida-${Date.now()}.webm`, { type: blob.type || 'audio/webm' });
        setFile(recordedFile);
        setRecordedPreviewUrl(URL.createObjectURL(recordedFile));
      } catch (err: any) {
        toast({ title: 'Erro ao gravar', description: err.message, variant: 'destructive' });
      }
    } else {
      try {
        setFile(null);
        setRecordedPreviewUrl(null);
        await audio.start();
      } catch (err: any) {
        toast({ title: 'Microfone', description: err.message, variant: 'destructive' });
      }
    }
  };

  const resetForm = () => {
    setShortcut('');
    setType('text');
    setContent('');
    setFile(null);
    setRecordedPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCreate = async () => {
    const cleanShortcut = shortcut.trim().replace(/^\/+/, '');
    if (!cleanShortcut) {
      toast({ title: 'Digite um atalho', description: 'Ex: orcamento, bomdia, catalogo', variant: 'destructive' });
      return;
    }
    if (type === 'text' && !content.trim()) {
      toast({ title: 'Digite o texto da mensagem', variant: 'destructive' });
      return;
    }
    if (type !== 'text' && !file) {
      toast({ title: 'Selecione um arquivo', description: 'Escolha a foto, vídeo ou áudio para salvar', variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      let mediaUrl: string | undefined;
      let mediaMimetype: string | undefined;
      if (file && user) {
        const uploaded = await uploadQuickReplyMedia(file, user.id);
        mediaUrl = uploaded.url;
        mediaMimetype = uploaded.mimetype;
      }
      await createReply.mutateAsync({
        shortcut: cleanShortcut,
        type,
        content: type === 'text' ? content.trim() : (content.trim() || undefined),
        mediaUrl,
        mediaMimetype,
      });
      toast({ title: 'Mensagem rápida criada!', description: `Use "/${cleanShortcut}" no chat para enviar.` });
      resetForm();
    } catch (err: any) {
      toast({
        title: 'Erro ao criar',
        description: err.message?.includes('duplicate') ? 'Você já tem uma mensagem rápida com esse atalho.' : err.message,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteReply.mutateAsync(id);
      toast({ title: 'Mensagem rápida removida' });
    } catch (err: any) {
      toast({ title: 'Erro ao remover', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Mensagens rápidas
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {/* Formulário de criação */}
          <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Atalho</Label>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground text-sm">/</span>
                  <Input
                    value={shortcut}
                    onChange={(e) => setShortcut(e.target.value)}
                    placeholder="orcamento"
                    className="h-9"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo</Label>
                <Select value={type} onValueChange={(v) => { setType(v as QuickReplyType); setFile(null); setRecordedPreviewUrl(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">📝 Texto</SelectItem>
                    <SelectItem value="image">📷 Foto</SelectItem>
                    <SelectItem value="video">🎥 Vídeo</SelectItem>
                    <SelectItem value="audio">🎤 Áudio</SelectItem>
                    <SelectItem value="document">📄 Documento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {type === 'text' ? (
              <div className="space-y-1.5">
                <Label className="text-xs">Mensagem</Label>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Digite a mensagem que será enviada..."
                  rows={3}
                />
              </div>
            ) : type === 'audio' ? (
              <div className="space-y-1.5">
                <Label className="text-xs">Áudio</Label>
                {audio.recording ? (
                  <div className="flex items-center gap-2 p-2 rounded-md border bg-background">
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={audio.cancel} title="Cancelar">
                      <MicOff className="h-4 w-4" />
                    </Button>
                    <div className="flex-1 flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
                      <span className="text-sm text-destructive font-medium">Gravando...</span>
                    </div>
                    <Button type="button" onClick={handleRecordToggle} size="icon" className="h-8 w-8">
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1 justify-center gap-1.5"
                      onClick={handleRecordToggle}
                    >
                      <Mic className="h-4 w-4" />
                      Gravar agora
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1 justify-center gap-1.5"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Paperclip className="h-4 w-4" />
                      Escolher arquivo
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={ACCEPT_BY_TYPE.audio}
                      className="hidden"
                      onChange={(e) => { setFile(e.target.files?.[0] ?? null); setRecordedPreviewUrl(null); }}
                    />
                  </div>
                )}
                {file && recordedPreviewUrl && (
                  <audio controls src={recordedPreviewUrl} className="w-full h-9" />
                )}
                {file && !recordedPreviewUrl && (
                  <p className="text-xs text-muted-foreground truncate">📎 {file.name}</p>
                )}
                <Input
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Legenda (opcional)"
                  className="h-9"
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-xs">Arquivo</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPT_BY_TYPE[type]}
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {file ? file.name : 'Escolher arquivo...'}
                </Button>
                <Input
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Legenda (opcional)"
                  className="h-9"
                />
              </div>
            )}

            <Button
              onClick={handleCreate}
              disabled={uploading || createReply.isPending}
              size="sm"
              className="w-full"
            >
              {uploading || createReply.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Salvar mensagem rápida
            </Button>
          </div>

          {/* Lista de mensagens rápidas existentes */}
          <div className="space-y-1.5">
            {isLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : !quickReplies || quickReplies.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma mensagem rápida ainda. Crie a primeira acima!
              </p>
            ) : (
              quickReplies.map((qr) => (
                <div
                  key={qr.id}
                  className="flex items-center gap-2 p-2 rounded-md border bg-card"
                >
                  <Badge variant="secondary" className="gap-1 shrink-0">
                    {TYPE_ICON[qr.type]}
                    /{qr.shortcut}
                  </Badge>
                  <span className="text-sm text-muted-foreground truncate flex-1">
                    {qr.type === 'text' ? qr.content : (qr.content || `${qr.type} salvo`)}
                  </span>
                  <button
                    onClick={() => handleDelete(qr.id)}
                    className="p-1 rounded hover:bg-destructive/10 shrink-0"
                    title="Remover"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
