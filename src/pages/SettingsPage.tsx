import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Building2, Users, Link, Key, Loader2 } from 'lucide-react';
import { useSettings, useUpdateSettings, useProfilesWithRoles } from '@/hooks/use-leads';
import { useToast } from '@/hooks/use-toast';

export default function SettingsPage() {
  const { data: settings, isLoading: settingsLoading } = useSettings();
  const { data: users, isLoading: usersLoading } = useProfilesWithRoles();
  const updateSettings = useUpdateSettings();
  const { toast } = useToast();

  const [companyName, setCompanyName] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');

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
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" />Usuários</CardTitle>
          <CardDescription>Membros da equipe</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(users || []).map((user) => (
              <div key={user.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div>
                  <p className="font-medium text-sm text-foreground">{user.full_name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="capitalize text-xs">{roleLabels[user.role] || user.role}</Badge>
                  <Badge variant={user.active ? 'default' : 'destructive'} className={`text-xs ${user.active ? 'bg-success text-success-foreground' : ''}`}>
                    {user.active ? 'Ativo' : 'Inativo'}
                  </Badge>
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
    </div>
  );
}
