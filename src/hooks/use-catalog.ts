import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useToast } from '@/hooks/use-toast';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ProductCategory {
  id: string;
  tenant_id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  price: number | null;
  promotional_price: number | null;
  stock: number;
  sku: string | null;
  category_id: string | null;
  images: string[];
  is_active: boolean;
  is_featured: boolean;
  attributes: Record<string, string>;
  ai_keywords: string | null;
  ai_sales_pitch: string | null;
  created_at: string;
  updated_at: string;
  product_categories?: ProductCategory | null;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  name: string;
  price_adjustment: number;
  stock: number;
  attributes: Record<string, string>;
  created_at: string;
}

export interface CreateProductInput {
  name: string;
  description?: string;
  price?: number | null;
  promotional_price?: number | null;
  stock?: number;
  sku?: string;
  category_id?: string | null;
  images?: string[];
  is_active?: boolean;
  is_featured?: boolean;
  attributes?: Record<string, string>;
  ai_keywords?: string;
  ai_sales_pitch?: string;
}

export interface UpdateProductInput extends Partial<CreateProductInput> {
  id: string;
}

export interface CreateCategoryInput {
  name: string;
  parent_id?: string | null;
}

export interface ProductFilters {
  search?: string;
  category_id?: string | null;
  is_active?: boolean | null;
  sort_by?: 'name' | 'price' | 'stock' | 'created_at';
  sort_dir?: 'asc' | 'desc';
}

// ── Categories ─────────────────────────────────────────────────────────────────

export function useProductCategories() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['product-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_categories')
        .select('*')
        .order('name');
      if (error) throw error;
      return (data ?? []) as ProductCategory[];
    },
    enabled: !!user,
  });
}

export function useCreateCategory() {
  const { toast } = useToast();
  const { tenant } = useTenant();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateCategoryInput) => {
      const { data, error } = await supabase
        .from('product_categories')
        .insert({ ...input, tenant_id: tenant!.id })
        .select()
        .single();
      if (error) throw error;
      return data as ProductCategory;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
      toast({ title: 'Categoria criada com sucesso' });
    },
    onError: (e: Error) => toast({ title: 'Erro ao criar categoria', description: e.message, variant: 'destructive' }),
  });
}

export function useUpdateCategory() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Partial<CreateCategoryInput>) => {
      const { error } = await supabase.from('product_categories').update(input).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
      toast({ title: 'Categoria atualizada' });
    },
    onError: (e: Error) => toast({ title: 'Erro ao atualizar categoria', description: e.message, variant: 'destructive' }),
  });
}

export function useDeleteCategory() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('product_categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Categoria removida' });
    },
    onError: (e: Error) => toast({ title: 'Erro ao remover categoria', description: e.message, variant: 'destructive' }),
  });
}

// ── Products ───────────────────────────────────────────────────────────────────

export function useProducts(filters?: ProductFilters) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['products', filters],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select('*, product_categories(id, name)');

      if (filters?.search) {
        query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%,sku.ilike.%${filters.search}%`);
      }
      if (filters?.category_id) {
        query = query.eq('category_id', filters.category_id);
      }
      if (filters?.is_active !== null && filters?.is_active !== undefined) {
        query = query.eq('is_active', filters.is_active);
      }

      const sortCol = filters?.sort_by ?? 'created_at';
      const sortDir = filters?.sort_dir ?? 'desc';
      query = query.order(sortCol, { ascending: sortDir === 'asc' });

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Product[];
    },
    enabled: !!user,
  });
}

export function useCreateProduct() {
  const { toast } = useToast();
  const { tenant } = useTenant();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateProductInput) => {
      const { data, error } = await supabase
        .from('products')
        .insert({ ...input, tenant_id: tenant!.id })
        .select()
        .single();
      if (error) throw error;
      return data as Product;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Produto criado com sucesso' });
    },
    onError: (e: Error) => toast({ title: 'Erro ao criar produto', description: e.message, variant: 'destructive' }),
  });
}

export function useUpdateProduct() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateProductInput) => {
      const { error } = await supabase.from('products').update(input).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Produto atualizado' });
    },
    onError: (e: Error) => toast({ title: 'Erro ao atualizar produto', description: e.message, variant: 'destructive' }),
  });
}

export function useDeleteProduct() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Produto removido' });
    },
    onError: (e: Error) => toast({ title: 'Erro ao remover produto', description: e.message, variant: 'destructive' }),
  });
}

export function useBulkUpdateProducts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ids, patch }: { ids: string[]; patch: Partial<CreateProductInput> }) => {
      const { error } = await supabase.from('products').update(patch).in('id', ids);
      if (error) throw error;
    },
    onSuccess: (_, { ids }) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: `${ids.length} produto(s) atualizados` });
    },
    onError: (e: Error) => toast({ title: 'Erro na operação em massa', description: e.message, variant: 'destructive' }),
  });
}

export function useBulkDeleteProducts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('products').delete().in('id', ids);
      if (error) throw error;
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: `${ids.length} produto(s) removidos` });
    },
    onError: (e: Error) => toast({ title: 'Erro ao remover produtos', description: e.message, variant: 'destructive' }),
  });
}

// ── Image upload ───────────────────────────────────────────────────────────────

export async function uploadProductImage(file: File, tenantId: string): Promise<string> {
  const ext = file.name.split('.').pop();
  const path = `${tenantId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from('product-images').upload(path, file, { upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from('product-images').getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteProductImage(url: string): Promise<void> {
  const base = supabase.storage.from('product-images').getPublicUrl('').data.publicUrl;
  const path = url.replace(base, '');
  await supabase.storage.from('product-images').remove([path]);
}
