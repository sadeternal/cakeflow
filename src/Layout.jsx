import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { appClient } from '@/api/appClient';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { useEventTracker } from '@/lib/useEventTracker';
import CakeflowLogoIcon from '@/components/CakeflowLogoIcon';
import {
  LayoutDashboard,
  ShoppingBag,
  Users,
  Settings,
  Package,
  Cake,
  DollarSign,
  Menu,
  X,
  LogOut,
  ChevronDown,
  Store,
  TrendingUp,
  MessageCircle,
  ShieldCheck,
  Ban } from
'lucide-react';
import TrialExpiredModal from '@/components/TrialExpiredModal';
import SystemNotificationsBell from '@/components/notifications/SystemNotificationsBell';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger } from
"@/components/ui/dropdown-menu";

const PAGE_TITLE_BY_ROUTE = {
  Dashboard: 'Dashboard',
  Pedidos: 'Pedidos',
  NovoPedido: 'Novo Pedido',
  Clientes: 'Clientes',
  Produtos: 'Produtos',
  Financeiro: 'Financeiro',
  Relatorios: 'Relatorios',
  Configuracoes: 'Configuracoes',
  AjusteUsuario: 'Ajuste de Usuário',
  Suporte: 'Suporte',
  Onboarding: 'Onboarding',
  AdminPanel: 'Painel Admin'
};

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();
  const [showTrialExpired, setShowTrialExpired] = useState(false);
  const isAdminUser = user?.role === 'admin';
  const { trackEvent } = useEventTracker();
  const sessionTrackedRef = useRef(false);
  const isPublicPage =
    currentPageName === 'Onboarding' ||
    currentPageName === 'Login' ||
    currentPageName === 'Catalogo' ||
    currentPageName === 'LandingPage';

  useEffect(() => {
    // Catalogo define o titulo dinamicamente com o nome da confeitaria.
    if (currentPageName === 'Catalogo') return;

    const pageTitle = PAGE_TITLE_BY_ROUTE[currentPageName] || currentPageName;
    if (pageTitle) {
      document.title = `Cakeflow | ${pageTitle}`;
    }
  }, [currentPageName]);

  // Rastreia session_day uma vez por sessão (deduplicação real feita no banco, 1 por dia)
  useEffect(() => {
    if (isPublicPage || !user || isAdminUser || sessionTrackedRef.current) return;
    sessionTrackedRef.current = true;
    trackEvent('session_day');
  }, [user, isPublicPage, isAdminUser]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isPublicPage || !user || isAdminUser) return;

    const loadSubscription = async () => {
      try {
        const response = await appClient.functions.invoke('checkSubscriptionStatus');
        if (response.data && response.data.status === 'trial_expired') {
          setShowTrialExpired(true);
        }
      } catch (e) {
        console.error('Erro ao verificar assinatura:', e);
      }
    };
    loadSubscription();
  }, [isPublicPage, user, isAdminUser]);

  const { data: confeitaria } = useQuery({
    queryKey: ['confeitaria', user?.confeitaria_id],
    queryFn: async () => {
      if (!user?.confeitaria_id) return null;
      const list = await appClient.entities.Confeitaria.filter({ id: user.confeitaria_id });
      return list[0] || null;
    },
    enabled: !isPublicPage && !!user?.confeitaria_id
  });

  // Páginas públicas sem layout
  if (isPublicPage) {
    return <>{children}</>;
  }

  const navigation = isAdminUser
    ? [{ name: 'Painel Admin', href: 'AdminPanel', icon: ShieldCheck }]
    : [
      { name: 'Dashboard', href: 'Dashboard', icon: LayoutDashboard },
      { name: 'Pedidos', href: 'Pedidos', icon: ShoppingBag },
      { name: 'Clientes', href: 'Clientes', icon: Users },
      { name: 'Produtos', href: 'Produtos', icon: Package },
      { name: 'Financeiro', href: 'Financeiro', icon: DollarSign },
      { name: 'Relatórios', href: 'Relatorios', icon: TrendingUp },
      { name: 'Configurações', href: 'Configuracoes', icon: Settings },
      { name: 'Suporte', href: 'Suporte', icon: MessageCircle }
    ];


  const handleLogout = () => {
    appClient.auth.logout(`${window.location.origin}/auth`);
  };

  const [loadingCheckout, setLoadingCheckout] = useState(false);

  const handleSubscribe = async () => {
    setLoadingCheckout(true);
    try {
      const response = await appClient.functions.invoke('createCheckoutSession', {
        confeitaria_id: user.confeitaria_id,
      });
      if (response?.data?.url) {
        window.location.href = response.data.url;
      }
    } catch (e) {
      console.error('Erro ao abrir checkout:', e);
    } finally {
      setLoadingCheckout(false);
    }
  };

  // Se trial expirou, mostrar modal
  if (showTrialExpired) {
    return (
      <TrialExpiredModal
        onSubscribe={handleSubscribe}
        onLogout={handleLogout}
        isLoading={loadingCheckout}
      />
    );
  }

  // Se conta bloqueada, mostrar tela de bloqueio
  if (!isAdminUser && confeitaria?.bloqueado) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-amber-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-red-100 shadow-xl p-8 text-center space-y-5">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
            <Ban className="w-8 h-8 text-red-500" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-gray-900">Conta bloqueada</h1>
            <p className="text-gray-500 text-sm leading-relaxed">
              O acesso à sua conta foi temporariamente suspenso. Entre em contato com o suporte para mais informações e para regularizar sua situação.
            </p>
          </div>
          <a
            href="https://wa.me/5575999501988"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 w-full py-3 px-6 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-xl transition-colors"
          >
            Falar com o suporte
          </a>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-400 hover:text-gray-600 underline"
          >
            Sair da conta
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-amber-50">
        {/* Mobile sidebar backdrop */}
        {sidebarOpen &&
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)} />

        }

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-72 bg-white border-r border-rose-100 shadow-xl transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`
        }>

        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between p-6 border-b border-rose-100">
            <div className="flex items-center gap-3">
              <CakeflowLogoIcon className="h-10 w-10" />
              <div>
                <h1 className="font-bold text-gray-900 text-lg">CakeFlow</h1>
                <p className="text-xs text-gray-500">Sistema para Confeitarias</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 rounded-lg hover:bg-rose-50">

              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Confeitaria info */}
          {confeitaria &&
          <div className="px-4 py-3 mx-4 mt-4 rounded-xl bg-gradient-to-r from-rose-50 to-amber-50 border border-rose-100">
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-rose-500" />
                <span className="font-medium text-gray-800 text-sm truncate">
                  {confeitaria.nome}
                </span>
              </div>
            </div>
          }

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = currentPageName === item.href;
              return (
                <Link
                  key={item.name}
                  to={createPageUrl(item.href)}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive ?
                  'bg-gradient-to-r from-rose-500 to-rose-600 text-white shadow-lg shadow-rose-200' :
                  'text-gray-600 hover:bg-rose-50 hover:text-rose-600'}`
                  }>

                  <item.icon className={`w-5 h-5 ${isActive ? 'text-white' : ''}`} />
                  {item.name}
                </Link>);

            })}
          </nav>

          {/* User section */}
          {user &&
          <div className="p-4 border-t border-rose-100">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-rose-50 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-400 to-rose-500 flex items-center justify-center text-white font-semibold">
                      {user.full_name?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {user.full_name || 'Usuário'}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    </div>
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem asChild>
                    <Link to={createPageUrl('AjusteUsuario')}>
                      <Settings className="w-4 h-4 mr-2" />
                      Ajuste de Usuário
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                    <LogOut className="w-4 h-4 mr-2" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          }
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-72">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-rose-100">
          <div className="flex items-center justify-between px-4 py-4 lg:px-8">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl hover:bg-rose-50">

              <Menu className="w-6 h-6 text-gray-600" />
            </button>
            <div className="flex-1 lg:flex-none">
              <h2 className="text-xl font-bold text-gray-900 lg:text-2xl">
                {navigation.find((n) => n.href === currentPageName)?.name ||
                PAGE_TITLE_BY_ROUTE[currentPageName] ||
                currentPageName}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <SystemNotificationsBell />
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-8">
          {children}
        </main>
      </div>
      </div>
      );

      }
