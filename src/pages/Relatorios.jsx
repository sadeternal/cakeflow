import React, { useEffect } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';
import { startOfMonth, endOfMonth, subMonths, format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Award,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  Users
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

const COLORS = ['#ec4899', '#f97316', '#8b5cf6', '#06b6d4', '#84cc16', '#f59e0b'];

export default function Relatorios() {
  const { user } = useAuth();

  useEffect(() => {
    if (user && !user.confeitaria_id) {
      window.location.href = createPageUrl('Onboarding');
    }
  }, [user]);

  const { data: pedidos = [] } = useQuery({
    queryKey: ['pedidos-relatorio', user?.confeitaria_id],
    queryFn: () => appClient.entities.Pedido.filter({ confeitaria_id: user.confeitaria_id }),
    enabled: !!user?.confeitaria_id,
  });

  const { data: contasReceber = [] } = useQuery({
    queryKey: ['contasReceber-relatorio', user?.confeitaria_id],
    queryFn: () => appClient.entities.ContaReceber.filter({ confeitaria_id: user.confeitaria_id }),
    enabled: !!user?.confeitaria_id,
  });

  const { data: contasPagar = [] } = useQuery({
    queryKey: ['contasPagar-relatorio', user?.confeitaria_id],
    queryFn: () => appClient.entities.ContaPagar.filter({ confeitaria_id: user.confeitaria_id }),
    enabled: !!user?.confeitaria_id,
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos-relatorio', user?.confeitaria_id],
    queryFn: () => appClient.entities.Produto.filter({ confeitaria_id: user.confeitaria_id }),
    enabled: !!user?.confeitaria_id,
  });

  const { data: acessosCatalogo = [], refetch: refetchAcessos } = useQuery({
    queryKey: ['acessos-catalogo', user?.confeitaria_id],
    queryFn: () => appClient.entities.AcessoCatalogo.filter({ confeitaria_id: user.confeitaria_id }),
    enabled: !!user?.confeitaria_id,
  });

  // Calcular dados dos últimos 6 meses
  const getLast6MonthsData = () => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      const inicio = startOfMonth(date);
      const fim = endOfMonth(date);
      
      const pedidosMes = pedidos.filter(p => {
        if (!p.created_date) return false;
        const pedidoDate = parseISO(p.created_date);
        return pedidoDate >= inicio && pedidoDate <= fim && p.status !== 'cancelado';
      });

      const receitasMes = contasReceber.filter(c => {
        if (!c.data_recebimento) return false;
        const dataRec = parseISO(c.data_recebimento);
        return dataRec >= inicio && dataRec <= fim && c.recebido;
      });

      const despesasMes = contasPagar.filter(c => {
        if (!c.data_pagamento) return false;
        const dataPag = parseISO(c.data_pagamento);
        return dataPag >= inicio && dataPag <= fim && c.pago;
      });

      const faturamento = pedidosMes.reduce((acc, p) => acc + (p.valor_total || 0), 0);
      const receitas = receitasMes.reduce((acc, r) => acc + (r.valor || 0), 0);
      const despesas = despesasMes.reduce((acc, d) => acc + (d.valor || 0), 0);

      months.push({
        mes: format(date, 'MMM', { locale: ptBR }),
        faturamento,
        receitas,
        despesas,
        lucro: receitas - despesas,
        pedidos: pedidosMes.length,
      });
    }
    return months;
  };

  // Mês atual
  const mesAtual = new Date();
  const inicioMesAtual = startOfMonth(mesAtual);
  const fimMesAtual = endOfMonth(mesAtual);

  const pedidosMesAtual = pedidos.filter(p => {
    if (!p.created_date) return false;
    const date = parseISO(p.created_date);
    return date >= inicioMesAtual && date <= fimMesAtual && p.status !== 'cancelado';
  });

  const receitasMesAtual = contasReceber.filter(c => {
    if (!c.data_recebimento) return false;
    const date = parseISO(c.data_recebimento);
    return date >= inicioMesAtual && date <= fimMesAtual && c.recebido;
  });

  const despesasMesAtual = contasPagar.filter(c => {
    if (!c.data_pagamento) return false;
    const date = parseISO(c.data_pagamento);
    return date >= inicioMesAtual && date <= fimMesAtual && c.pago;
  });

  const faturamentoAtual = pedidosMesAtual.reduce((acc, p) => acc + (p.valor_total || 0), 0);
  const receitasAtual = receitasMesAtual.reduce((acc, r) => acc + (r.valor || 0), 0);
  const despesasAtual = despesasMesAtual.reduce((acc, d) => acc + (d.valor || 0), 0);
  const lucroAtual = receitasAtual - despesasAtual;

  // Mês anterior para comparação
  const mesAnterior = subMonths(mesAtual, 1);
  const inicioMesAnterior = startOfMonth(mesAnterior);
  const fimMesAnterior = endOfMonth(mesAnterior);

  const pedidosMesAnterior = pedidos.filter(p => {
    if (!p.created_date) return false;
    const date = parseISO(p.created_date);
    return date >= inicioMesAnterior && date <= fimMesAnterior && p.status !== 'cancelado';
  });

  const faturamentoAnterior = pedidosMesAnterior.reduce((acc, p) => acc + (p.valor_total || 0), 0);
  const variacaoFaturamento = faturamentoAnterior > 0 
    ? ((faturamentoAtual - faturamentoAnterior) / faturamentoAnterior) * 100 
    : 0;

  // Itens mais solicitados organizados por categoria
  const contagemMassas = {};
  const contagemRecheios = {};
  const contagemCoberturas = {};
  const contagemDoces = {};
  const contagemSalgados = {};
  const contagemProdutos = {};
  
  pedidos.forEach(p => {
    // Massas
    if (p.massa_nome) {
      contagemMassas[p.massa_nome] = (contagemMassas[p.massa_nome] || 0) + 1;
    }
    // Recheios
    p.recheios?.forEach(r => {
      contagemRecheios[r.nome] = (contagemRecheios[r.nome] || 0) + 1;
    });
    // Coberturas
    if (p.cobertura_nome) {
      contagemCoberturas[p.cobertura_nome] = (contagemCoberturas[p.cobertura_nome] || 0) + 1;
    }
    // Doces
    p.doces?.forEach(d => {
      contagemDoces[d.nome] = (contagemDoces[d.nome] || 0) + d.quantidade;
    });
    // Salgados
    p.salgados?.forEach(s => {
      contagemSalgados[s.nome] = (contagemSalgados[s.nome] || 0) + s.quantidade;
    });
  });

  // Contar produtos do catálogo (de pedidos de produtos prontos)
  const produtosPedidosMap = {};

  pedidos.forEach(p => {
    if (p.tipo === 'produto_pronto' && p.produtos_catalogo) {
      p.produtos_catalogo.forEach(produto => {
        produtosPedidosMap[produto.nome] = (produtosPedidosMap[produto.nome] || 0) + produto.quantidade;
      });
    }
  });

  const massasMaisSolicitadas = Object.entries(contagemMassas)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([nome, quantidade]) => ({ nome, quantidade }));

  const recheiosMaisSolicitados = Object.entries(contagemRecheios)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([nome, quantidade]) => ({ nome, quantidade }));

  const coberturasMaisSolicitadas = Object.entries(contagemCoberturas)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([nome, quantidade]) => ({ nome, quantidade }));

  const docesMaisSolicitados = Object.entries(contagemDoces)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([nome, quantidade]) => ({ nome, quantidade }));

  const salgadosMaisSolicitados = Object.entries(contagemSalgados)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([nome, quantidade]) => ({ nome, quantidade }));

  const produtosMaisPedidos = Object.entries(produtosPedidosMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([nome, quantidade]) => ({ nome, quantidade }));

  // Status dos pedidos
  const statusCount = pedidos.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {});

  const statusData = Object.entries(statusCount).map(([status, count]) => ({
    name: status,
    value: count,
  }));

  const dados6Meses = getLast6MonthsData();

  // Analytics do Catálogo
  const totalAcessos = acessosCatalogo.length;
  const acessosUnicos = new Set(acessosCatalogo.map(a => a.session_id)).size;
  
  // Acessos por dia nos últimos 30 dias
  const hoje = new Date();
  const dias30Atras = new Date(hoje);
  dias30Atras.setDate(hoje.getDate() - 30);
  
  const acessosUltimos30Dias = acessosCatalogo.filter(a => {
    if (!a.created_date) return false;
    const dataAcesso = parseISO(a.created_date);
    return dataAcesso >= dias30Atras;
  });

  // Agrupar acessos por dia
  const acessosPorDia = {};
  for (let i = 0; i < 30; i++) {
    const dia = new Date(hoje);
    dia.setDate(hoje.getDate() - i);
    const diaStr = format(dia, 'dd/MM');
    acessosPorDia[diaStr] = 0;
  }

  acessosUltimos30Dias.forEach(a => {
    const dia = format(parseISO(a.created_date), 'dd/MM');
    if (acessosPorDia[dia] !== undefined) {
      acessosPorDia[dia]++;
    }
  });

  const dadosAcessosDiarios = Object.entries(acessosPorDia)
    .map(([dia, acessos]) => ({ dia, acessos }))
    .reverse();

  // Acessos únicos nos últimos 30 dias
  const sessionsUltimos30Dias = new Set(
    acessosUltimos30Dias.map(a => a.session_id)
  ).size;

  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Relatórios e Análises</h1>
        <p className="text-gray-500">Visão geral do desempenho do seu negócio</p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="geral" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="geral">Geral</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="space-y-6 mt-6">

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-0 shadow-lg shadow-gray-100/50">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Faturamento Mensal</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  R$ {faturamentoAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                {variacaoFaturamento !== 0 && (
                  <div className={`flex items-center gap-1 mt-2 ${variacaoFaturamento > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {variacaoFaturamento > 0 ? (
                      <ArrowUpRight className="w-4 h-4" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4" />
                    )}
                    <span className="text-sm font-medium">
                      {Math.abs(variacaoFaturamento).toFixed(1)}% vs mês anterior
                    </span>
                  </div>
                )}
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-rose-500 to-rose-600">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg shadow-gray-100/50">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Pedidos no Mês</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{pedidosMesAtual.length}</p>
                <p className="text-sm text-gray-500 mt-2">
                  Média: R$ {pedidosMesAtual.length > 0 
                    ? (faturamentoAtual / pedidosMesAtual.length).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                    : '0,00'
                  }
                </p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600">
                <ShoppingBag className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg shadow-gray-100/50">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Receitas Mensais</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">
                  R$ {receitasAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  {receitasMesAtual.length} transações
                </p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg shadow-gray-100/50">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Despesas Mensais</p>
                <p className="text-2xl font-bold text-red-600 mt-1">
                  R$ {despesasAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Lucro: R$ {lucroAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600">
                <Calendar className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Faturamento dos Últimos 6 Meses */}
        <Card className="border-0 shadow-lg shadow-gray-100/50">
          <CardHeader>
            <CardTitle>Faturamento - Últimos 6 Meses</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dados6Meses}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis />
                <Tooltip 
                  formatter={(value) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="faturamento" 
                  stroke="#ec4899" 
                  strokeWidth={2}
                  name="Faturamento"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Receitas vs Despesas */}
        <Card className="border-0 shadow-lg shadow-gray-100/50">
          <CardHeader>
            <CardTitle>Receitas vs Despesas - Últimos 6 Meses</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dados6Meses}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis />
                <Tooltip 
                  formatter={(value) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                />
                <Legend />
                <Bar dataKey="receitas" fill="#10b981" name="Receitas" />
                <Bar dataKey="despesas" fill="#ef4444" name="Despesas" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Quantidade de Pedidos */}
        <Card className="border-0 shadow-lg shadow-gray-100/50">
          <CardHeader>
            <CardTitle>Quantidade de Pedidos - Últimos 6 Meses</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dados6Meses}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="pedidos" fill="#3b82f6" name="Pedidos" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Status dos Pedidos */}
        <Card className="border-0 shadow-lg shadow-gray-100/50">
          <CardHeader>
            <CardTitle>Distribuição por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Itens Mais Solicitados por Categoria */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Massas */}
        <Card className="border-0 shadow-lg shadow-gray-100/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Award className="w-5 h-5 text-rose-500" />
              Massas Mais Solicitadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {massasMaisSolicitadas.length > 0 ? (
              <div className="space-y-2">
                {massasMaisSolicitadas.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-rose-100 flex items-center justify-center">
                        <span className="text-xs font-bold text-rose-600">#{index + 1}</span>
                      </div>
                      <span className="font-medium text-gray-900 text-sm">{item.nome}</span>
                    </div>
                    <Badge className="bg-rose-100 text-rose-700 text-xs">
                      {item.quantidade}x
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8 text-sm">
                Nenhum dado disponível ainda
              </p>
            )}
          </CardContent>
        </Card>

        {/* Recheios */}
        <Card className="border-0 shadow-lg shadow-gray-100/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Award className="w-5 h-5 text-amber-500" />
              Recheios Mais Solicitados
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recheiosMaisSolicitados.length > 0 ? (
              <div className="space-y-2">
                {recheiosMaisSolicitados.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center">
                        <span className="text-xs font-bold text-amber-600">#{index + 1}</span>
                      </div>
                      <span className="font-medium text-gray-900 text-sm">{item.nome}</span>
                    </div>
                    <Badge className="bg-amber-100 text-amber-700 text-xs">
                      {item.quantidade}x
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8 text-sm">
                Nenhum dado disponível ainda
              </p>
            )}
          </CardContent>
        </Card>

        {/* Coberturas */}
        <Card className="border-0 shadow-lg shadow-gray-100/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Award className="w-5 h-5 text-purple-500" />
              Coberturas Mais Solicitadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {coberturasMaisSolicitadas.length > 0 ? (
              <div className="space-y-2">
                {coberturasMaisSolicitadas.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center">
                        <span className="text-xs font-bold text-purple-600">#{index + 1}</span>
                      </div>
                      <span className="font-medium text-gray-900 text-sm">{item.nome}</span>
                    </div>
                    <Badge className="bg-purple-100 text-purple-700 text-xs">
                      {item.quantidade}x
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8 text-sm">
                Nenhum dado disponível ainda
              </p>
            )}
          </CardContent>
        </Card>

        {/* Doces */}
        <Card className="border-0 shadow-lg shadow-gray-100/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Award className="w-5 h-5 text-pink-500" />
              Doces Mais Solicitados
            </CardTitle>
          </CardHeader>
          <CardContent>
            {docesMaisSolicitados.length > 0 ? (
              <div className="space-y-2">
                {docesMaisSolicitados.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-pink-100 flex items-center justify-center">
                        <span className="text-xs font-bold text-pink-600">#{index + 1}</span>
                      </div>
                      <span className="font-medium text-gray-900 text-sm">{item.nome}</span>
                    </div>
                    <Badge className="bg-pink-100 text-pink-700 text-xs">
                      {item.quantidade} un.
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8 text-sm">
                Nenhum dado disponível ainda
              </p>
            )}
          </CardContent>
        </Card>

        {/* Salgados */}
        <Card className="border-0 shadow-lg shadow-gray-100/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Award className="w-5 h-5 text-orange-500" />
              Salgados Mais Solicitados
            </CardTitle>
          </CardHeader>
          <CardContent>
            {salgadosMaisSolicitados.length > 0 ? (
              <div className="space-y-2">
                {salgadosMaisSolicitados.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center">
                        <span className="text-xs font-bold text-orange-600">#{index + 1}</span>
                      </div>
                      <span className="font-medium text-gray-900 text-sm">{item.nome}</span>
                    </div>
                    <Badge className="bg-orange-100 text-orange-700 text-xs">
                      {item.quantidade} un.
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8 text-sm">
                Nenhum dado disponível ainda
              </p>
            )}
          </CardContent>
        </Card>

        {/* Produtos do Catálogo */}
        <Card className="border-0 shadow-lg shadow-gray-100/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Award className="w-5 h-5 text-blue-500" />
              Produtos Mais Pedidos (Catálogo)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {produtosMaisPedidos.length > 0 ? (
              <div className="space-y-2">
                {produtosMaisPedidos.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-xs font-bold text-blue-600">#{index + 1}</span>
                      </div>
                      <span className="font-medium text-gray-900 text-sm">{item.nome}</span>
                    </div>
                    <Badge className="bg-blue-100 text-blue-700 text-xs">
                      {item.quantidade}x
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8 text-sm">
                Nenhum dado disponível ainda
              </p>
            )}
          </CardContent>
        </Card>
      </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6 mt-6">
          {/* Header com botão de atualizar */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Analytics do Catálogo</h2>
              <p className="text-sm text-gray-500 mt-1">Acompanhe os acessos ao seu catálogo público</p>
            </div>
            <Button onClick={() => refetchAcessos()} variant="outline" size="sm">
              <TrendingUp className="w-4 h-4 mr-2" />
              Atualizar
            </Button>
          </div>

          {/* Cards de Analytics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-0 shadow-lg shadow-gray-100/50">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Total de Acessos</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{totalAcessos}</p>
                    <p className="text-sm text-gray-500 mt-2">
                      Todos os tempos
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600">
                    <Eye className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg shadow-gray-100/50">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Visitantes Únicos</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{acessosUnicos}</p>
                    <p className="text-sm text-gray-500 mt-2">
                      Todos os tempos
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg shadow-gray-100/50">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Últimos 30 Dias</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{acessosUltimos30Dias.length}</p>
                    <p className="text-sm text-gray-500 mt-2">
                      {sessionsUltimos30Dias} visitantes únicos
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600">
                    <TrendingUp className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico de Acessos */}
          <Card className="border-0 shadow-lg shadow-gray-100/50">
            <CardHeader>
              <CardTitle>Acessos ao Catálogo - Últimos 30 Dias</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={dadosAcessosDiarios}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dia" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="acessos" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    name="Acessos"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Informação Adicional */}
          <Card className="border-0 shadow-lg shadow-gray-100/50 bg-gradient-to-br from-blue-50 to-purple-50">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-blue-100">
                  <Eye className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Sobre os Analytics do Catálogo</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Esses dados mostram quantas vezes seu catálogo público foi acessado e quantos visitantes únicos você teve. 
                    Use essas informações para entender o alcance da sua confeitaria e identificar os melhores momentos de engajamento.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
