import React, { useCallback, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, X, GripVertical, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { uploadProductImage } from '@/hooks/use-catalog';
import { useTenant } from '@/contexts/TenantContext';

const MAX_IMAGES = 8;

interface Props {
  images: string[];
  onChange: (images: string[]) => void;
  disabled?: boolean;
}

export function ImageUpload({ images, onChange, disabled }: Props) {
  const { tenant } = useTenant();
  const [uploading, setUploading] = useState(false);
  const [draggingOver, setDraggingOver] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || !tenant) return;
    const allowed = MAX_IMAGES - images.length;
    if (allowed <= 0) return;
    const toUpload = Array.from(files).slice(0, allowed);
    setUploading(true);
    try {
      const urls = await Promise.all(toUpload.map((f) => uploadProductImage(f, tenant.id)));
      onChange([...images, ...urls]);
    } finally {
      setUploading(false);
    }
  }, [images, onChange, tenant]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDraggingOver(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const remove = (idx: number) => {
    onChange(images.filter((_, i) => i !== idx));
  };

  const reorder = (from: number, to: number) => {
    const copy = [...images];
    const [item] = copy.splice(from, 1);
    copy.splice(to, 0, item);
    onChange(copy);
  };

  const handleImageDragStart = (idx: number) => setDragIdx(idx);
  const handleImageDragEnter = (idx: number) => setDropIdx(idx);
  const handleImageDragEnd = () => {
    if (dragIdx !== null && dropIdx !== null && dragIdx !== dropIdx) {
      reorder(dragIdx, dropIdx);
    }
    setDragIdx(null);
    setDropIdx(null);
  };

  return (
    <div className="space-y-3">
      <div
        className={cn(
          'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
          draggingOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50',
          (images.length >= MAX_IMAGES || disabled) && 'opacity-50 pointer-events-none',
        )}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDraggingOver(true); }}
        onDragLeave={() => setDraggingOver(false)}
        onDrop={handleDrop}
      >
        {uploading ? (
          <Loader2 className="h-8 w-8 mx-auto text-muted-foreground animate-spin" />
        ) : (
          <>
            <Upload className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">
              Arraste imagens aqui ou <span className="text-primary font-medium">clique para selecionar</span>
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              PNG, JPG, WebP • máx. 5 MB • {images.length}/{MAX_IMAGES} fotos
            </p>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
        disabled={disabled || images.length >= MAX_IMAGES}
      />

      {images.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {images.map((url, idx) => (
            <div
              key={url}
              draggable
              onDragStart={() => handleImageDragStart(idx)}
              onDragEnter={() => handleImageDragEnter(idx)}
              onDragEnd={handleImageDragEnd}
              className={cn(
                'relative group aspect-square rounded-md overflow-hidden border bg-muted cursor-grab active:cursor-grabbing',
                dragIdx === idx && 'opacity-40',
                dropIdx === idx && dragIdx !== idx && 'ring-2 ring-primary',
              )}
            >
              <img src={url} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-start justify-between p-1">
                <GripVertical className="h-4 w-4 text-white/80" />
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); remove(idx); }}
                  className="p-0.5 rounded bg-red-500/80 hover:bg-red-500"
                >
                  <X className="h-3 w-3 text-white" />
                </button>
              </div>
              {idx === 0 && (
                <span className="absolute bottom-1 left-1 text-[10px] bg-black/60 text-white px-1 rounded">capa</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
