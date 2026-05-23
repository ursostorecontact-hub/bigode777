import React from 'react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useLocation } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  LayoutDashboard,
  Users,
  Kanban,
  UserCheck,
  CheckSquare,
  BarChart3,
  Settings,
  HelpCircle,
  Share2,
  LogOut,
  Zap,
  Plug,
  MessageSquare,
  Smartphone,
  ShieldCheck,
  Target,
  ShoppingBag,
} from 'lucide-react';
import flashLogo from '@/assets/flash-logo.png';
import { Button } from '@/components/ui/button';

const mainNav = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Conversas', url: '/conversas', icon: MessageSquare },
  { title: 'Leads', url: '/leads', icon: Users },
  { title: 'Tarefas', url: '/tarefas', icon: CheckSquare },
  { title: 'Pipeline', url: '/pipeline', icon: Kanban, roles: ['admin', 'manager'] },
  { title: 'Catálogo', url: '/catalogo', icon: ShoppingBag },
  { title: 'Clientes', url: '/clientes', icon: UserCheck, roles: ['admin', 'manager'] },
  { title: 'Distribuição', url: '/distribuicao', icon: Share2, roles: ['admin', 'manager'] },
  { title: 'Relatórios', url: '/relatorios', icon: BarChart3, roles: ['admin', 'manager'] },
  { title: 'Audiências Facebook', url: '/audiencias-facebook', icon: Target, roles: ['admin'] },
];

const bottomNav = [
  { title: 'Automações', url: '/automacoes', icon: Zap, roles: ['admin'] },
  { title: 'Integrações', url: '/integracoes', icon: Plug, roles: ['admin'] },
  { title: 'WhatsApp', url: '/whatsapp', icon: Smartphone, roles: ['admin'] },
  { title: 'Configurações', url: '/configuracoes', icon: Settings, roles: ['admin'] },
  { title: 'Ajuda', url: '/ajuda', icon: HelpCircle },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { profile, role, signOut } = useAuth();
  const { isSuperAdmin } = useTenant();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;
  const canSee = (roles?: string[]) => !roles || (role && roles.includes(role));

  const initials = profile?.full_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarContent className="pt-4">
        <SidebarGroup>
          <SidebarGroupLabel className="px-4 mb-2">
            {!collapsed && (
              <div className="flex items-center gap-2">
                <img src={flashLogo} alt="Flash CRMs" width={32} height={32} />
                <span className="font-bold text-sidebar-accent-foreground text-base">Flash CRMs</span>
              </div>
            )}
            {collapsed && (
              <div className="mx-auto">
                <img src={flashLogo} alt="Flash CRMs" width={32} height={32} />
              </div>
            )}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.filter((item) => canSee(item.roles)).map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url} end className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              {bottomNav.filter((item) => canSee(item.roles)).map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url} end className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {isSuperAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive('/superadmin')}>
                    <NavLink to="/superadmin" end className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                      <ShieldCheck className="h-4 w-4" />
                      {!collapsed && <span>Super Admin</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-xs">{initials}</AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-accent-foreground truncate">{profile?.full_name || 'Usuário'}</p>
              <p className="text-xs text-sidebar-muted truncate capitalize">{role || ''}</p>
            </div>
          )}
          {!collapsed && (
            <Button variant="ghost" size="icon" onClick={signOut} className="h-8 w-8 text-sidebar-muted hover:text-sidebar-accent-foreground hover:bg-sidebar-accent">
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
