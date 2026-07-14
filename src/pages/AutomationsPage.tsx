import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Trash2, Zap, Webhook, MessageSquare, Phone, Mic, MicOff, Paperclip, Image as ImageIcon, Video, FileText } from 'lucide-react';
import { useAutomations, useCreateAutomation, useUpdateAutomation, useDeleteAutomation } from '@/hooks/use-automations';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { uploadQuickReplyMedia } from '@/hooks/use-quick-replies';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';

const triggerLabels: Record<string, string> = {
  lead_created: 'Novo lead criado',
  pipeline_changed: 'Mudança de etapa no pipeline',
  lead_inactive: 'Lead sem interação',
  lead_converted: 'Conversão para cliente',
};

const actionLabels: Record<string, string> = {
  webhook: 'Webhook (n8n)',
  whatsapp: 'WhatsApp',
  sms: 'SMS',
};

const actionIcons: Record<string, React.ReactNode> = {
  webhook: <Webhook className="h-4 w-4" />,
  whatsapp: <MessageSquare className="h-4 w-4" />,
  sms: <Phone className="h-4 w-4" />,
};

const placeholderHelp = '{{nome}}, {{telefone}}, {{email}}, {{etapa}}, {{origem}}';

export default function AutomationsPage() {
  const { data: automations, isLoading } = useAutomations();
  const createAutomation = useCreateAutomation();
  const updateAutomation = useUpdateAutomation();
  const deleteAutomation = useDeleteAutomation();
  const { toast } = useToast();
  const { user } = useAuth();

  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState('lead_created');
  const [actionType, setActionType] = useState('whatsapp');
  const [messageTemplate, setMessageTemplate] = useState('');
  const [inactiveDays, setInactiveDays] = useState('3');

  // Config fields
  const [twilioFrom, setTwilioFrom] = useState('');

  // Mídia anexada (áudio, foto, vídeo, documento) para automações de WhatsApp
  const [mediaType, setMediaType] = useState<'none' | 'audio' | 'image' | 'video' | 'document'>('none');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [recordedPreviewUrl, setRecordedPreviewUrl] = useState<string | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const mediaFileInputRef = useRef<HTMLInputElement>(null);
  const audio = useAudioRecorder();

  const MEDIA_ACCEPT: Record<string, string> = {
    audio: 'audio/*',
    image: 'image/*',
    video: 'video/*',
    document: '.pdf,.doc,.docx,.xls,.xlsx',
  };

  const handleRecordToggle = async () => {
    if (audio.recording) {
      try {
        const blob = await audio.stop();
        const recordedFile = new File([blob], `automacao-${Date.now()}.webm`, { type: blob.type || 'audio/webm' });
        setMediaFile(recordedFile);
        setRecordedPreviewUrl(URL.createObjectURL(recordedFile));
      } catch (err: any) {
        toast({ title: 'Erro ao gravar', description: err.message, variant: 'destructive' });
      }
    } else {
      try {
        setMediaFile(null);
        setRecordedPreviewUrl(null);
        await audio.start();
      } catch (err: any) {
        toast({ title: 'Microfone', description: err.message, variant: 'destructive' });
      }
    }
  };

  const resetMedia = () => {
    setMediaType('none');
    setMediaFile(null);
    setRecordedPreviewUrl(null);
    if (mediaFileInputRef.current) mediaFileInputRef.current.value = '';
  };

  const resetForm = () => {
    setName('');
    setTriggerType('lead_created');
    setActionType('whatsapp');
    setMessageTemplate('');
    setInactiveDays('3');
    setTwilioFrom('');
    resetMedia();
  };

  const handleCreate = async () => {
    if (!name) {
      toast({ title: 'Informe o nome da automação', variant: 'destructive' });
      return;
    }

    const config: Record<string, string> = {};
    if (actionType === 'whatsapp') {
      // Uses the tenant's connected WhatsApp instance automatically
      config.use_tenant_instance = 'true';
    } else if (actionType === 'sms') {
      if (!twilioFrom) { toast({ title: 'Informe o número Twilio (From)', variant: 'destructive' }); return; }
      config.twilio_from = twilioFrom;
    }

    let media_type: string | null = null;
    let media_url: string | null = null;
    let media_mimetype: string | null = null;

    if (actionType === 'whatsapp' && mediaType !== 'none') {
      if (!mediaFile) {
        toast({ title: 'Selecione ou grave a mídia', description: 'Escolha um arquivo ou grave o áudio antes de salvar', variant: 'destructive' });
        return;
      }
      if (!user) return;
      setUploadingMedia(true);
      try {
        const uploaded = await uploadQuickReplyMedia(mediaFile, user.id);
        media_type = mediaType;
        media_url = uploaded.url;
        media_mimetype = mediaType === 'audio' ? 'audio/ogg' : uploaded.mimetype;
      } catch (err: any) {
        toast({ title: 'Erro ao enviar mídia', description: err.message, variant: 'destructive' });
        setUploadingMedia(false);
        return;
      }
      setUploadingMedia(false);
    }

    createAutomation.mutate({
      name,
      trigger_type: triggerType,
      action_type: actionType,
      config,
      message_template: messageTemplate || null,
      inactive_days: triggerType === 'lead_inactive' ? parseInt(inactiveDays) || 3 : null,
      media_type,
      media_url,
      media_mimetype,
    }, {
      onSuccess: () => {
        setShowNew(false);
        resetForm();
      },
    });
  };

  const handleToggle = (id: string, active: boolean) => {
    updateAutomation.mutate({ id, active: !active });
  };

  const handleDelete = (id: string, automationName: string) => {
    if (!confirm(`Remover automação "${automationName}"?`)) return;
    deleteAutomation.mutate(id);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Automações</h1>
          <p className="text-muted-foreground text-sm">Configure mensagens automáticas via Webhook, WhatsApp e SMS</p>
        </div>
        <Button onClick={() => setShowNew(true)} className="gap-1">
          <Plus className="h-4 w-4" />
          Nova Automação
        </Button>
      </div>

      {(automations || []).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Zap className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhuma automação criada ainda</p>
            <Button variant="outline" className="mt-4" onClick={() => setShowNew(true)}>Criar primeira automação</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {(automations || []).map((auto) => (
            <Card key={auto.id} className={!auto.active ? 'opacity-50' : ''}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    {actionIcons[auto.action_type]}
                  </div>
                  <div>
                    <p className="font-medium text-sm text-foreground">{auto.name}</p>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">{triggerLabels[auto.trigger_type]}</Badge>
                      <Badge variant="secondary" className="text-xs">{actionLabels[auto.action_type]}</Badge>
                      {auto.trigger_type === 'lead_inactive' && (
                        <Badge variant="secondary" className="text-xs">{auto.inactive_days} dias</Badge>
                      )}
                      {auto.media_type && (
                        <Badge variant="outline" className="text-xs">
                          {auto.media_type === 'audio' ? '🎤 Áudio' : auto.media_type === 'image' ? '📷 Foto' : auto.media_type === 'video' ? '🎥 Vídeo' : '📄 Documento'}
                        </Badge>
                      )}
                    </div>
                    {auto.message_template && (
                      <p className="text-xs text-muted-foreground mt-1 max-w-md truncate">{auto.message_template}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={auto.active} onCheckedChange={() => handleToggle(auto.id, auto.active)} />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleDelete(auto.id, auto.name)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Automação</DialogTitle>
            <DialogDescription>Configure quando e como as mensagens serão enviadas</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome da Automação *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Boas-vindas via WhatsApp" />
            </div>

            <div className="space-y-2">
              <Label>Gatilho</Label>
              <Select value={triggerType} onValueChange={setTriggerType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead_created">Novo lead criado</SelectItem>
                  <SelectItem value="pipeline_changed">Mudança de etapa no pipeline</SelectItem>
                  <SelectItem value="lead_inactive">Lead sem interação</SelectItem>
                  <SelectItem value="lead_converted">Conversão para cliente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {triggerType === 'lead_inactive' && (
              <div className="space-y-2">
                <Label>Dias sem interação</Label>
                <Input type="number" value={inactiveDays} onChange={e => setInactiveDays(e.target.value)} min="1" />
              </div>
            )}

            <div className="space-y-2">
              <Label>Canal de Envio</Label>
              <Select value={actionType} onValueChange={setActionType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp (Evolution API)</SelectItem>
                  <SelectItem value="webhook">Webhook (n8n)</SelectItem>
                  <SelectItem value="sms">SMS (Twilio)</SelectItem>
                </SelectContent>
              </Select>
            </div>



            {actionType === 'whatsapp' && (
              <div className="rounded-lg border border-border bg-muted/50 p-3">
                <p className="text-sm text-muted-foreground">
                  <MessageSquare className="h-4 w-4 inline mr-1" />
                  As mensagens serão enviadas pela instância WhatsApp conectada da sua empresa automaticamente.
                </p>
              </div>
            )}

            {actionType === 'whatsapp' && (
              <div className="space-y-2">
                <Label>Anexar mídia (opcional)</Label>
                <Select value={mediaType} onValueChange={(v) => { setMediaType(v as any); setMediaFile(null); setRecordedPreviewUrl(null); if (mediaFileInputRef.current) mediaFileInputRef.current.value = ''; }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma (só texto)</SelectItem>
                    <SelectItem value="audio">🎤 Áudio</SelectItem>
                    <SelectItem value="image">📷 Foto</SelectItem>
                    <SelectItem value="video">🎥 Vídeo</SelectItem>
                    <SelectItem value="document">📄 Documento</SelectItem>
                  </SelectContent>
                </Select>

                {mediaType === 'audio' && (
                  <div className="space-y-2 pt-1">
                    {audio.recording ? (
                      <div className="flex items-center gap-2 p-2 rounded-md border bg-background">
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={audio.cancel} title="Cancelar">
                          <MicOff className="h-4 w-4" />
                        </Button>
                        <div className="flex-1 flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
                          <span className="text-sm text-destructive font-medium">Gravando...</span>
                        </div>
                        <Button type="button" onClick={handleRecordToggle} size="sm">Parar</Button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" className="flex-1 gap-1.5" onClick={handleRecordToggle}>
                          <Mic className="h-4 w-4" /> Gravar agora
                        </Button>
                        <Button type="button" variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => mediaFileInputRef.current?.click()}>
                          <Paperclip className="h-4 w-4" /> Escolher arquivo
                        </Button>
                      </div>
                    )}
                    {mediaFile && recordedPreviewUrl && (
                      <audio controls src={recordedPreviewUrl} className="w-full h-9" />
                    )}
                    {mediaFile && !recordedPreviewUrl && (
                      <p className="text-xs text-muted-foreground truncate">📎 {mediaFile.name}</p>
                    )}
                  </div>
                )}

                {mediaType !== 'none' && mediaType !== 'audio' && (
                  <div className="space-y-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full justify-start gap-1.5"
                      onClick={() => mediaFileInputRef.current?.click()}
                    >
                      {mediaType === 'image' ? <ImageIcon className="h-4 w-4" /> : mediaType === 'video' ? <Video className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                      {mediaFile ? mediaFile.name : 'Escolher arquivo...'}
                    </Button>
                  </div>
                )}

                {mediaType !== 'none' && (
                  <input
                    ref={mediaFileInputRef}
                    type="file"
                    accept={MEDIA_ACCEPT[mediaType]}
                    className="hidden"
                    onChange={(e) => { setMediaFile(e.target.files?.[0] ?? null); setRecordedPreviewUrl(null); }}
                  />
                )}
              </div>
            )}

            {actionType === 'sms' && (
              <div className="space-y-2">
                <Label>Número Twilio (From) *</Label>
                <Input value={twilioFrom} onChange={e => setTwilioFrom(e.target.value)} placeholder="+5511999999999" />
                <p className="text-xs text-muted-foreground">Conecte o Twilio nas configurações do projeto para usar SMS</p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Modelo de Mensagem</Label>
              <Textarea
                value={messageTemplate}
                onChange={e => setMessageTemplate(e.target.value)}
                placeholder="Olá {{nome}}, recebemos seu contato!"
                rows={3}
              />
              <p className="text-xs text-muted-foreground">Variáveis: {placeholderHelp}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowNew(false); resetForm(); }}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createAutomation.isPending || uploadingMedia}>
              {(createAutomation.isPending || uploadingMedia) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {uploadingMedia ? 'Enviando mídia...' : 'Criar Automação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
