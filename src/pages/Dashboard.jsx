import React, { useEffect } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createCatalogUrl, createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';
import { format, startOfMonth, endOfMonth, isToday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ShoppingBag,
  Users,
  DollarSign,
  TrendingUp,
  Calendar,
  ChevronRight,
  Package,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Store } from
'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import OnboardingChecklist from '@/components/dashboard/OnboardingChecklist';

const StatCard = ({ title, value, icon: Icon, color, trend, subtitle }) =>
<Card className="border-0 shadow-lg shadow-gray-100/50 overflow-hidden">
    <CardContent className="p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-gray-900 mt-1 text-xl font-bold">{value}</p>
          {subtitle &&
        <p className="text-sm text-gray-400 mt-1">{subtitle}</p>
        }
          {trend &&
        <div className="flex items-center gap-1 mt-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <span className="text-sm font-medium text-emerald-600">{trend}</span>
            </div>
        }
        </div>
        <div className={`p-3 rounded-xl ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </CardContent>
  </Card>;


const statusLabels = {
  orcamento: { label: 'Orçamento', color: 'bg-gray-100 text-gray-700' },
  aprovado: { label: 'Aprovado', color: 'bg-blue-100 text-blue-700' },
  producao: { label: 'Em Produção', color: 'bg-amber-100 text-amber-700' },
  pronto: { label: 'Pronto', color: 'bg-emerald-100 text-emerald-700' },
  entregue: { label: 'Entregue', color: 'bg-green-100 text-green-700' },
  cancelado: { label: 'Cancelado', color: 'bg-red-100 text-red-700' }
};

export default function Dashboard() {
  const { user } = useAuth();

  useEffect(() => {
    if (user && !user.confeitaria_id) {
      window.location.href = createPageUrl('Onboarding');
    }
  }, [user]);

  const { data: pedidos = [] } = useQuery({
    queryKey: ['pedidos', user?.confeitaria_id],
    queryFn: () => appClient.entities.Pedido.filter({ confeitaria_id: user.confeitaria_id }, '-created_date'),
    enabled: !!user?.confeitaria_id
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes', user?.confeitaria_id],
    queryFn: () => appClient.entities.Cliente.filter({ confeitaria_id: user.confeitaria_id }),
    enabled: !!user?.confeitaria_id
  });

  const { data: contasReceber = [] } = useQuery({
    queryKey: ['contasReceber', user?.confeitaria_id],
    queryFn: () => appClient.entities.ContaReceber.filter({ confeitaria_id: user.confeitaria_id }),
    enabled: !!user?.confeitaria_id
  });

  const { data: confeitaria } = useQuery({
    queryKey: ['confeitaria', user?.confeitaria_id],
    queryFn: async () => {
      const list = await appClient.entities.Confeitaria.filter({ id: user.confeitaria_id });
      return list[0] || null;
    },
    enabled: !!user?.confeitaria_id
  });

  // Cálculos
  const hoje = new Date();
  const inicioMes = startOfMonth(hoje);
  const fimMes = endOfMonth(hoje);

  const pedidosHoje = pedidos.filter((p) => {
    if (!p.data_entrega) return false;
    return isToday(parseISO(p.data_entrega));
  });

  const pedidosEmProducao = pedidos.filter((p) => p.status === 'producao');
  const pedidosPendentes = pedidos.filter((p) => p.status === 'orcamento');

  const faturamentoMes = pedidos.
  filter((p) => {
    if (!p.created_date) return false;
    const date = parseISO(p.created_date);
    return date >= inicioMes && date <= fimMes && p.status !== 'cancelado';
  }).
  reduce((acc, p) => acc + (p.valor_total || 0), 0);

  const pedidosRecentes = pedidos.slice(0, 5);

  if (!user) return null;

  return (
    <div className="space-y-8">
      {/* Onboarding Checklist */}
      {user && confeitaria &&
        user.onboarding_finalizado !== true &&
        localStorage.getItem('cakeflow_ocultar_primeiros_passos') !== 'true' && (
        <OnboardingChecklist user={user} confeitaria={confeitaria} />
      )}

      {/* Catálogo Público */}
      {confeitaria?.slug && (() => {
        const catalogUrl = createCatalogUrl(confeitaria.slug);
        return (
          <Card className="border-0 shadow-lg shadow-rose-100/50 bg-gradient-to-r from-rose-50 to-pink-50 border-l-4 border-l-rose-400">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Store className="w-5 h-5 text-rose-600 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-rose-800 font-medium block">Seu Catálogo Público</span>
                    <p className="text-sm text-rose-600 hidden md:block truncate">
                      {catalogUrl}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => window.open(catalogUrl, '_blank')}
                  className="bg-rose-500 hover:bg-rose-600 shrink-0">
                  <ExternalLink className="w-4 h-4 md:mr-2" />
                  <span className="hidden md:inline">Ver Catálogo</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Pedidos Hoje"
          value={pedidosHoje.length}
          icon={Calendar}
          color="bg-gradient-to-br from-rose-500 to-rose-600"
          subtitle="Para entrega" />

        <StatCard
          title="Em Produção"
          value={pedidosEmProducao.length}
          icon={Package}
          color="bg-gradient-to-br from-amber-500 to-amber-600" />

        <StatCard
          title="Faturamento Mensal"
          value={`R$ ${faturamentoMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          icon={DollarSign}
          color="bg-gradient-to-br from-emerald-500 to-emerald-600"
          subtitle={format(hoje, 'MMMM yyyy', { locale: ptBR })} />

        <StatCard
          title="Clientes"
          value={clientes.length}
          icon={Users}
          color="bg-gradient-to-br from-blue-500 to-blue-600"
          subtitle="Cadastrados" />

      </div>

      {/* Alertas */}
      {pedidosPendentes.length > 0 &&
      <Card className="border-0 shadow-lg shadow-amber-100/50 bg-gradient-to-r from-amber-50 to-orange-50 border-l-4 border-l-amber-400">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              <span className="text-amber-800 font-medium">
                Você tem {pedidosPendentes.length} orçamento(s) aguardando aprovação
              </span>
              <Link to={createPageUrl('Pedidos')} className="ml-auto">
                <Button size="sm" variant="ghost" className="text-amber-700 hover:bg-amber-100">
                  Ver pedidos
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      }

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pedidos Recentes */}
        <Card className="lg:col-span-2 border-0 shadow-lg shadow-gray-100/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-bold text-gray-900">Pedidos Recentes</CardTitle>
            <Link to={createPageUrl('Pedidos')}>
              <Button variant="ghost" size="sm" className="text-gray-500 hover:text-rose-600">
                Ver todos
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {pedidosRecentes.length === 0 ?
            <div className="text-center py-8">
                <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Nenhum pedido ainda</p>
                <Link to={createPageUrl('NovoPedido')}>
                  <Button className="mt-4 bg-rose-500 hover:bg-rose-600">
                    Criar primeiro pedido
                  </Button>
                </Link>
              </div> :

            <div className="space-y-3">
                {pedidosRecentes.map((pedido) =>
              <Link
                key={pedido.id}
                to={createPageUrl(`Pedidos?id=${pedido.id}`)}
                className="flex items-center justify-between p-4 rounded-xl bg-gray-50 hover:bg-rose-50 transition-colors group">

                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-white shadow flex items-center justify-center">
                        <span className="text-sm font-bold text-rose-500">
                          #{pedido.numero || pedido.id?.slice(-4)}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 group-hover:text-rose-600 transition-colors">
                          {pedido.cliente_nome}
                        </p>
                        <p className="text-sm text-gray-500">
                          {pedido.tipo === 'personalizado' && pedido.tamanho_nome && pedido.massa_nome 
                            ? `${pedido.tamanho_nome} • ${pedido.massa_nome}` 
                            : pedido.tipo === 'produto_pronto' && pedido.produtos_catalogo?.length > 0
                              ? pedido.produtos_catalogo.map(p => `${p.quantidade}x ${p.nome}`).join(', ')
                              : 'Pedido'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge className={statusLabels[pedido.status]?.color}>
                        {statusLabels[pedido.status]?.label}
                      </Badge>
                      <p className="text-sm font-semibold text-gray-900 mt-1">
                        R$ {pedido.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </Link>
              )}
              </div>
            }
          </CardContent>
        </Card>

        {/* Entregas do Dia */}
        <Card className="border-0 shadow-lg shadow-gray-100/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-rose-500" />
              Entregas Hoje
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pedidosHoje.length === 0 ?
            <div className="text-center py-8">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">Nenhuma entrega para hoje</p>
              </div> :

            <div className="space-y-3">
                {pedidosHoje.map((pedido) =>
              <div
                key={pedido.id}
                className="p-3 rounded-xl bg-rose-50 border border-rose-100">

                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-gray-900">{pedido.cliente_nome}</span>
                      <span className="text-sm font-medium text-rose-600">
                        {pedido.horario_entrega || 'A definir'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      {pedido.tipo === 'personalizado' && pedido.tamanho_nome && pedido.massa_nome 
                        ? `${pedido.tamanho_nome} • ${pedido.massa_nome}` 
                        : pedido.tipo === 'produto_pronto' && pedido.produtos_catalogo?.length > 0
                          ? pedido.produtos_catalogo.map(p => `${p.quantidade}x ${p.nome}`).join(', ')
                          : 'Pedido'}
                    </p>
                    <Badge className={`mt-2 ${statusLabels[pedido.status]?.color}`}>
                      {statusLabels[pedido.status]?.label}
                    </Badge>
                  </div>
              )}
              </div>
            }
          </CardContent>
        </Card>
      </div>
    </div>);

}
