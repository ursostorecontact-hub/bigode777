import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Trash2, Sparkles, Star } from 'lucide-react';
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
  promotional_price: null,
  stock: 0,
  sku: '',
  category_id: null,
  images: [],
  is_active: true,
  is_featured: false,
  attributes: {},
  ai_keywords: '',
  ai_sales_pitch: '',
};

// ── Attributes tab — key-value pair editor ─────────────────────────────────────

interface AttrEditorProps {
  attrs: Record<string, string>;
  onChange: (attrs: Record<string, string>) => void;
}

function AttributesEditor({ attrs, onChange }: AttrEditorProps) {
  const pairs = Object.entries(attrs);
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');

  const add = () => {
    const k = newKey.trim();
    const v = newVal.trim();
    if (!k || !v) return;
    onChange({ ...attrs, [k]: v });
    setNewKey('');
    setNewVal('');
  };

  const remove = (key: string) => {
    const next = { ...attrs };
    delete next[key];
    onChange(next);
  };

  const update = (oldKey: string, field: 'key' | 'val', value: string) => {
    const next: Record<string, string> = {};
    for (const [k, v] of Object.entries(attrs)) {
      if (k === oldKey) {
        if (field === 'key') next[value] = v;
        else next[k] = value;
      } else {
        next[k] = v;
      }
    }
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Adicione atributos do produto como cor, tamanho, peso, material, etc.
      </p>

      {pairs.length > 0 && (
        <div className="space-y-2">
          {pairs.map(([key, val]) => (
            <div key={key} className="flex items-center gap-2">
              <Input
                value={key}
                onChange={(e) => update(key, 'key', e.target.value)}
                placeholder="Atributo"
                className="flex-1 h-8 text-sm"
              />
              <Input
                value={val}
                onChange={(e) => update(key, 'val', e.target.value)}
                placeholder="Valor"
                className="flex-1 h-8 text-sm"
              />
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => remove(key)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1 border-t">
        <Input
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder="Ex: Cor"
          className="flex-1 h-8 text-sm"
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <Input
          value={newVal}
          onChange={(e) => setNewVal(e.target.value)}
          placeholder="Ex: Vermelho"
          className="flex-1 h-8 text-sm"
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0"
          onClick={add} disabled={!newKey.trim() || !newVal.trim()}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {pairs.length === 0 && (
        <p className="text-xs text-muted-foreground/60 italic">Nenhum atributo cadastrado</p>
      )}
    </div>
  );
}

// ── Main Modal ─────────────────────────────────────────────────────────────────

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
              promotional_price: product.promotional_price ?? null,
              stock: product.stock,
              sku: product.sku ?? '',
              category_id: product.category_id,
              images: product.images ?? [],
              is_active: product.is_active,
              is_featured: product.is_featured ?? false,
              attributes: product.attributes ?? {},
              ai_keywords: product.ai_keywords ?? '',
              ai_sales_pitch: product.ai_sales_pitch ?? '',
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
      promotional_price:
        form.promotional_price !== null && form.promotional_price !== undefined
          ? Number(form.promotional_price)
          : null,
      stock: Number(form.stock) || 0,
      sku: form.sku?.trim() || undefined,
      category_id: form.category_id || null,
      ai_keywords: form.ai_keywords?.trim() || undefined,
      ai_sales_pitch: form.ai_sales_pitch?.trim() || undefined,
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
  const attrCount = Object.keys(form.attributes ?? {}).length;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {product ? 'Editar produto' : 'Novo produto'}
            {form.is_featured && <Badge variant="default" className="gap-1 text-[10px] bg-amber-500 hover:bg-amber-500"><Star className="h-2.5 w-2.5" />Destaque</Badge>}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <Tabs defaultValue="info">
            <TabsList className="w-full">
              <TabsTrigger value="info" className="flex-1">Básico</TabsTrigger>
              <TabsTrigger value="images" className="flex-1">
                Fotos ({form.images?.length ?? 0}/8)
              </TabsTrigger>
              <TabsTrigger value="attributes" className="flex-1">
                Atributos{attrCount > 0 ? ` (${attrCount})` : ''}
              </TabsTrigger>
              <TabsTrigger value="ai" className="flex-1">
                <Sparkles className="h-3 w-3 mr-1" />IA
              </TabsTrigger>
            </TabsList>

            {/* ── Aba Básico ─────────────────────────────────────────────── */}
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
                  <Label htmlFor="prod-promo">Preço promocional (R$)</Label>
                  <Input
                    id="prod-promo"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.promotional_price ?? ''}
                    onChange={(e) =>
                      set('promotional_price', e.target.value === '' ? null : Number(e.target.value))
                    }
                    placeholder="0,00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
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

                <div className="space-y-2">
                  <Label htmlFor="prod-sku">SKU / Código</Label>
                  <Input
                    id="prod-sku"
                    value={form.sku ?? ''}
                    onChange={(e) => set('sku', e.target.value)}
                    placeholder="SKU-001"
                  />
                </div>
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

              <div className="flex flex-col gap-3 pt-1">
                <div className="flex items-center gap-3">
                  <Switch
                    id="prod-active"
                    checked={form.is_active ?? true}
                    onCheckedChange={(v) => set('is_active', v)}
                  />
                  <Label htmlFor="prod-active" className="cursor-pointer">
                    {form.is_active ? 'Produto ativo (visível)' : 'Produto inativo (oculto)'}
                  </Label>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    id="prod-featured"
                    checked={form.is_featured ?? false}
                    onCheckedChange={(v) => set('is_featured', v)}
                  />
                  <Label htmlFor="prod-featured" className="cursor-pointer flex items-center gap-1.5">
                    <Star className="h-3.5 w-3.5 text-amber-500" />
                    {form.is_featured ? 'Produto em destaque' : 'Marcar como destaque'}
                  </Label>
                </div>
              </div>
            </TabsContent>

            {/* ── Aba Fotos ──────────────────────────────────────────────── */}
            <TabsContent value="images" className="mt-4">
              <ImageUpload
                images={form.images ?? []}
                onChange={(imgs) => set('images', imgs)}
                disabled={isPending}
              />
            </TabsContent>

            {/* ── Aba Atributos ──────────────────────────────────────────── */}
            <TabsContent value="attributes" className="mt-4">
              <AttributesEditor
                attrs={form.attributes ?? {}}
                onChange={(a) => set('attributes', a)}
              />
            </TabsContent>

            {/* ── Aba IA ─────────────────────────────────────────────────── */}
            <TabsContent value="ai" className="space-y-5 mt-4">
              <div className="rounded-lg bg-primary/5 border border-primary/10 px-4 py-3 text-sm text-muted-foreground">
                <Sparkles className="h-4 w-4 inline mr-1.5 text-primary" />
                Estes campos são usados pela <strong>IA de Vendas</strong> para recomendar produtos
                automaticamente nas conversas do WhatsApp.
              </div>

              <div className="space-y-2">
                <Label htmlFor="prod-keywords">Palavras-chave</Label>
                <Input
                  id="prod-keywords"
                  value={form.ai_keywords ?? ''}
                  onChange={(e) => set('ai_keywords', e.target.value)}
                  placeholder="Ex: camiseta, algodão, masculino, casual, verão"
                />
                <p className="text-xs text-muted-foreground">
                  Separe com vírgula. A IA usa essas palavras para entender quando sugerir este produto.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="prod-pitch">Pitch de vendas para a IA</Label>
                <Textarea
                  id="prod-pitch"
                  value={form.ai_sales_pitch ?? ''}
                  onChange={(e) => set('ai_sales_pitch', e.target.value)}
                  placeholder="Ex: Camiseta premium 100% algodão, disponível nas cores preta e branca. Ótima opção para uso casual ou corporativo. Entregamos em 2 dias úteis. Compre 2 e ganhe 10% de desconto!"
                  rows={6}
                />
                <p className="text-xs text-muted-foreground">
                  Texto que a IA pode usar diretamente ou adaptar ao recomendar este produto ao cliente.
                </p>
              </div>
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
