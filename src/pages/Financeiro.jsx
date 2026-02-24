import React, { useEffect, useState } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Plus,
  ArrowUpCircle,
  ArrowDownCircle,
  Check,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const categoriasPagar = [
  { value: 'ingredientes', label: 'Ingredientes' },
  { value: 'embalagens', label: 'Embalagens' },
  { value: 'entregas', label: 'Entregas' },
  { value: 'equipamentos', label: 'Equipamentos' },
  { value: 'aluguel', label: 'Aluguel' },
  { value: 'outros', label: 'Outros' },
];

const tiposReceber = [
  { value: 'sinal', label: 'Sinal' },
  { value: 'pagamento_final', label: 'Pagamento Final' },
  { value: 'outro', label: 'Outro' },
];

export default function Financeiro() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('visao');
  const [showContaPagarForm, setShowContaPagarForm] = useState(false);
  const [showContaReceberForm, setShowContaReceberForm] = useState(false);
  const [mesAtual, setMesAtual] = useState(format(new Date(), 'yyyy-MM'));
  const queryClient = useQueryClient();

  const [contaPagarForm, setContaPagarForm] = useState({
    descricao: '',
    fornecedor: '',
    valor: '',
    data_vencimento: '',
    categoria: 'ingredientes',
  });

  const [contaReceberForm, setContaReceberForm] = useState({
    cliente_nome: '',
    descricao: '',
    valor: '',
    data_vencimento: '',
    tipo: 'pagamento_final',
  });

  useEffect(() => {
    if (user && !user.confeitaria_id) {
      window.location.href = createPageUrl('Onboarding');
    }
  }, [user]);

  const { data: contasReceber = [] } = useQuery({
    queryKey: ['contasReceber', user?.confeitaria_id],
    queryFn: () => appClient.entities.ContaReceber.filter({ confeitaria_id: user.confeitaria_id }, '-data_vencimento'),
    enabled: !!user?.confeitaria_id,
  });

  const { data: contasPagar = [] } = useQuery({
    queryKey: ['contasPagar', user?.confeitaria_id],
    queryFn: () => appClient.entities.ContaPagar.filter({ confeitaria_id: user.confeitaria_id }, '-data_vencimento'),
    enabled: !!user?.confeitaria_id,
  });

  const { data: pedidos = [] } = useQuery({
    queryKey: ['pedidos', user?.confeitaria_id],
    queryFn: () => appClient.entities.Pedido.filter({ confeitaria_id: user.confeitaria_id }),
    enabled: !!user?.confeitaria_id,
  });

  // Mutations
  const createContaPagar = useMutation({
    mutationFn: (data) => appClient.entities.ContaPagar.create({
      ...data,
      valor: parseFloat(data.valor) || 0,
      confeitaria_id: user.confeitaria_id,
      pago: false,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['contasPagar']);
      setShowContaPagarForm(false);
      setContaPagarForm({
        descricao: '',
        fornecedor: '',
        valor: '',
        data_vencimento: '',
        categoria: 'ingredientes',
      });
    },
  });

  const createContaReceber = useMutation({
    mutationFn: (data) => appClient.entities.ContaReceber.create({
      ...data,
      valor: parseFloat(data.valor) || 0,
      confeitaria_id: user.confeitaria_id,
      recebido: false,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['contasReceber']);
      setShowContaReceberForm(false);
      setContaReceberForm({
        cliente_nome: '',
        descricao: '',
        valor: '',
        data_vencimento: '',
        tipo: 'pagamento_final',
      });
    },
  });

  const marcarPago = useMutation({
    mutationFn: ({ id, pago }) => appClient.entities.ContaPagar.update(id, { 
      pago, 
      data_pagamento: pago ? format(new Date(), 'yyyy-MM-dd') : null 
    }),
    onSuccess: () => queryClient.invalidateQueries(['contasPagar']),
  });

  const marcarRecebido = useMutation({
    mutationFn: ({ id, recebido }) => appClient.entities.ContaReceber.update(id, { 
      recebido, 
      data_recebimento: recebido ? format(new Date(), 'yyyy-MM-dd') : null 
    }),
    onSuccess: () => queryClient.invalidateQueries(['contasReceber']),
  });

  const deleteContaPagar = useMutation({
    mutationFn: (id) => appClient.entities.ContaPagar.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['contasPagar']),
  });

  const deleteContaReceber = useMutation({
    mutationFn: (id) => appClient.entities.ContaReceber.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['contasReceber']),
  });

  // Cálculos
  const mesSelecionado = parseISO(`${mesAtual}-01`);
  const inicioMes = startOfMonth(mesSelecionado);
  const fimMes = endOfMonth(mesSelecionado);

  const pedidosMes = pedidos.filter(p => {
    if (!p.created_date) return false;
    const date = parseISO(p.created_date);
    return isWithinInterval(date, { start: inicioMes, end: fimMes }) && p.status !== 'cancelado';
  });

  const receitaMes = pedidosMes.reduce((acc, p) => acc + (p.valor_total || 0), 0);

  const despesasMes = contasPagar
    .filter(c => {
      if (!c.data_vencimento) return false;
      const date = parseISO(c.data_vencimento);
      return isWithinInterval(date, { start: inicioMes, end: fimMes });
    })
    .reduce((acc, c) => acc + (c.valor || 0), 0);

  const lucroMes = receitaMes - despesasMes;

  const aReceberPendente = contasReceber.filter(c => !c.recebido).reduce((acc, c) => acc + (c.valor || 0), 0);
  const aPagarPendente = contasPagar.filter(c => !c.pago).reduce((acc, c) => acc + (c.valor || 0), 0);

  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* Seletor de Mês */}
      <div className="flex items-center justify-between">
        <Input
          type="month"
          value={mesAtual}
          onChange={(e) => setMesAtual(e.target.value)}
          className="w-48"
        />
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-lg shadow-gray-100/50">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">Receita do Mês</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  R$ {receitaMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-sm text-gray-400 mt-1">{pedidosMes.length} pedidos</p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-100">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg shadow-gray-100/50">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">Despesas do Mês</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  R$ {despesasMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-red-100">
                <TrendingDown className="w-5 h-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg shadow-gray-100/50">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">Lucro do Mês</p>
                <p className={`text-2xl font-bold mt-1 ${lucroMes >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  R$ {lucroMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className={`p-3 rounded-xl ${lucroMes >= 0 ? 'bg-emerald-100' : 'bg-red-100'}`}>
                <DollarSign className={`w-5 h-5 ${lucroMes >= 0 ? 'text-emerald-600' : 'text-red-600'}`} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg shadow-gray-100/50">
          <CardContent className="p-5">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">A Receber</span>
                <span className="font-semibold text-emerald-600">
                  R$ {aReceberPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">A Pagar</span>
                <span className="font-semibold text-red-600">
                  R$ {aPagarPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-100">
          <TabsTrigger value="visao">Visão Geral</TabsTrigger>
          <TabsTrigger value="receber">A Receber</TabsTrigger>
          <TabsTrigger value="pagar">A Pagar</TabsTrigger>
        </TabsList>

        <TabsContent value="visao" className="mt-6">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Últimos Recebimentos */}
            <Card className="border-0 shadow-lg shadow-gray-100/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ArrowUpCircle className="w-5 h-5 text-emerald-500" />
                  Recebimentos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {contasReceber.filter(c => c.recebido).slice(0, 5).length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">Nenhum recebimento</p>
                ) : (
                  <div className="space-y-2">
                    {contasReceber.filter(c => c.recebido).slice(0, 5).map((conta) => (
                      <div key={conta.id} className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900">{conta.cliente_nome || conta.descricao}</p>
                          <p className="text-sm text-gray-500">
                            {conta.data_recebimento && format(parseISO(conta.data_recebimento), "dd/MM/yyyy")}
                          </p>
                        </div>
                        <span className="font-semibold text-emerald-600">
                          + R$ {conta.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Últimos Pagamentos */}
            <Card className="border-0 shadow-lg shadow-gray-100/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ArrowDownCircle className="w-5 h-5 text-red-500" />
                  Pagamentos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {contasPagar.filter(c => c.pago).slice(0, 5).length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">Nenhum pagamento</p>
                ) : (
                  <div className="space-y-2">
                    {contasPagar.filter(c => c.pago).slice(0, 5).map((conta) => (
                      <div key={conta.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900">{conta.descricao}</p>
                          <p className="text-sm text-gray-500">
                            {conta.data_pagamento && format(parseISO(conta.data_pagamento), "dd/MM/yyyy")}
                          </p>
                        </div>
                        <span className="font-semibold text-red-600">
                          - R$ {conta.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="receber" className="mt-6">
          <Card className="border-0 shadow-lg shadow-gray-100/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Contas a Receber</CardTitle>
              <Button
                onClick={() => setShowContaReceberForm(true)}
                className="bg-rose-500 hover:bg-rose-600"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nova Conta
              </Button>
            </CardHeader>
            <CardContent>
              {contasReceber.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Nenhuma conta a receber</p>
              ) : (
                <div className="space-y-2">
                  {contasReceber.map((conta) => (
                    <div
                      key={conta.id}
                      className={`flex items-center justify-between p-4 rounded-xl ${
                        conta.recebido ? 'bg-emerald-50' : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => marcarRecebido.mutate({ id: conta.id, recebido: !conta.recebido })}
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                            conta.recebido
                              ? 'bg-emerald-500 border-emerald-500 text-white'
                              : 'border-gray-300'
                          }`}
                        >
                          {conta.recebido && <Check className="w-4 h-4" />}
                        </button>
                        <div>
                          <p className={`font-medium ${conta.recebido ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                            {conta.cliente_nome || conta.descricao}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Badge variant="secondary" className="text-xs">
                              {tiposReceber.find(t => t.value === conta.tipo)?.label}
                            </Badge>
                            {conta.data_vencimento && (
                              <span>Vence: {format(parseISO(conta.data_vencimento), "dd/MM/yyyy")}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`font-bold ${conta.recebido ? 'text-emerald-600' : 'text-gray-900'}`}>
                          R$ {conta.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-red-600 hover:bg-red-50"
                          onClick={() => deleteContaReceber.mutate(conta.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pagar" className="mt-6">
          <Card className="border-0 shadow-lg shadow-gray-100/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Contas a Pagar</CardTitle>
              <Button
                onClick={() => setShowContaPagarForm(true)}
                className="bg-rose-500 hover:bg-rose-600"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nova Conta
              </Button>
            </CardHeader>
            <CardContent>
              {contasPagar.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Nenhuma conta a pagar</p>
              ) : (
                <div className="space-y-2">
                  {contasPagar.map((conta) => (
                    <div
                      key={conta.id}
                      className={`flex items-center justify-between p-4 rounded-xl ${
                        conta.pago ? 'bg-gray-100' : 'bg-red-50'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => marcarPago.mutate({ id: conta.id, pago: !conta.pago })}
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                            conta.pago
                              ? 'bg-gray-500 border-gray-500 text-white'
                              : 'border-gray-300'
                          }`}
                        >
                          {conta.pago && <Check className="w-4 h-4" />}
                        </button>
                        <div>
                          <p className={`font-medium ${conta.pago ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                            {conta.descricao}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Badge variant="secondary" className="text-xs">
                              {categoriasPagar.find(c => c.value === conta.categoria)?.label}
                            </Badge>
                            {conta.fornecedor && <span>{conta.fornecedor}</span>}
                            {conta.data_vencimento && (
                              <span>Vence: {format(parseISO(conta.data_vencimento), "dd/MM/yyyy")}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`font-bold ${conta.pago ? 'text-gray-500' : 'text-red-600'}`}>
                          R$ {conta.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-red-600 hover:bg-red-50"
                          onClick={() => deleteContaPagar.mutate(conta.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Form Conta a Pagar */}
      <Dialog open={showContaPagarForm} onOpenChange={setShowContaPagarForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Conta a Pagar</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Descrição *</Label>
              <Input
                value={contaPagarForm.descricao}
                onChange={(e) => setContaPagarForm({ ...contaPagarForm, descricao: e.target.value })}
                placeholder="Ex: Compra de ingredientes"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Valor *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={contaPagarForm.valor}
                  onChange={(e) => setContaPagarForm({ ...contaPagarForm, valor: e.target.value })}
                  placeholder="0,00"
                />
              </div>
              <div>
                <Label>Categoria</Label>
                <Select
                  value={contaPagarForm.categoria}
                  onValueChange={(value) => setContaPagarForm({ ...contaPagarForm, categoria: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categoriasPagar.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Fornecedor</Label>
                <Input
                  value={contaPagarForm.fornecedor}
                  onChange={(e) => setContaPagarForm({ ...contaPagarForm, fornecedor: e.target.value })}
                />
              </div>
              <div>
                <Label>Data de Vencimento</Label>
                <Input
                  type="date"
                  value={contaPagarForm.data_vencimento}
                  onChange={(e) => setContaPagarForm({ ...contaPagarForm, data_vencimento: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowContaPagarForm(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => createContaPagar.mutate(contaPagarForm)}
              disabled={!contaPagarForm.descricao || !contaPagarForm.valor || createContaPagar.isPending}
              className="bg-rose-500 hover:bg-rose-600"
            >
              {createContaPagar.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Form Conta a Receber */}
      <Dialog open={showContaReceberForm} onOpenChange={setShowContaReceberForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Conta a Receber</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Cliente</Label>
              <Input
                value={contaReceberForm.cliente_nome}
                onChange={(e) => setContaReceberForm({ ...contaReceberForm, cliente_nome: e.target.value })}
                placeholder="Nome do cliente"
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Input
                value={contaReceberForm.descricao}
                onChange={(e) => setContaReceberForm({ ...contaReceberForm, descricao: e.target.value })}
                placeholder="Ex: Pagamento final do pedido"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Valor *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={contaReceberForm.valor}
                  onChange={(e) => setContaReceberForm({ ...contaReceberForm, valor: e.target.value })}
                  placeholder="0,00"
                />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select
                  value={contaReceberForm.tipo}
                  onValueChange={(value) => setContaReceberForm({ ...contaReceberForm, tipo: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposReceber.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Data de Vencimento</Label>
              <Input
                type="date"
                value={contaReceberForm.data_vencimento}
                onChange={(e) => setContaReceberForm({ ...contaReceberForm, data_vencimento: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowContaReceberForm(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => createContaReceber.mutate(contaReceberForm)}
              disabled={!contaReceberForm.valor || createContaReceber.isPending}
              className="bg-rose-500 hover:bg-rose-600"
            >
              {createContaReceber.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
