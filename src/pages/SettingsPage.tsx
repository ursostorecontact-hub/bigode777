import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Users, Link, Key, Loader2, UserPlus, Trash2, Smartphone, KeyRound, RefreshCw } from 'lucide-react';
import { WhatsAppSettingsSection } from '@/components/WhatsAppSettingsSection';
import { Switch } from '@/components/ui/switch';
import { useSettings, useUpdateSettings, useProfilesWithRoles } from '@/hooks/use-leads';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

function generateStrongPassword(length = 24): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '!@#$%&*';
  const all = upper + lower + digits + special;
  const randomIndex = (max: number) => crypto.getRandomValues(new Uint32Array(1))[0] % max;
  const pick = (source: string) => source[randomIndex(source.length)];

  const password = [pick(upper), pick(lower), pick(digits), pick(special)];

  for (let i = password.length; i < length; i += 1) {
    password.push(pick(all));
  }

  for (let i = password.length - 1; i > 0; i -= 1) {
    const j = randomIndex(i + 1);
    [password[i], password[j]] = [password[j], password[i]];
  }

  return password.join('');
}

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

  // Reset password dialog state
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetUserId, setResetUserId] = useState('');
  const [resetUserName, setResetUserName] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);

  useEffect(() => {
    if (settings) {
      setCompanyName(settings.company_name || '');
      setWebhookUrl(settings.webhook_url || '');
    }
  }, [settings]);

  const handleSaveCompany = () => {
    updateSettings.mutate({ id: settings?.id, company_name: companyName });
  };

  const handleSaveIntegrations = () => {
    updateSettings.mutate({ id: settings?.id, webhook_url: webhookUrl });
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
    if (newPassword.length < 8) {
      toast({ title: 'A senha deve ter no mínimo 8 caracteres', variant: 'destructive' });
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
      const description = err.message?.includes('Password is known to be weak')
        ? 'Essa senha foi considerada fraca pelo sistema. Gere outra senha forte e tente novamente.'
        : err.message;
      toast({ title: 'Erro ao criar usuário', description, variant: 'destructive' });
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

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Tem certeza que deseja remover "${userName}"? Esta ação não pode ser desfeita.`)) return;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ user_id: userId }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      toast({ title: 'Usuário removido com sucesso' });
      refetchUsers();
    } catch (err: any) {
      toast({ title: 'Erro ao remover', description: err.message, variant: 'destructive' });
    }
  };

  const handleResetPassword = async () => {
    if (!resetNewPassword || resetNewPassword.length < 8) {
      toast({ title: 'A senha deve ter no mínimo 8 caracteres', variant: 'destructive' });
      return;
    }
    setResettingPassword(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reset-user-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ user_id: resetUserId, new_password: resetNewPassword }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      toast({ title: 'Senha redefinida com sucesso!' });
      setShowResetPassword(false);
      setResetNewPassword('');
    } catch (err: any) {
      const description = err.message?.includes('Password is known to be weak')
        ? 'Essa senha foi considerada fraca pelo sistema. Gere outra senha forte e tente novamente.'
        : err.message;
      toast({ title: 'Erro ao redefinir senha', description, variant: 'destructive' });
    } finally {
      setResettingPassword(false);
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
            {(users || []).map((member) => (
              <div key={member.id} className={`flex items-center justify-between p-3 rounded-lg ${member.active ? 'bg-muted/30' : 'bg-destructive/10 opacity-60'}`}>
                <div>
                  <p className="font-medium text-sm text-foreground">{member.full_name}</p>
                  <p className="text-xs text-muted-foreground">{member.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="capitalize text-xs">{roleLabels[member.role] || member.role}</Badge>
                  <div className="flex items-center gap-2">
                    {user?.id !== member.id ? (
                      <>
                        <Switch
                          checked={member.active}
                          onCheckedChange={() => handleToggleActive(member.id, member.active)}
                          aria-label={member.active ? 'Desativar usuário' : 'Ativar usuário'}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
                          onClick={() => {
                            setResetUserId(member.id);
                            setResetUserName(member.full_name);
                            setResetNewPassword('');
                            setShowResetPassword(true);
                          }}
                          aria-label="Redefinir senha"
                          title="Redefinir senha"
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteUser(member.id, member.full_name)}
                          aria-label="Remover usuário"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    ) : null}
                    <span className={`text-xs font-medium ${member.active ? 'text-green-600' : 'text-destructive'}`}>
                      {member.active ? 'Ativo' : 'Inativo'}
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
          <CardDescription>Webhooks e integrações externas</CardDescription>
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

      {/* WhatsApp Connection */}
      <WhatsAppSettingsSection />

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
              <div className="flex gap-2">
                <PasswordInput value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mínimo 8 caracteres" className="flex-1" />
                <Button type="button" variant="outline" size="icon" title="Gerar senha forte" onClick={() => setNewPassword(generateStrongPassword())}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Use o botão para gerar uma senha forte automaticamente</p>
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

      {/* Dialog para redefinir senha */}
      <Dialog open={showResetPassword} onOpenChange={setShowResetPassword}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir Senha</DialogTitle>
            <DialogDescription>Defina uma nova senha para {resetUserName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nova Senha *</Label>
              <div className="flex gap-2">
                <PasswordInput value={resetNewPassword} onChange={e => setResetNewPassword(e.target.value)} placeholder="Mínimo 8 caracteres" className="flex-1" />
                <Button type="button" variant="outline" size="icon" title="Gerar senha forte" onClick={() => setResetNewPassword(generateStrongPassword())}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Use o botão para gerar uma senha forte automaticamente</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetPassword(false)}>Cancelar</Button>
            <Button onClick={handleResetPassword} disabled={resettingPassword}>
              {resettingPassword && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Redefinir Senha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
