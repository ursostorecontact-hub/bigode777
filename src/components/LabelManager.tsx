import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { Tag, Plus, Pencil, Trash2, X, Loader2 } from 'lucide-react';
import { useLabels, useCreateLabel, useUpdateLabel, useDeleteLabel, type UserLabel } from '@/hooks/use-labels';
import { useToast } from '@/hooks/use-toast';

const PRESET_COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1',
  '#84cc16', '#e11d48',
];

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {PRESET_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={`h-7 w-7 rounded-full border-2 transition-all ${value === c ? 'border-foreground scale-110' : 'border-transparent'}`}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}

export function LabelManagerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data: labels, isLoading } = useLabels();
  const createLabel = useCreateLabel();
  const updateLabel = useUpdateLabel();
  const deleteLabel = useDeleteLabel();
  const { toast } = useToast();

  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#3b82f6');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await createLabel.mutateAsync({ name: newName.trim(), color: newColor });
      setNewName('');
      setNewColor('#3b82f6');
      toast({ title: 'Etiqueta criada!' });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;
    try {
      await updateLabel.mutateAsync({ id, name: editName.trim(), color: editColor });
      setEditingId(null);
      toast({ title: 'Etiqueta atualizada!' });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteLabel.mutateAsync(id);
      toast({ title: 'Etiqueta removida' });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" /> Gerenciar Etiquetas
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Create new */}
          <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
            <Input
              placeholder="Nome da nova etiqueta..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <ColorPicker value={newColor} onChange={setNewColor} />
            <Button size="sm" onClick={handleCreate} disabled={!newName.trim() || createLabel.isPending} className="w-full">
              {createLabel.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              Criar Etiqueta
            </Button>
          </div>

          {/* Existing labels */}
          {isLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : !labels?.length ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma etiqueta criada ainda.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {labels.map((label) => (
                <div key={label.id} className="flex items-center gap-2 p-2 border rounded-lg">
                  {editingId === label.id ? (
                    <div className="flex-1 space-y-2">
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                      <ColorPicker value={editColor} onChange={setEditColor} />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleUpdate(label.id)} disabled={updateLabel.isPending}>Salvar</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancelar</Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="h-4 w-4 rounded-full shrink-0" style={{ backgroundColor: label.color }} />
                      <span className="flex-1 text-sm font-medium truncate">{label.name}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingId(label.id); setEditName(label.name); setEditColor(label.color); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(label.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Popover to assign/unassign labels to a specific chat or lead
export function LabelAssignPopover({
  chatId,
  leadId,
  currentAssignments,
  onAssign,
  onUnassign,
  children,
}: {
  chatId?: string;
  leadId?: string;
  currentAssignments: string[]; // label IDs already assigned
  onAssign: (labelId: string) => void;
  onUnassign: (labelId: string) => void;
  children: React.ReactNode;
}) {
  const { data: labels } = useLabels();

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <p className="text-xs font-semibold text-muted-foreground mb-2 px-1">Etiquetas</p>
        {!labels?.length ? (
          <p className="text-xs text-muted-foreground text-center py-2">Nenhuma etiqueta criada</p>
        ) : (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {labels.map((label) => {
              const assigned = currentAssignments.includes(label.id);
              return (
                <button
                  key={label.id}
                  onClick={() => assigned ? onUnassign(label.id) : onAssign(label.id)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${assigned ? 'bg-primary/10' : 'hover:bg-muted'}`}
                >
                  <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: label.color }} />
                  <span className="flex-1 text-left truncate">{label.name}</span>
                  {assigned && <X className="h-3 w-3 text-muted-foreground" />}
                </button>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// Inline badges showing assigned labels
export function LabelBadges({ labelIds, labels }: { labelIds: string[]; labels: UserLabel[] }) {
  if (!labelIds.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {labelIds.map((id) => {
        const label = labels.find((l) => l.id === id);
        if (!label) return null;
        return (
          <Badge
            key={id}
            variant="secondary"
            className="text-[10px] px-1.5 py-0 h-4"
            style={{ backgroundColor: label.color + '20', color: label.color, borderColor: label.color + '40' }}
          >
            {label.name}
          </Badge>
        );
      })}
    </div>
  );
}