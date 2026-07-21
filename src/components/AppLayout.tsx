import React, { useState } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AiAssistantWidget } from '@/components/AiAssistantWidget';
import { AppSidebar } from '@/components/AppSidebar';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import { useTenant } from '@/contexts/TenantContext';
import { Bell, Search, RefreshCw, LogOut as ExitIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNavigate } from 'react-router-dom';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, role, signOut } = useAuth();
  const { isImpersonating, activeTenant, exitImpersonation } = useTenant();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [refreshing, setRefreshing] = useState(false);
  // Esconde o widget global de IA em /conversas — a página tem seu próprio painel
  const hideGlobalAI = location.pathname === '/conversas';
  const initials = profile?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries();
      toast({ title: '✅ Atualizado!', description: 'Leads, conversas e mensagens foram recarregados.' });
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          {isImpersonating && (
            <div className="h-9 flex items-center justify-center gap-2 bg-amber-500 text-amber-950 text-sm font-medium px-4 sticky top-0 z-40">
              👁️ Você está vendo a empresa: <strong>{activeTenant?.name}</strong>
              <Button size="sm" variant="ghost" className="h-6 gap-1 text-amber-950 hover:bg-amber-600/20 ml-2" onClick={exitImpersonation}>
                <ExitIcon className="h-3 w-3" /> Sair
              </Button>
            </div>
          )}
          <header className="h-14 flex items-center gap-3 px-4 border-b bg-card/50 backdrop-blur-sm sticky top-0 z-30">
            <SidebarTrigger className="shrink-0" />
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar leads, clientes..." className="pl-9 h-9 bg-muted/50 border-0" />
              </div>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={handleRefresh}
                disabled={refreshing}
                title="Atualizar leads, conversas e mensagens"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
              <Button variant="ghost" size="icon" className="relative h-9 w-9">
                <Bell className="h-4 w-4" />
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-9 gap-2 px-2">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium hidden sm:inline">{profile?.full_name?.split(' ')[0]}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem className="text-xs text-muted-foreground capitalize">{role}</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/configuracoes')}>Configurações</DropdownMenuItem>
                  <DropdownMenuItem onClick={signOut} className="text-destructive">Sair</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6 overflow-auto">
            {children}
          </main>
        </div>
        {!hideGlobalAI && <AiAssistantWidget />}
      </div>
    </SidebarProvider>
  );
}
