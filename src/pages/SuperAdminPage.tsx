import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Building2, Users, Target, Loader2, ShieldCheck, ArrowLeft } from 'lucide-react';
import flashLogo from '@/assets/flash-logo.png';

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  email: string | null;
  max_users: number;
  created_at: string;
  owner_id: string | null;
}

interface Stats {
  totalTenants: number;
  activeTenants: number;
  totalUsers: number;
  totalLeads: number;
}

export default function SuperAdminPage() {
  const { isSuperAdmin, enterTenant } = useTenant();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [stats, setStats] = useState<Stats>({ totalTenants: 0, activeTenants: 0, totalUsers: 0, totalLeads: 0 });
  const [loading, setLoading] = useState(true);
  const [entering, setEntering] = useState<string | null>(null);

  const handleEnter = async (tenantId: string) => {
    setEntering(tenantId);
    await enterTenant(tenantId);
  };

  useEffect(() => {
    if (!isSuperAdmin) {
      navigate('/');
      return;
    }
    fetchData();
  }, [isSuperAdmin, navigate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: tenantsData } = await supabase
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: false });

      const tenantsList = (tenantsData || []) as TenantRow[];
      setTenants(tenantsList);

      const { count: usersCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      const { count: leadsCount } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true });

      setStats({
        totalTenants: tenantsList.length,
        activeTenants: tenantsList.filter(t => t.status === 'active').length,
        totalUsers: usersCount || 0,
        totalLeads: leadsCount || 0,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleTenantStatus = async (tenantId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    const { error } = await supabase
      .from('tenants')
      .update({ status: newStatus })
      .eq('id', tenantId);

    if (error) {
      toast({ title: 'Erro ao atualizar status', variant: 'destructive' });
    } else {
      toast({ title: `Empresa ${newStatus === 'active' ? 'ativada' : 'suspensa'} com sucesso` });
      fetchData();
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'active': return 'default';
      case 'suspended': return 'destructive';
      case 'trial': return 'secondary';
      default: return 'outline';
    }
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case 'active': return 'Ativo';
      case 'suspended': return 'Suspenso';
      case 'trial': return 'Trial';
      default: return s;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <img src={flashLogo} alt="Flash CRMs" className="h-8 w-8" />
            <div>
              <h1 className="font-bold text-lg flex items-center gap-2">
                Super Admin <ShieldCheck className="h-5 w-5 text-primary" />
              </h1>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar ao CRM
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Empresas', value: stats.totalTenants, icon: Building2 },
            { label: 'Ativas', value: stats.activeTenants, icon: ShieldCheck },
            { label: 'Usuários', value: stats.totalUsers, icon: Users },
            { label: 'Leads', value: stats.totalLeads, icon: Target },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <s.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tenants Table */}
        <Card>
          <CardHeader>
            <CardTitle>Empresas Cadastradas</CardTitle>
          </CardHeader>
          <CardContent>
            {tenants.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Nenhuma empresa cadastrada ainda.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criada em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell className="text-muted-foreground">{t.slug}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{t.plan}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusColor(t.status) as any}>{statusLabel(t.status)}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(t.created_at).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={entering === t.id}
                            onClick={() => handleEnter(t.id)}
                          >
                            {entering === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Entrar'}
                          </Button>
                          <Button
                            size="sm"
                            variant={t.status === 'active' ? 'destructive' : 'default'}
                            onClick={() => toggleTenantStatus(t.id, t.status)}
                          >
                            {t.status === 'active' ? 'Suspender' : 'Ativar'}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
