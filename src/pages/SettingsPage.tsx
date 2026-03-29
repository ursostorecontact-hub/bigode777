import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Users, Link, Key, Loader2, UserPlus, Power } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useSettings, useUpdateSettings, useProfilesWithRoles } from '@/hooks/use-leads';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export default function SettingsPage() {
  const { data: settings, isLoading: settingsLoading } = useSettings();
  const { data: users, isLoading: usersLoading, refetch: refetchUsers } = useProfilesWithRoles();
  const updateSettings = useUpdateSettings();
  const { toast } = useToast();
  const { user } = useAuth();

  const [companyName, setCompanyName] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');

  // New user dialog state
  const [showNewUser, setShowNewUser] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<string>('salesperson');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (settings) {
      setCompanyName(settings.company_name || '');
      setWebhookUrl(settings.webhook_url || '');
    }
  }, [settings]);

  const handleSaveCompany = () => {
    if (settings) {
      updateSettings.mutate({ id: settings.id, company_name: companyName });
    }
  };

  const handleSaveIntegrations = () => {
    if (settings) {
      updateSettings.mutate({ id: settings.id, webhook_url: webhookUrl });
    }
  };

  const copyApiKey = () => {
    if (settings?.api_key) {
      navigator.clipboard.writeText(settings.api_key);
      toast({ title: 'Chave copiada!' });
    }
  };

  const handleCreateUser = async () => {
    if (!newName || !newEmail || !newPassword) {
      toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: 'A senha deve ter no mínimo 6 caracteres', variant: 'destructive' });
      return;
    }

    setCreating(true);
    try {
      // Call edge function to create user (needs service role)
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: newEmail,
          password: newPassword,
          full_name: newName,
          role: newRole,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erro ao criar usuário');

      toast({ title: 'Usuário criado com sucesso!' });
      setShowNewUser(false);
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setNewRole('salesperson');
      refetchUsers();
    } catch (err: any) {
      toast({ title: 'Erro ao criar usuário', description: err.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (userId: string, currentActive: boolean) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/toggle-user-active`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ user_id: userId, active: !currentActive }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      toast({ title: currentActive ? 'Usuário desativado' : 'Usuário reativado' });
      refetchUsers();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  const roleLabels: Record<string, string> = { admin: 'Admin', manager: 'Gerente', salesperson: 'Vendedor' };

  if (settingsLoading || usersLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground text-sm">Gerencie as configurações do sistema</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4" />Dados da Empresa</CardTitle>
          <CardDescription>Informações que aparecem nos relatórios e documentos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nome da Empresa</Label>
            <Input value={companyName} onChange={e => setCompanyName(e.target.value)} />
          </div>
          <Button size="sm" onClick={handleSaveCompany} disabled={updateSettings.isPending}>
            {updateSettings.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar Alterações
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" />Usuários</CardTitle>
            <CardDescription>Membros da equipe</CardDescription>
          </div>
          <Button size="sm" onClick={() => setShowNewUser(true)} className="gap-1">
            <UserPlus className="h-4 w-4" />
            Novo Usuário
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(users || []).map((user) => (
              <div key={user.id} className={`flex items-center justify-between p-3 rounded-lg ${user.active ? 'bg-muted/30' : 'bg-destructive/10 opacity-60'}`}>
                <div>
                  <p className="font-medium text-sm text-foreground">{user.full_name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="capitalize text-xs">{roleLabels[user.role] || user.role}</Badge>
                  <div className="flex items-center gap-2">
                    {user?.id !== user_item_id ? (
                      <Switch
                        checked={user_item.active}
                        onCheckedChange={() => handleToggleActive(user_item.id, user_item.active)}
                        aria-label={user_item.active ? 'Desativar usuário' : 'Ativar usuário'}
                      />
                    ) : null}
                    <span className={`text-xs font-medium ${user.active ? 'text-green-600' : 'text-destructive'}`}>
                      {user.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {(users || []).length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum usuário encontrado.</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Link className="h-4 w-4" />Integrações</CardTitle>
          <CardDescription>Webhooks e integrações externas (n8n, Evolution API)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>URL do Webhook (n8n)</Label>
            <Input value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} placeholder="https://seu-n8n.com/webhook/..." />
            <p className="text-xs text-muted-foreground">Será chamado quando um lead for criado ou atualizado</p>
          </div>
          <Separator />
          <div className="space-y-2">
            <Label className="flex items-center gap-2"><Key className="h-3 w-3" />Chave de API</Label>
            <div className="flex gap-2">
              <Input readOnly value={settings?.api_key || ''} className="font-mono text-xs" />
              <Button variant="outline" size="sm" onClick={copyApiKey}>Copiar</Button>
            </div>
            <p className="text-xs text-muted-foreground">Use esta chave para integrações externas</p>
          </div>
          <Button size="sm" onClick={handleSaveIntegrations} disabled={updateSettings.isPending}>
            {updateSettings.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar Integrações
          </Button>
        </CardContent>
      </Card>

      {/* Dialog para criar novo usuário */}
      <Dialog open={showNewUser} onOpenChange={setShowNewUser}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Usuário</DialogTitle>
            <DialogDescription>Cadastre um novo membro da equipe</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome Completo *</Label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="João Silva" />
            </div>
            <div className="space-y-2">
              <Label>E-mail *</Label>
              <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="joao@empresa.com" />
            </div>
            <div className="space-y-2">
              <Label>Senha *</Label>
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
            </div>
            <div className="space-y-2">
              <Label>Função</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="salesperson">Vendedor</SelectItem>
                  <SelectItem value="manager">Gerente</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewUser(false)}>Cancelar</Button>
            <Button onClick={handleCreateUser} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar Usuário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
