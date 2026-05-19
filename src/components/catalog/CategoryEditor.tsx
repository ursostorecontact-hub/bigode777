import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, Plus, Check, X } from 'lucide-react';
import {
  useProductCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  ProductCategory,
} from '@/hooks/use-catalog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface EditState {
  id: string;
  name: string;
  parent_id: string | null;
}

export function CategoryEditor() {
  const { data: categories = [] } = useProductCategories();
  const createCat = useCreateCategory();
  const updateCat = useUpdateCategory();
  const deleteCat = useDeleteCategory();

  const [newName, setNewName] = useState('');
  const [newParent, setNewParent] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const topLevel = categories.filter((c) => !c.parent_id);
  const children = (parentId: string) => categories.filter((c) => c.parent_id === parentId);

  const handleCreate = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    createCat.mutate({ name: trimmed, parent_id: newParent || null });
    setNewName('');
    setNewParent(null);
  };

  const handleUpdate = () => {
    if (!editing) return;
    updateCat.mutate({ id: editing.id, name: editing.name.trim(), parent_id: editing.parent_id });
    setEditing(null);
  };

  const renderCategory = (cat: ProductCategory) => {
    const isEditing = editing?.id === cat.id;

    return (
      <div key={cat.id} className="space-y-1">
        <div className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 group">
          {isEditing ? (
            <>
              <Input
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                className="h-7 text-sm flex-1"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleUpdate(); if (e.key === 'Escape') setEditing(null); }}
              />
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleUpdate}>
                <Check className="h-3.5 w-3.5 text-green-600" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(null)}>
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </>
          ) : (
            <>
              <span className="text-sm flex-1">{cat.name}</span>
              {children(cat.id).length > 0 && (
                <Badge variant="secondary" className="text-[10px] h-4">{children(cat.id).length}</Badge>
              )}
              <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                <Button
                  size="icon" variant="ghost" className="h-6 w-6"
                  onClick={() => setEditing({ id: cat.id, name: cat.name, parent_id: cat.parent_id })}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive"
                  onClick={() => setDeleteId(cat.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </>
          )}
        </div>

        {children(cat.id).map((child) => (
          <div key={child.id} className="ml-4 border-l pl-3">
            {renderCategory(child)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2 pb-4 border-b">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nova categoria</p>
        <div className="flex gap-2">
          <Input
            placeholder="Nome da categoria"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1"
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
          />
          <Select value={newParent ?? '__none__'} onValueChange={(v) => setNewParent(v === '__none__' ? null : v)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Subcategoria de..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Nível raiz</SelectItem>
              {topLevel.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleCreate} disabled={!newName.trim() || createCat.isPending} size="icon">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma categoria criada</p>
        ) : (
          topLevel.map(renderCategory)
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              Produtos nesta categoria ficarão sem categoria. Subcategorias também serão afetadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteId) { deleteCat.mutate(deleteId); setDeleteId(null); } }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
