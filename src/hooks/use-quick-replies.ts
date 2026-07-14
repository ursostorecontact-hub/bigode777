import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type QuickReplyType = 'text' | 'image' | 'video' | 'audio' | 'document';

export interface QuickReply {
  id: string;
  user_id: string;
  tenant_id: string | null;
  shortcut: string;
  type: QuickReplyType;
  content: string | null;
  media_url: string | null;
  media_mimetype: string | null;
  created_at: string;
  updated_at: string;
}

export function useQuickReplies() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['quick-replies', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quick_replies')
        .select('*')
        .order('shortcut');
      if (error) throw error;
      return data as QuickReply[];
    },
    enabled: !!user,
  });
}

export function useCreateQuickReply() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (payload: {
      shortcut: string;
      type: QuickReplyType;
      content?: string;
      mediaUrl?: string;
      mediaMimetype?: string;
    }) => {
      const { data, error } = await supabase
        .from('quick_replies')
        .insert({
          user_id: user!.id,
          shortcut: payload.shortcut.trim().toLowerCase(),
          type: payload.type,
          content: payload.content ?? null,
          media_url: payload.mediaUrl ?? null,
          media_mimetype: payload.mediaMimetype ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quick-replies'] }),
  });
}

export function useUpdateQuickReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      shortcut,
      content,
      mediaUrl,
      mediaMimetype,
    }: {
      id: string;
      shortcut?: string;
      content?: string;
      mediaUrl?: string;
      mediaMimetype?: string;
    }) => {
      const updates: any = {};
      if (shortcut !== undefined) updates.shortcut = shortcut.trim().toLowerCase();
      if (content !== undefined) updates.content = content;
      if (mediaUrl !== undefined) updates.media_url = mediaUrl;
      if (mediaMimetype !== undefined) updates.media_mimetype = mediaMimetype;
      const { error } = await supabase.from('quick_replies').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quick-replies'] }),
  });
}

export function useDeleteQuickReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('quick_replies').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quick-replies'] }),
  });
}

// Faz upload da mídia (áudio/vídeo/foto) para o bucket quick-reply-media
// e devolve a URL pública + mimetype para salvar no registro da mensagem rápida.
export async function uploadQuickReplyMedia(
  file: File,
  userId: string,
): Promise<{ url: string; mimetype: string }> {
  const ext = file.name.split('.').pop() || 'bin';
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from('quick-reply-media')
    .upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from('quick-reply-media').getPublicUrl(path);
  return { url: data.publicUrl, mimetype: file.type };
}

// Converte uma URL pública de mídia em base64, para reenviar via WhatsApp
// (a edge function whatsapp-send só aceita media_base64, não media_url).
export async function fetchMediaAsBase64(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
