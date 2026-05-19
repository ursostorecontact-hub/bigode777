import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import { ImageUpload } from './ImageUpload';
import {
  useProductCategories,
  useCreateProduct,
  useUpdateProduct,
  Product,
  CreateProductInput,
} from '@/hooks/use-catalog';

interface Props {
  open: boolean;
  onClose: () => void;
  product?: Product | null;
}

const EMPTY: CreateProductInput = {
  name: '',
  description: '',
  price: null,
  stock: 0,
  sku: '',
  category_id: null,
  images: [],
  is_active: true,
};

export function ProductModal({ open, onClose, product }: Props) {
  const { data: categories = [] } = useProductCategories();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();

  const [form, setForm] = useState<CreateProductInput>(EMPTY);

  useEffect(() => {
    if (open) {
      setForm(
        product
          ? {
              name: product.name,
              description: product.description ?? '',
              price: product.price,
              stock: product.stock,
              sku: product.sku ?? '',
              category_id: product.category_id,
              images: product.images ?? [],
              is_active: product.is_active,
            }
          : EMPTY,
      );
    }
  }, [open, product]);

  const set = <K extends keyof CreateProductInput>(key: K, value: CreateProductInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const isPending = createProduct.isPending || updateProduct.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: CreateProductInput = {
      ...form,
      name: form.name.trim(),
      price: form.price !== null && form.price !== undefined ? Number(form.price) : null,
      stock: Number(form.stock) || 0,
      sku: form.sku?.trim() || undefined,
      category_id: form.category_id || null,
    };

    if (!payload.name) return;

    if (product) {
      updateProduct.mutate({ id: product.id, ...payload }, { onSuccess: onClose });
    } else {
      createProduct.mutate(payload, { onSuccess: onClose });
    }
  };

  const topLevel = categories.filter((c) => !c.parent_id);
  const children = (pid: string) => categories.filter((c) => c.parent_id === pid);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? 'Editar produto' : 'Novo produto'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <Tabs defaultValue="info">
            <TabsList className="w-full">
              <TabsTrigger value="info" className="flex-1">Informações</TabsTrigger>
              <TabsTrigger value="images" className="flex-1">Fotos ({form.images?.length ?? 0}/8)</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="prod-name">Nome *</Label>
                <Input
                  id="prod-name"
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="Nome do produto"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="prod-desc">Descrição</Label>
                <Textarea
                  id="prod-desc"
                  value={form.description ?? ''}
                  onChange={(e) => set('description', e.target.value)}
                  placeholder="Descreva o produto..."
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="prod-price">Preço (R$)</Label>
                  <Input
                    id="prod-price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.price ?? ''}
                    onChange={(e) => set('price', e.target.value === '' ? null : Number(e.target.value))}
                    placeholder="0,00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prod-stock">Estoque</Label>
                  <Input
                    id="prod-stock"
                    type="number"
                    min="0"
                    value={form.stock ?? 0}
                    onChange={(e) => set('stock', Number(e.target.value))}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="prod-sku">SKU / Código</Label>
                  <Input
                    id="prod-sku"
                    value={form.sku ?? ''}
                    onChange={(e) => set('sku', e.target.value)}
                    placeholder="SKU-001"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select
                    value={form.category_id ?? '__none__'}
                    onValueChange={(v) => set('category_id', v === '__none__' ? null : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sem categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sem categoria</SelectItem>
                      {topLevel.map((cat) => (
                        <React.Fragment key={cat.id}>
                          <SelectItem value={cat.id}>{cat.name}</SelectItem>
                          {children(cat.id).map((child) => (
                            <SelectItem key={child.id} value={child.id}>
                              &nbsp;&nbsp;↳ {child.name}
                            </SelectItem>
                          ))}
                        </React.Fragment>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <Switch
                  id="prod-active"
                  checked={form.is_active ?? true}
                  onCheckedChange={(v) => set('is_active', v)}
                />
                <Label htmlFor="prod-active" className="cursor-pointer">
                  {form.is_active ? 'Produto ativo (visível)' : 'Produto inativo (oculto)'}
                </Label>
              </div>
            </TabsContent>

            <TabsContent value="images" className="mt-4">
              <ImageUpload
                images={form.images ?? []}
                onChange={(imgs) => set('images', imgs)}
                disabled={isPending}
              />
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending || !form.name.trim()}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {product ? 'Salvar alterações' : 'Criar produto'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
