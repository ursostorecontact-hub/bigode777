import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Building2, Users, Link, Key } from 'lucide-react';

export default function SettingsPage() {
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome da Empresa</Label>
              <Input defaultValue="Minha Empresa Ltda" />
            </div>
            <div className="space-y-2">
              <Label>CNPJ</Label>
              <Input defaultValue="12.345.678/0001-90" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Endereço</Label>
            <Input defaultValue="Rua Exemplo, 123 - São Paulo, SP" />
          </div>
          <Button size="sm">Salvar Alterações</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" />Usuários</CardTitle>
          <CardDescription>Gerencie os membros da equipe</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { name: 'Ana Silva', email: 'ana@empresa.com', role: 'admin', active: true },
              { name: 'Carlos Santos', email: 'carlos@empresa.com', role: 'manager', active: true },
              { name: 'Maria Oliveira', email: 'maria@empresa.com', role: 'salesperson', active: true },
              { name: 'João Lima', email: 'joao@empresa.com', role: 'salesperson', active: true },
            ].map((user) => (
              <div key={user.email} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div>
                  <p className="font-medium text-sm text-foreground">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="capitalize text-xs">{user.role === 'admin' ? 'Admin' : user.role === 'manager' ? 'Gerente' : 'Vendedor'}</Badge>
                  <Badge variant={user.active ? 'default' : 'destructive'} className={`text-xs ${user.active ? 'bg-success text-success-foreground' : ''}`}>
                    {user.active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" className="mt-4">Convidar Usuário</Button>
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
            <Input placeholder="https://seu-n8n.com/webhook/..." />
            <p className="text-xs text-muted-foreground">Será chamado quando um lead for criado ou atualizado</p>
          </div>
          <Separator />
          <div className="space-y-2">
            <Label className="flex items-center gap-2"><Key className="h-3 w-3" />Chave de API</Label>
            <div className="flex gap-2">
              <Input readOnly defaultValue="crm_key_xxxxxxxxxxxxxxxxxxxx" className="font-mono text-xs" />
              <Button variant="outline" size="sm">Copiar</Button>
            </div>
            <p className="text-xs text-muted-foreground">Use esta chave para integrações externas</p>
          </div>
          <Button size="sm">Salvar Integrações</Button>
        </CardContent>
      </Card>
    </div>
  );
}
