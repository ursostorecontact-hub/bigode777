import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Plus, Search, SlidersHorizontal, MoreVertical, Pencil, Trash2, Copy,
  Download, Upload, ShoppingBag, Package, Tag, CheckSquare, Square,
  Loader2, ImageOff, LayoutGrid, List, Star,
} from 'lucide-react';
import { ProductModal } from '@/components/catalog/ProductModal';
import { CategoryEditor } from '@/components/catalog/CategoryEditor';
import {
  useProducts, useProductCategories, useDeleteProduct,
  useBulkUpdateProducts, useBulkDeleteProducts, useCreateProduct,
  Product, ProductFilters,
} from '@/hooks/use-catalog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatPrice(price: number | null | undefined) {
  if (price == null) return '—';
  return price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function parseCSVRows(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().replace(/"/g, ''));
  return lines.slice(1).map((line) => {
    const vals = line.split(',').map((v) => v.trim().replace(/"/g, ''));
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']));
  });
}

// ── CSV Import ─────────────────────────────────────────────────────────────────

type ImportRow = { name: string; price?: number; stock?: number; sku?: string; description?: string };

function CsvImportPanel({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const createProduct = useCreateProduct();
  const fileRef = useRef<HTMLInputElement>(null);

  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);

  const FIELDS = ['name', 'price', 'stock', 'sku', 'description'] as const;
  const FIELD_LABELS: Record<string, string> = {
    name: 'Nome *', price: 'Preço', stock: 'Estoque', sku: 'SKU', description: 'Descrição',
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseCSVRows((ev.target?.result as string) ?? '');
      if (!parsed.length) { toast({ title: 'CSV vazio ou inválido', variant: 'destructive' }); return; }
      const hs = Object.keys(parsed[0]);
      setCsvRows(parsed);
      setHeaders(hs);
      const auto: Record<string, string> = {};
      FIELDS.forEach((f) => {
        const match = hs.find((h) => h.toLowerCase().includes(f));
        if (match) auto[f] = match;
      });
      setMapping(auto);
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleImport = async () => {
    if (!mapping.name) { toast({ title: 'Mapeie a coluna Nome', variant: 'destructive' }); return; }
    setImporting(true);
    const rows: ImportRow[] = csvRows.map((row) => ({
      name: row[mapping.name] ?? '',
      price: mapping.price && row[mapping.price] ? Number(row[mapping.price].replace(',', '.')) : undefined,
      stock: mapping.stock && row[mapping.stock] ? Number(row[mapping.stock]) : undefined,
      sku: mapping.sku ? row[mapping.sku] || undefined : undefined,
      description: mapping.description ? row[mapping.description] || undefined : undefined,
    })).filter((p) => p.name.trim());

    let ok = 0;
    for (const row of rows) {
      try { await createProduct.mutateAsync(row); ok++; } catch {}
    }
    setImporting(false);
    toast({ title: `${ok} de ${rows.length} produto(s) importados` });
    onClose();
  };

  return (
    <div className="space-y-4 mt-4">
      <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} className="hidden" />
      <Button variant="outline" onClick={() => fileRef.current?.click()} className="w-full">
        <Upload className="h-4 w-4 mr-2" />Selecionar arquivo CSV
      </Button>

      {csvRows.length > 0 && (
        <>
          <p className="text-sm text-muted-foreground">{csvRows.length} linha(s) encontradas</p>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Mapeamento</p>
            {FIELDS.map((field) => (
              <div key={field} className="flex items-center gap-2">
                <span className="text-sm w-28 shrink-0">{FIELD_LABELS[field]}</span>
                <Select
                  value={mapping[field] ?? '__none__'}
                  onValueChange={(v) => setMapping((m) => ({ ...m, [field]: v === '__none__' ? '' : v }))}
                >
                  <SelectTrigger className="flex-1 h-8"><SelectValue placeholder="— ignorar —" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— ignorar —</SelectItem>
                    {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <Button onClick={handleImport} className="w-full" disabled={!mapping.name || importing}>
            {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Importar {csvRows.length} produto(s)
          </Button>
        </>
      )}
    </div>
  );
}

// ── ProductCard (grade) ────────────────────────────────────────────────────────

interface ProductCardProps {
  product: Product;
  onEdit: (product: Product) => void;
  onDuplicate: (product: Product) => void;
  onDelete: (id: string) => void;
  isReadOnly: boolean;
}

function ProductCard({ product, onEdit, onDuplicate, onDelete, isReadOnly }: ProductCardProps) {
  const cover = product.images?.[0];
  const hasPromo = product.promotional_price != null && product.promotional_price < (product.price ?? Infinity);

  return (
    <Card className="group overflow-hidden hover:shadow-md transition-shadow">
      <div
        className="relative aspect-square bg-muted cursor-pointer"
        onClick={() => !isReadOnly && onEdit(product)}
      >
        {cover
          ? <img src={cover} alt={product.name} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center">
              <ImageOff className="h-8 w-8 text-muted-foreground/30" />
            </div>}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {product.is_featured && (
            <Badge className="gap-1 text-[10px] h-5 bg-amber-500 hover:bg-amber-500 shadow">
              <Star className="h-2.5 w-2.5" />Destaque
            </Badge>
          )}
          {!product.is_active && (
            <Badge variant="secondary" className="text-[10px] h-5 shadow">Inativo</Badge>
          )}
        </div>
        {!isReadOnly && (
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="icon" className="h-7 w-7 shadow"
                  onClick={(e) => e.stopPropagation()}>
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(product)}>
                  <Pencil className="h-4 w-4 mr-2" />Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDuplicate(product)}>
                  <Copy className="h-4 w-4 mr-2" />Duplicar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive"
                  onClick={() => onDelete(product.id)}>
                  <Trash2 className="h-4 w-4 mr-2" />Remover
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      <CardContent className="p-3 space-y-1">
        <p className="text-sm font-medium truncate">{product.name}</p>
        <p className="text-xs text-muted-foreground truncate">
          {product.sku ? `SKU: ${product.sku}` : product.product_categories?.name ?? 'Sem categoria'}
        </p>
        <div className="flex items-center gap-2">
          {hasPromo ? (
            <>
              <span className="text-sm font-bold text-green-600">{formatPrice(product.promotional_price)}</span>
              <span className="text-xs text-muted-foreground line-through">{formatPrice(product.price)}</span>
            </>
          ) : (
            <span className="text-sm font-medium">{formatPrice(product.price)}</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Estoque: {product.stock}</p>
      </CardContent>
    </Card>
  );
}

// ── ProductRow (lista) ─────────────────────────────────────────────────────────

interface ProductRowProps {
  product: Product;
  selected: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onEdit: (product: Product) => void;
  onDuplicate: (product: Product) => void;
  onDelete: (id: string) => void;
  isReadOnly: boolean;
}

function ProductRow({ product, selected, onSelect, onEdit, onDuplicate, onDelete, isReadOnly }: ProductRowProps) {
  const cover = product.images?.[0];
  const hasPromo = product.promotional_price != null && product.promotional_price < (product.price ?? Infinity);

  return (
    <div className={cn(
      'flex items-center gap-3 px-3 py-2.5 rounded-lg border hover:bg-muted/30 transition-colors',
      selected && 'bg-primary/5 border-primary/20',
    )}>
      {!isReadOnly && (
        <button type="button" onClick={() => onSelect(product.id, !selected)}
          className="shrink-0 text-muted-foreground hover:text-foreground">
          {selected
            ? <CheckSquare className="h-4 w-4 text-primary" />
            : <Square className="h-4 w-4" />}
        </button>
      )}

      <div className="h-10 w-10 shrink-0 rounded-md overflow-hidden bg-muted flex items-center justify-center">
        {cover
          ? <img src={cover} alt={product.name} className="h-full w-full object-cover" />
          : <ImageOff className="h-4 w-4 text-muted-foreground/40" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium truncate">{product.name}</p>
          {product.is_featured && <Star className="h-3 w-3 text-amber-500 shrink-0" />}
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {product.sku ? `SKU: ${product.sku}` : 'Sem SKU'}
          {product.product_categories?.name ? ` · ${product.product_categories.name}` : ''}
        </p>
      </div>

      <div className="hidden sm:flex items-center gap-6 text-sm text-right">
        <div>
          {hasPromo ? (
            <>
              <p className="font-medium tabular-nums text-green-600">{formatPrice(product.promotional_price)}</p>
              <p className="text-xs text-muted-foreground line-through tabular-nums">{formatPrice(product.price)}</p>
            </>
          ) : (
            <>
              <p className="font-medium tabular-nums">{formatPrice(product.price)}</p>
              <p className="text-xs text-muted-foreground">preço</p>
            </>
          )}
        </div>
        <div>
          <p className="font-medium tabular-nums">{product.stock}</p>
          <p className="text-xs text-muted-foreground">estoque</p>
        </div>
      </div>

      <Badge variant={product.is_active ? 'default' : 'secondary'} className="hidden sm:inline-flex shrink-0">
        {product.is_active ? 'Ativo' : 'Inativo'}
      </Badge>

      {!isReadOnly && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(product)}>
              <Pencil className="h-4 w-4 mr-2" />Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDuplicate(product)}>
              <Copy className="h-4 w-4 mr-2" />Duplicar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive"
              onClick={() => onDelete(product.id)}>
              <Trash2 className="h-4 w-4 mr-2" />Remover
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function CatalogPage() {
  const { toast } = useToast();
  const { role } = useAuth();
  const isReadOnly = !['admin', 'manager'].includes(role || '');

  const [filters, setFilters] = useState<ProductFilters>({
    sort_by: 'created_at', sort_dir: 'desc',
  });
  const [searchInput, setSearchInput] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [catSheetOpen, setCatSheetOpen] = useState(false);
  const [importSheetOpen, setImportSheetOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  const { data: products = [], isLoading } = useProducts(filters);
  const { data: categories = [] } = useProductCategories();
  const deleteProduct = useDeleteProduct();
  const bulkUpdate = useBulkUpdateProducts();
  const bulkDelete = useBulkDeleteProducts();
  const createProduct = useCreateProduct();

  const setFilter = <K extends keyof ProductFilters>(key: K, val: ProductFilters[K]) =>
    setFilters((f) => ({ ...f, [key]: val }));

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setFilter('search', searchInput.trim() || undefined);
  };

  const toggleSelect = (id: string, checked: boolean) =>
    setSelected((prev) => { const s = new Set(prev); checked ? s.add(id) : s.delete(id); return s; });

  const toggleAll = () =>
    setSelected(selected.size === products.length ? new Set() : new Set(products.map((p) => p.id)));

  const openEdit = (p: Product) => { setEditingProduct(p); setModalOpen(true); };
  const openNew = () => { setEditingProduct(null); setModalOpen(true); };

  const handleDuplicate = (p: Product) => {
    createProduct.mutate({
      name: `${p.name} (cópia)`,
      description: p.description ?? undefined,
      price: p.price ?? undefined,
      promotional_price: p.promotional_price ?? undefined,
      stock: p.stock,
      sku: p.sku ? `${p.sku}-COPY` : undefined,
      category_id: p.category_id,
      images: p.images ?? [],
      is_active: false,
      is_featured: false,
      attributes: p.attributes ?? {},
      ai_keywords: p.ai_keywords ?? undefined,
      ai_sales_pitch: p.ai_sales_pitch ?? undefined,
    });
  };

  const exportCSV = () => {
    const header = ['id', 'nome', 'preco', 'preco_promocional', 'estoque', 'sku', 'categoria', 'ativo', 'destaque', 'criado_em'];
    const rows = products.map((p) => [
      p.id, `"${p.name}"`,
      p.price ?? '',
      p.promotional_price ?? '',
      p.stock,
      p.sku ?? '',
      p.product_categories?.name ?? '',
      p.is_active ? 'sim' : 'não',
      p.is_featured ? 'sim' : 'não',
      new Date(p.created_at).toLocaleDateString('pt-BR'),
    ]);
    const csv = [header, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `catalogo-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: `${products.length} produto(s) exportados` });
  };

  const selectedIds = Array.from(selected);
  const allCats = [...categories];

  return (
    <div className="space-y-5 p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 text-primary" />
            Catálogo
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {isReadOnly ? 'Consulte produtos e categorias' : 'Gerencie seus produtos e categorias'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {!isReadOnly && (
            <Sheet open={catSheetOpen} onOpenChange={setCatSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm">
                  <Tag className="h-4 w-4 mr-1.5" />Categorias
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-96">
                <SheetHeader><SheetTitle>Gerenciar categorias</SheetTitle></SheetHeader>
                <div className="mt-4"><CategoryEditor /></div>
              </SheetContent>
            </Sheet>
          )}

          {!isReadOnly && (
            <Sheet open={importSheetOpen} onOpenChange={setImportSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm">
                  <Upload className="h-4 w-4 mr-1.5" />Importar CSV
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-96">
                <SheetHeader><SheetTitle>Importar produtos via CSV</SheetTitle></SheetHeader>
                <CsvImportPanel onClose={() => setImportSheetOpen(false)} />
              </SheetContent>
            </Sheet>
          )}

          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-1.5" />Exportar
          </Button>

          {!isReadOnly && (
            <Button onClick={openNew}>
              <Plus className="h-4 w-4 mr-1.5" />Novo produto
            </Button>
          )}
        </div>
      </div>

      {/* Filters + view toggle */}
      <div className="flex gap-2 flex-wrap">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-52">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, SKU, descrição..."
              className="pl-9"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                if (!e.target.value) setFilter('search', undefined);
              }}
            />
          </div>
          <Button type="submit" variant="secondary" size="icon"><Search className="h-4 w-4" /></Button>
        </form>

        <Select
          value={filters.category_id ?? '__all__'}
          onValueChange={(v) => setFilter('category_id', v === '__all__' ? null : v)}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Todas as categorias" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas as categorias</SelectItem>
            {allCats.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.parent_id ? `  ↳ ${c.name}` : c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.is_active === undefined || filters.is_active === null
            ? '__all__' : filters.is_active ? 'active' : 'inactive'}
          onValueChange={(v) => setFilter('is_active', v === '__all__' ? null : v === 'active')}
        >
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="inactive">Inativos</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={`${filters.sort_by ?? 'created_at'}-${filters.sort_dir ?? 'desc'}`}
          onValueChange={(v) => {
            const [col, dir] = v.split('-');
            setFilters((f) => ({
              ...f,
              sort_by: col as ProductFilters['sort_by'],
              sort_dir: dir as ProductFilters['sort_dir'],
            }));
          }}
        >
          <SelectTrigger className="w-44">
            <SlidersHorizontal className="h-4 w-4 mr-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at-desc">Mais recentes</SelectItem>
            <SelectItem value="created_at-asc">Mais antigos</SelectItem>
            <SelectItem value="name-asc">Nome A–Z</SelectItem>
            <SelectItem value="name-desc">Nome Z–A</SelectItem>
            <SelectItem value="price-asc">Menor preço</SelectItem>
            <SelectItem value="price-desc">Maior preço</SelectItem>
            <SelectItem value="stock-asc">Menor estoque</SelectItem>
            <SelectItem value="stock-desc">Maior estoque</SelectItem>
          </SelectContent>
        </Select>

        {/* View toggle */}
        <div className="flex rounded-md border overflow-hidden">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn('h-9 w-9 rounded-none', viewMode === 'list' && 'bg-muted')}
            onClick={() => setViewMode('list')}
            title="Visualização em lista"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn('h-9 w-9 rounded-none', viewMode === 'grid' && 'bg-muted')}
            onClick={() => setViewMode('grid')}
            title="Visualização em grade"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Bulk actions — only for admin/manager, list mode only */}
      {!isReadOnly && selected.size > 0 && viewMode === 'list' && (
        <div className="flex items-center gap-3 px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg flex-wrap">
          <span className="text-sm font-medium">{selected.size} selecionado(s)</span>
          <Separator orientation="vertical" className="h-4" />
          <Button size="sm" variant="outline"
            onClick={() => bulkUpdate.mutate({ ids: selectedIds, patch: { is_active: true } },
              { onSuccess: () => setSelected(new Set()) })}>
            Ativar
          </Button>
          <Button size="sm" variant="outline"
            onClick={() => bulkUpdate.mutate({ ids: selectedIds, patch: { is_active: false } },
              { onSuccess: () => setSelected(new Set()) })}>
            Desativar
          </Button>
          <Button size="sm" variant="destructive"
            onClick={() => {
              if (window.confirm(`Remover ${selected.size} produto(s)?`))
                bulkDelete.mutate(selectedIds, { onSuccess: () => setSelected(new Set()) });
            }}>
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />Remover
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Limpar seleção
          </Button>
        </div>
      )}

      {/* Product content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : products.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="p-4 rounded-2xl bg-muted/50">
              <Package className="h-10 w-10 text-muted-foreground/40" />
            </div>
            <div className="text-center space-y-1">
              <p className="font-medium">Nenhum produto encontrado</p>
              <p className="text-sm text-muted-foreground">
                {filters.search || filters.category_id || filters.is_active !== null
                  ? 'Tente ajustar os filtros'
                  : 'Comece criando seu primeiro produto'}
              </p>
            </div>
            {!isReadOnly && !filters.search && !filters.category_id && (filters.is_active === null || filters.is_active === undefined) && (
              <Button onClick={openNew}>
                <Plus className="h-4 w-4 mr-2" />Criar produto
              </Button>
            )}
          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        /* Grade */
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground px-1">
            {products.length} produto(s){filters.search ? ` para "${filters.search}"` : ''}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {products.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                onEdit={openEdit}
                onDuplicate={handleDuplicate}
                onDelete={setDeleteId}
                isReadOnly={isReadOnly}
              />
            ))}
          </div>
        </div>
      ) : (
        /* Lista */
        <div className="space-y-2">
          {!isReadOnly && products.length > 0 && (
            <div className="flex items-center gap-3 px-3 pb-1">
              <button type="button" onClick={toggleAll} className="text-muted-foreground hover:text-foreground">
                {selected.size === products.length && products.length > 0
                  ? <CheckSquare className="h-4 w-4 text-primary" />
                  : <Square className="h-4 w-4" />}
              </button>
              <span className="text-xs text-muted-foreground">
                {products.length} produto(s){filters.search ? ` para "${filters.search}"` : ''}
              </span>
            </div>
          )}
          {isReadOnly && products.length > 0 && (
            <p className="text-xs text-muted-foreground px-3 pb-1">
              {products.length} produto(s){filters.search ? ` para "${filters.search}"` : ''}
            </p>
          )}
          {products.map((p) => (
            <ProductRow
              key={p.id}
              product={p}
              selected={selected.has(p.id)}
              onSelect={toggleSelect}
              onEdit={openEdit}
              onDuplicate={handleDuplicate}
              onDelete={setDeleteId}
              isReadOnly={isReadOnly}
            />
          ))}
        </div>
      )}

      {!isReadOnly && (
        <ProductModal
          open={modalOpen}
          onClose={() => { setModalOpen(false); setEditingProduct(null); }}
          product={editingProduct}
        />
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover produto?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteId) { deleteProduct.mutate(deleteId); setDeleteId(null); } }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
