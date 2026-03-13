import React, { useState, useEffect } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';
import { syncClientToBrevo } from '@/lib/brevoClientSync';
import { useEventTracker } from '@/lib/useEventTracker';
import { format, differenceInDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ChevronLeft,
  ChevronRight,
  User,
  Cake,
  Layers,
  Cookie,
  Sparkles,
  Calendar,
  CreditCard,
  Check,
  AlertCircle,
  Plus,
  Search,
  Package,
  Minus,
  ShoppingCart,
  Truck,
  Pencil,
  Candy,
  Sandwich,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Link } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import CustomizadorProdutoModal from '@/components/catalogo/CustomizadorProdutoModal';

const stepsPersonalizado = [
  { id: 1,  title: 'Cliente',         icon: User },
  { id: 2,  title: 'Tamanho',         icon: Cake },
  { id: 3,  title: 'Massa',           icon: Layers },
  { id: 4,  title: 'Recheios',        icon: Cookie },
  { id: 5,  title: 'Cobertura',       icon: Sparkles },
  { id: 6,  title: 'Extras',          icon: Sparkles },
  { id: 7,  title: 'Doces',           icon: Candy },
  { id: 8,  title: 'Salgados',        icon: Sandwich },
  { id: 9,  title: 'Tipo de Entrega', icon: Truck },
  { id: 10, title: 'Entrega',         icon: Calendar },
  { id: 11, title: 'Pagamento',       icon: CreditCard },
  { id: 12, title: 'Resumo',          icon: Check },
];

const stepsProdutoPronto = [
  { id: 1, title: 'Cliente', icon: User },
  { id: 2, title: 'Produtos', icon: ShoppingCart },
  { id: 3, title: 'Entrega', icon: Calendar },
  { id: 4, title: 'Pagamento', icon: CreditCard },
  { id: 5, title: 'Resumo', icon: Check },
];

const isPixPaymentName = (name = '') => name.toLowerCase().includes('pix');

const normalizeFormaPagamento = (forma = {}) => {
  const pix = isPixPaymentName(forma.nome || '');
  const aVista = forma.a_vista === true;
  return {
    ...forma,
    descricao: aVista && pix && (!forma.descricao || forma.descricao === 'À vista')
      ? 'À vista'
      : (forma.descricao || ''),
    a_vista: aVista,
    parcelamento_max: aVista ? 1 : Math.max(Number(forma.parcelamento_max) || 1, 1),
    chave_pix: forma.chave_pix || '',
  };
};

const fallbackFormasPagamento = [
  { id: '', nome: 'Pix', descricao: 'À vista', a_vista: true, parcelamento_max: 1, chave_pix: '' },
  { id: '', nome: 'Cartão', descricao: '', a_vista: false, parcelamento_max: 1, chave_pix: '' },
  { id: '', nome: 'Dinheiro', descricao: '', a_vista: true, parcelamento_max: 1, chave_pix: '' },
].map(normalizeFormaPagamento);

export default function NovoPedido() {
  const { user } = useAuth();
  const { trackEvent } = useEventTracker();
  const { toast } = useToast();
  const [confeitaria, setConfeitaria] = useState(null);
  const [tipoPedido, setTipoPedido] = useState(null); // null = seleção, 'personalizado', 'produto_pronto'
  const [currentStep, setCurrentStep] = useState(1);
  const [showNewClientDialog, setShowNewClientDialog] = useState(false);
  const [clienteSearch, setClienteSearch] = useState('');
  const [carrinho, setCarrinho] = useState([]);
  const [produtoSearch, setProdutoSearch] = useState('');
  const [showCustomizador, setShowCustomizador] = useState(false);
  const [produtoCustomizando, setProdutoCustomizando] = useState(null);
  const [editandoItemCarrinho, setEditandoItemCarrinho] = useState(null);
  const [querReservarProdutoPronto, setQuerReservarProdutoPronto] = useState(false);
  const queryClient = useQueryClient();
  const params = new URLSearchParams(window.location.search);
  const editId = params.get('editId');
  const preselectedClienteId = params.get('clienteId');
  const isEditing = !!editId;

  const steps = tipoPedido === 'produto_pronto' ? stepsProdutoPronto : stepsPersonalizado;

  const [pedido, setPedido] = useState({
    cliente_id: '',
    cliente_nome: '',
    cliente_telefone: '',
    tamanho_id: '',
    tamanho_nome: '',
    massa_id: '',
    massa_nome: '',
    recheios: [],
    cobertura_id: '',
    cobertura_nome: '',
    extras: [],
    doces: [],
    salgados: [],
    deseja_doces: false,
    deseja_salgados: false,
    data_entrega: '',
    horario_entrega: '',
    observacoes: '',
    tipo_entrega: '',
    endereco_entrega: '',
    valor_delivery: 0,
    forma_pagamento: '',
    forma_pagamento_id: '',
    forma_pagamento_nome: '',
    parcelas: 1,
    valor_tamanho: 0,
    valor_massa: 0,
    valor_recheios: 0,
    valor_cobertura: 0,
    valor_extras: 0,
    valor_doces: 0,
    valor_salgados: 0,
    valor_urgencia: 0,
    valor_total: 0,
  });

  const [newClient, setNewClient] = useState({
    nome: '',
    telefone: '',
    email: '',
  });

  useEffect(() => {
    if (!user) return;
    if (!user.confeitaria_id) {
      window.location.href = createPageUrl('Onboarding');
      return;
    }

    const loadConfeitaria = async () => {
      try {
        const confList = await appClient.entities.Confeitaria.filter({ id: user.confeitaria_id });
        setConfeitaria(confList[0]);
      } catch (e) {
        console.error('Erro ao carregar confeitaria em Novo Pedido:', e);
      }
    };

    loadConfeitaria();
  }, [user]);

  // Data queries
  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes', user?.confeitaria_id],
    queryFn: () => appClient.entities.Cliente.filter({ confeitaria_id: user.confeitaria_id }),
    enabled: !!user?.confeitaria_id,
  });

  const { data: tamanhos = [] } = useQuery({
    queryKey: ['tamanhos', user?.confeitaria_id],
    queryFn: () => appClient.entities.Tamanho.filter({ confeitaria_id: user.confeitaria_id, ativo: true }),
    enabled: !!user?.confeitaria_id,
  });

  const { data: massas = [] } = useQuery({
    queryKey: ['massas', user?.confeitaria_id],
    queryFn: () => appClient.entities.Massa.filter({ confeitaria_id: user.confeitaria_id, ativo: true }),
    enabled: !!user?.confeitaria_id,
  });

  const { data: recheios = [] } = useQuery({
    queryKey: ['recheios', user?.confeitaria_id],
    queryFn: () => appClient.entities.Recheio.filter({ confeitaria_id: user.confeitaria_id, ativo: true }),
    enabled: !!user?.confeitaria_id,
  });

  const { data: coberturas = [] } = useQuery({
    queryKey: ['coberturas', user?.confeitaria_id],
    queryFn: () => appClient.entities.Cobertura.filter({ confeitaria_id: user.confeitaria_id, ativo: true }),
    enabled: !!user?.confeitaria_id,
  });

  const { data: extras = [] } = useQuery({
    queryKey: ['extras', user?.confeitaria_id],
    queryFn: () => appClient.entities.Extra.filter({ confeitaria_id: user.confeitaria_id, ativo: true }),
    enabled: !!user?.confeitaria_id,
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos', user?.confeitaria_id],
    queryFn: () => appClient.entities.Produto.filter({ confeitaria_id: user.confeitaria_id, disponivel: true }),
    enabled: !!user?.confeitaria_id && tipoPedido === 'produto_pronto',
  });

  const { data: doces = [] } = useQuery({
    queryKey: ['doces-pedido', user?.confeitaria_id],
    queryFn: () => appClient.entities.Doce.filter({ confeitaria_id: user.confeitaria_id, ativo: true }),
    enabled: !!user?.confeitaria_id && tipoPedido === 'personalizado',
  });

  const { data: salgados = [] } = useQuery({
    queryKey: ['salgados-pedido', user?.confeitaria_id],
    queryFn: () => appClient.entities.Salgado.filter({ confeitaria_id: user.confeitaria_id, ativo: true }),
    enabled: !!user?.confeitaria_id && tipoPedido === 'personalizado',
  });

  const { data: formasPagamento = [] } = useQuery({
    queryKey: ['formasPagamento', user?.confeitaria_id],
    queryFn: () => appClient.entities.FormaPagamento.filter({ confeitaria_id: user.confeitaria_id, ativo: true }),
    enabled: !!user?.confeitaria_id,
  });

  const { data: pedidoParaEditar } = useQuery({
    queryKey: ['pedido-editar', editId],
    queryFn: async () => {
      const list = await appClient.entities.Pedido.filter({ id: editId });
      return list[0] || null;
    },
    enabled: isEditing,
  });

  useEffect(() => {
    if (!pedidoParaEditar) return;
    setTipoPedido(pedidoParaEditar.tipo || 'personalizado');
    setCarrinho(Array.isArray(pedidoParaEditar.produtos_catalogo) ? pedidoParaEditar.produtos_catalogo : []);
    setQuerReservarProdutoPronto(Boolean(pedidoParaEditar.data_entrega || pedidoParaEditar.horario_entrega));
    setPedido({
      cliente_id:       pedidoParaEditar.cliente_id       || '',
      cliente_nome:     pedidoParaEditar.cliente_nome     || '',
      cliente_telefone: pedidoParaEditar.cliente_telefone || '',
      tamanho_id:       pedidoParaEditar.tamanho_id       || '',
      tamanho_nome:     pedidoParaEditar.tamanho_nome     || '',
      massa_id:         pedidoParaEditar.massa_id         || '',
      massa_nome:       pedidoParaEditar.massa_nome       || '',
      recheios:         pedidoParaEditar.recheios         || [],
      cobertura_id:     pedidoParaEditar.cobertura_id     || '',
      cobertura_nome:   pedidoParaEditar.cobertura_nome   || '',
      extras:           pedidoParaEditar.extras           || [],
      doces:            pedidoParaEditar.doces            || [],
      salgados:         pedidoParaEditar.salgados         || [],
      deseja_doces:     (pedidoParaEditar.doces?.length > 0),
      deseja_salgados:  (pedidoParaEditar.salgados?.length > 0),
      data_entrega:     pedidoParaEditar.data_entrega     || '',
      horario_entrega:  pedidoParaEditar.horario_entrega  || '',
      observacoes:      pedidoParaEditar.observacoes      || '',
      tipo_entrega:     pedidoParaEditar.tipo_entrega     || '',
      endereco_entrega: pedidoParaEditar.endereco_entrega || '',
      valor_delivery:   pedidoParaEditar.valor_delivery   || 0,
      forma_pagamento:  pedidoParaEditar.forma_pagamento  || '',
      forma_pagamento_id: pedidoParaEditar.forma_pagamento_id || '',
      forma_pagamento_nome: pedidoParaEditar.forma_pagamento_nome || pedidoParaEditar.forma_pagamento || '',
      parcelas: Number(pedidoParaEditar.parcelas) || 1,
      valor_tamanho:    pedidoParaEditar.valor_tamanho    || 0,
      valor_massa:      pedidoParaEditar.valor_massa      || 0,
      valor_recheios:   pedidoParaEditar.valor_recheios   || 0,
      valor_cobertura:  pedidoParaEditar.valor_cobertura  || 0,
      valor_extras:     pedidoParaEditar.valor_extras     || 0,
      valor_doces:      pedidoParaEditar.valor_doces      || 0,
      valor_salgados:   pedidoParaEditar.valor_salgados   || 0,
      valor_urgencia:   pedidoParaEditar.valor_urgencia   || 0,
      valor_total:      pedidoParaEditar.valor_total      || 0,
    });
  }, [pedidoParaEditar]);

  const buildPedidoPayload = () => {
    const basePayload = {
      ...pedido,
      confeitaria_id: user.confeitaria_id,
      cliente_id: pedido.cliente_id || null,
      tamanho_id: pedido.tamanho_id || null,
      massa_id: pedido.massa_id || null,
      cobertura_id: pedido.cobertura_id || null,
      forma_pagamento_id: pedido.forma_pagamento_id || null,
      forma_pagamento: pedido.forma_pagamento_nome || pedido.forma_pagamento || null,
      forma_pagamento_nome: pedido.forma_pagamento_nome || pedido.forma_pagamento || null,
      parcelas: Number(pedido.parcelas) || 1,
      data_entrega: pedido.data_entrega || null,
      horario_entrega: pedido.horario_entrega || null,
      endereco_entrega: pedido.endereco_entrega || null,
      observacoes: pedido.observacoes || null,
    };

    if (tipoPedido === 'produto_pronto') {
      return {
        ...basePayload,
        numero: null,
        status: 'orcamento',
        tipo: 'produto_pronto',
        data_entrega: querReservarProdutoPronto ? (pedido.data_entrega || null) : null,
        horario_entrega: querReservarProdutoPronto ? (pedido.horario_entrega || null) : null,
        valor_total: totalProdutos,
        produtos_catalogo: carrinho.map((item) => ({
          id: item.id,
          nome: item.nome,
          preco: item.preco,
          quantidade: item.quantidade,
          ...(item.complementos_selecionados?.length > 0 && {
            complementos_selecionados: item.complementos_selecionados,
            preco_base: item.preco_base,
          }),
        })),
      };
    }

    // eslint-disable-next-line no-unused-vars
    const { deseja_doces, deseja_salgados, ...cleanBase } = basePayload;
    return {
      ...cleanBase,
      numero: null,
      status: 'orcamento',
      tipo: 'personalizado',
    };
  };

  useEffect(() => {
    if (isEditing || !preselectedClienteId || clientes.length === 0) return;

    const clientePreselecionado = clientes.find((cliente) => cliente.id === preselectedClienteId);
    if (!clientePreselecionado) return;

    setPedido((prev) => {
      if (prev.cliente_id === clientePreselecionado.id) return prev;
      return {
        ...prev,
        cliente_id: clientePreselecionado.id,
        cliente_nome: clientePreselecionado.nome || '',
        cliente_telefone: clientePreselecionado.telefone || '',
      };
    });
  }, [isEditing, preselectedClienteId, clientes]);

  // Mutations
  const createClientMutation = useMutation({
    mutationFn: async (data) => {
      const client = await appClient.entities.Cliente.create({
        ...data,
        confeitaria_id: user.confeitaria_id,
      });

      const brevoResult = await syncClientToBrevo({
        cliente_id: client.id,
        confeitaria_id: user.confeitaria_id,
        nome: client.nome,
        telefone: client.telefone,
        email: client.email
      });

      return { client, brevoSynced: brevoResult.success };
    },
    onSuccess: ({ client, brevoSynced }) => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      setPedido({
        ...pedido,
        cliente_id: client.id,
        cliente_nome: client.nome,
        cliente_telefone: client.telefone,
      });
      setShowNewClientDialog(false);
      setNewClient({ nome: '', telefone: '', email: '' });
      if (brevoSynced === false) {
        console.warn('[brevo] Cliente criado no Novo Pedido sem sincronizar com o Brevo');
      }
    },
  });

  const createPedidoMutation = useMutation({
    mutationFn: async () => {
      const payload = buildPedidoPayload();

      if (isEditing) {
        return appClient.entities.Pedido.update(editId, payload);
      }

      return appClient.entities.Pedido.create(payload);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      queryClient.invalidateQueries({ queryKey: ['parcelamentos'] });
      if (!isEditing) await trackEvent('first_order_created');
      window.location.href = createPageUrl('Pedidos');
    },
    onError: (error) => {
      console.error('Erro ao salvar pedido:', error);
      toast({
        title: 'Erro ao salvar pedido',
        description: error?.message || 'Não foi possível criar o pedido agora.',
        variant: 'destructive',
      });
    },
  });

  // Calculate totals
  useEffect(() => {
    const valorRecheios = pedido.recheios.reduce((acc, r) => acc + (r.valor || 0), 0);
    const valorExtras = pedido.extras.reduce((acc, e) => acc + (e.valor || 0), 0);
    const valorDoces = pedido.doces.reduce((acc, d) => acc + (d.valor_unitario * d.quantidade), 0);
    const valorSalgados = pedido.salgados.reduce((acc, s) => acc + (s.valor_unitario * s.quantidade), 0);

    let valorUrgencia = 0;
    if (pedido.data_entrega && confeitaria?.prazo_minimo_dias && confeitaria?.habilitar_taxa_urgencia !== false) {
      const dias = differenceInDays(parseISO(pedido.data_entrega), new Date());
      if (dias < confeitaria.prazo_minimo_dias && dias >= 0) {
        const subtotal = pedido.valor_tamanho + pedido.valor_massa + valorRecheios + pedido.valor_cobertura + valorExtras + valorDoces + valorSalgados;
        valorUrgencia = subtotal * ((confeitaria.taxa_urgencia_percentual || 20) / 100);
      }
    }

    const total = pedido.valor_tamanho + pedido.valor_massa + valorRecheios + pedido.valor_cobertura + valorExtras + valorDoces + valorSalgados + valorUrgencia;

    setPedido(prev => ({
      ...prev,
      valor_recheios: valorRecheios,
      valor_extras: valorExtras,
      valor_doces: valorDoces,
      valor_salgados: valorSalgados,
      valor_urgencia: valorUrgencia,
      valor_total: total,
    }));
  }, [pedido.valor_tamanho, pedido.valor_massa, pedido.recheios, pedido.valor_cobertura, pedido.extras, pedido.doces, pedido.salgados, pedido.data_entrega, confeitaria]);

  const selectedTamanho = tamanhos.find(t => t.id === pedido.tamanho_id);
  const maxRecheios = selectedTamanho?.max_recheios || 2;
  const paymentOptions = (formasPagamento.length > 0 ? formasPagamento : fallbackFormasPagamento).map(normalizeFormaPagamento);
  const selectedPayment = paymentOptions.find((forma) =>
    (forma.id && forma.id === pedido.forma_pagamento_id) ||
    forma.nome === (pedido.forma_pagamento_nome || pedido.forma_pagamento)
  ) || null;
  const shouldShowInstallments = selectedPayment && !selectedPayment.a_vista && selectedPayment.parcelamento_max > 1;

  // Carrinho (produto pronto)
  const subtotalProdutos = carrinho.reduce((acc, item) => acc + ((item.preco || 0) * item.quantidade), 0);
  const totalProdutos = subtotalProdutos + (pedido.valor_delivery || 0);

  const handleClickProduto = (produto) => {
    if (produto.complementos?.length > 0) {
      setProdutoCustomizando(produto);
      setShowCustomizador(true);
    } else {
      addToCarrinho(produto);
    }
  };

  const addToCarrinho = (produto) => {
    setCarrinho(prev => {
      const existing = prev.find(p => p.id === produto.id);
      if (existing) {
        return prev.map(p => p.id === produto.id ? { ...p, quantidade: p.quantidade + 1 } : p);
      }
      return [...prev, { id: produto.id, nome: produto.nome, preco: produto.preco || 0, quantidade: 1 }];
    });
  };

  const adicionarComComplementos = (item) => {
    if (editandoItemCarrinho) {
      setCarrinho(prev => prev.map(i => i === editandoItemCarrinho ? item : i));
      setEditandoItemCarrinho(null);
    } else {
      setCarrinho(prev => [...prev, item]);
    }
  };

  const handleEditarItemCarrinho = (item) => {
    const produto = produtos.find(p => p.id === item.id);
    if (!produto) return;
    setEditandoItemCarrinho(item);
    setProdutoCustomizando(produto);
    setShowCustomizador(true);
  };

  const updateQuantidade = (produtoId, delta) => {
    setCarrinho(prev => prev
      .map(p => p.id === produtoId ? { ...p, quantidade: p.quantidade + delta } : p)
      .filter(p => p.quantidade > 0)
    );
  };

  const filteredProdutos = produtos.filter(p =>
    p.nome?.toLowerCase().includes(produtoSearch.toLowerCase())
  );

  const filteredClientes = clientes.filter(c =>
    c.nome?.toLowerCase().includes(clienteSearch.toLowerCase()) ||
    c.telefone?.includes(clienteSearch)
  );

  const canProceed = () => {
    if (tipoPedido === 'produto_pronto') {
      switch (currentStep) {
        case 1: return pedido.cliente_nome && pedido.cliente_telefone;
        case 2: return carrinho.length > 0;
        case 3: return pedido.tipo_entrega && (!querReservarProdutoPronto || pedido.data_entrega);
        case 4: return pedido.forma_pagamento;
        default: return true;
      }
    }
    switch (currentStep) {
      case 1:  return pedido.cliente_nome && pedido.cliente_telefone;
      case 2:  return pedido.tamanho_id;
      case 3:  return pedido.massa_id;
      case 4:  return pedido.recheios.length > 0;
      case 5:  return pedido.cobertura_id;
      case 6:  return true; // extras opcional
      case 7:  return true; // doces opcional
      case 8:  return true; // salgados opcional
      case 9:  return pedido.tipo_entrega;
      case 10: return pedido.data_entrega;
      case 11: return pedido.forma_pagamento;
      default: return true;
    }
  };

  if (!user) return null;

  // Tela de seleção de tipo de pedido
  if (!tipoPedido && !isEditing) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <Link to={createPageUrl('Pedidos')}>
              <Button variant="ghost" size="sm">
                <ChevronLeft className="w-4 h-4 mr-1" />
                Voltar
              </Button>
            </Link>
          </div>
          <h2 className="text-xl font-bold text-gray-900 text-center">Tipo de Pedido</h2>
          <p className="text-sm text-gray-500 text-center mt-1">Selecione o tipo de pedido que deseja criar</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => setTipoPedido('personalizado')}
            className="p-8 rounded-2xl border-2 border-transparent bg-white shadow-lg hover:border-rose-500 hover:shadow-xl transition-all text-left group"
          >
            <div className="p-4 rounded-xl bg-rose-100 w-fit mb-4 group-hover:bg-rose-200 transition-colors">
              <Cake className="w-8 h-8 text-rose-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Produto Personalizado</h3>
            <p className="text-sm text-gray-500 mt-2">
              Monte o produto escolhendo tamanho, massa, recheios, cobertura e extras
            </p>
          </button>

          <button
            onClick={() => setTipoPedido('produto_pronto')}
            className="p-8 rounded-2xl border-2 border-transparent bg-white shadow-lg hover:border-rose-500 hover:shadow-xl transition-all text-left group"
          >
            <div className="p-4 rounded-xl bg-amber-100 w-fit mb-4 group-hover:bg-amber-200 transition-colors">
              <Package className="w-8 h-8 text-amber-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Produto Pronto</h3>
            <p className="text-sm text-gray-500 mt-2">
              Selecione produtos prontos do catálogo para adicionar ao pedido
            </p>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          {currentStep === 1 && !isEditing ? (
            <Button variant="ghost" size="sm" onClick={() => { setTipoPedido(null); setCurrentStep(1); }}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              Tipo de Pedido
            </Button>
          ) : (
            <Link to={createPageUrl('Pedidos')}>
              <Button variant="ghost" size="sm">
                <ChevronLeft className="w-4 h-4 mr-1" />
                Voltar
              </Button>
            </Link>
          )}
          <span className="text-sm text-gray-500">
            Passo {currentStep} de {steps.length}
          </span>
        </div>
        <div className="flex gap-1">
          {steps.map((step) => (
            <div
              key={step.id}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                step.id <= currentStep ? 'bg-rose-500' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
        <div className="flex items-center justify-center mt-4">
          {React.createElement(steps[currentStep - 1].icon, {
            className: "w-5 h-5 text-rose-500 mr-2"
          })}
          <h2 className="text-xl font-bold text-gray-900">
            {isEditing
              ? `Editar Pedido #${pedidoParaEditar?.numero || ''} — ${steps[currentStep - 1].title}`
              : steps[currentStep - 1].title}
          </h2>
        </div>
      </div>

      {/* Step Content */}
      <Card className="border-0 shadow-xl shadow-gray-100/50 mb-6">
        <CardContent className="p-6">
          {/* Step 1 (both): Cliente */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Buscar cliente por nome ou telefone..."
                    value={clienteSearch}
                    onChange={(e) => setClienteSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button onClick={() => setShowNewClientDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Novo
                </Button>
              </div>

              {pedido.cliente_nome && (
                <div className="p-4 bg-rose-50 rounded-xl border border-rose-100">
                  <p className="text-sm text-gray-500">Cliente selecionado:</p>
                  <p className="font-semibold text-gray-900">{pedido.cliente_nome}</p>
                  <p className="text-sm text-gray-600">{pedido.cliente_telefone}</p>
                </div>
              )}

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {filteredClientes.map((cliente) => (
                  <button
                    key={cliente.id}
                    onClick={() => setPedido({
                      ...pedido,
                      cliente_id: cliente.id,
                      cliente_nome: cliente.nome,
                      cliente_telefone: cliente.telefone,
                    })}
                    className={`w-full p-4 rounded-xl text-left transition-colors ${
                      pedido.cliente_id === cliente.id
                        ? 'bg-rose-100 border-2 border-rose-500'
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <p className="font-medium text-gray-900">{cliente.nome}</p>
                    <p className="text-sm text-gray-500">{cliente.telefone}</p>
                  </button>
                ))}
              </div>

              {/* Quick add form */}
              <div className="pt-4 border-t space-y-3">
                <p className="text-sm font-medium text-gray-700">Ou preencha manualmente:</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Nome *</Label>
                    <Input
                      value={pedido.cliente_nome}
                      onChange={(e) => setPedido({ ...pedido, cliente_nome: e.target.value })}
                      placeholder="Nome do cliente"
                    />
                  </div>
                  <div>
                    <Label>Telefone *</Label>
                    <Input
                      value={pedido.cliente_telefone}
                      onChange={(e) => setPedido({ ...pedido, cliente_telefone: e.target.value })}
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* === PERSONALIZADO: Steps 2-6 === */}
          {/* Step 2: Tamanho */}
          {tipoPedido === 'personalizado' && currentStep === 2 && (
            <RadioGroup
              value={pedido.tamanho_id}
              onValueChange={(value) => {
                const tam = tamanhos.find(t => t.id === value);
                setPedido({
                  ...pedido,
                  tamanho_id: value,
                  tamanho_nome: tam?.nome || '',
                  valor_tamanho: tam?.valor_base || 0,
                  recheios: [], // Reset recheios when tamanho changes
                });
              }}
              className="grid gap-3"
            >
              {tamanhos.map((tamanho) => (
                <label
                  key={tamanho.id}
                  className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-colors ${
                    pedido.tamanho_id === tamanho.id
                      ? 'bg-rose-100 border-2 border-rose-500'
                      : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value={tamanho.id} />
                    <div>
                      <p className="font-medium text-gray-900">{tamanho.nome}</p>
                      <p className="text-sm text-gray-500">
                        Até {tamanho.max_recheios} recheio(s)
                      </p>
                    </div>
                  </div>
                  <span className="font-bold text-rose-600">
                    R$ {tamanho.valor_base?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </label>
              ))}
            </RadioGroup>
          )}

          {/* Step 3: Massa */}
          {tipoPedido === 'personalizado' && currentStep === 3 && (
            <RadioGroup
              value={pedido.massa_id}
              onValueChange={(value) => {
                const massa = massas.find(m => m.id === value);
                setPedido({
                  ...pedido,
                  massa_id: value,
                  massa_nome: massa?.nome || '',
                  valor_massa: massa?.valor_adicional || 0,
                });
              }}
              className="grid gap-3"
            >
              {massas.map((massa) => (
                <label
                  key={massa.id}
                  className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-colors ${
                    pedido.massa_id === massa.id
                      ? 'bg-rose-100 border-2 border-rose-500'
                      : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value={massa.id} />
                    <div>
                      <p className="font-medium text-gray-900">{massa.nome}</p>
                      {massa.descricao && (
                        <p className="text-sm text-gray-500">{massa.descricao}</p>
                      )}
                    </div>
                  </div>
                  {massa.valor_adicional > 0 ? (
                    <span className="font-bold text-rose-600">
                      + R$ {massa.valor_adicional?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  ) : (
                    <Badge variant="secondary">Incluso</Badge>
                  )}
                </label>
              ))}
            </RadioGroup>
          )}

          {/* Step 4: Recheios */}
          {tipoPedido === 'personalizado' && currentStep === 4 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                <span className="text-sm text-amber-800">
                  Selecione até {maxRecheios} recheio(s)
                </span>
                <Badge variant="secondary" className="bg-amber-100">
                  {pedido.recheios.length}/{maxRecheios}
                </Badge>
              </div>

              {['tradicional', 'premium', 'especial'].map((tipo) => {
                const recheiosTipo = recheios.filter(r => r.tipo === tipo);
                if (recheiosTipo.length === 0) return null;

                return (
                  <div key={tipo} className="space-y-2">
                    <h4 className="font-semibold text-gray-700 capitalize flex items-center gap-2">
                      {tipo}
                      {tipo === 'premium' && <Badge className="bg-purple-100 text-purple-700">Premium</Badge>}
                      {tipo === 'especial' && <Badge className="bg-amber-100 text-amber-700">Especial</Badge>}
                    </h4>
                    <div className="grid gap-2">
                      {recheiosTipo.map((recheio) => {
                        const isSelected = pedido.recheios.some(r => r.id === recheio.id);
                        const canSelect = isSelected || pedido.recheios.length < maxRecheios;

                        return (
                          <label
                            key={recheio.id}
                            className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-rose-100 border-2 border-rose-500'
                                : canSelect
                                  ? 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                                  : 'bg-gray-100 opacity-50 cursor-not-allowed border-2 border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={isSelected}
                                disabled={!canSelect}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setPedido({
                                      ...pedido,
                                      recheios: [...pedido.recheios, {
                                        id: recheio.id,
                                        nome: recheio.nome,
                                        valor: recheio.valor_adicional || 0,
                                      }],
                                    });
                                  } else {
                                    setPedido({
                                      ...pedido,
                                      recheios: pedido.recheios.filter(r => r.id !== recheio.id),
                                    });
                                  }
                                }}
                              />
                              <span className="font-medium text-gray-900">{recheio.nome}</span>
                            </div>
                            {recheio.valor_adicional > 0 ? (
                              <span className="font-bold text-rose-600">
                                + R$ {recheio.valor_adicional?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            ) : (
                              <Badge variant="secondary">Incluso</Badge>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Step 5: Cobertura */}
          {tipoPedido === 'personalizado' && currentStep === 5 && (
            <RadioGroup
              value={pedido.cobertura_id}
              onValueChange={(value) => {
                const cob = coberturas.find(c => c.id === value);
                setPedido({
                  ...pedido,
                  cobertura_id: value,
                  cobertura_nome: cob?.nome || '',
                  valor_cobertura: cob?.valor_adicional || 0,
                });
              }}
              className="grid gap-3"
            >
              {coberturas.map((cobertura) => (
                <label
                  key={cobertura.id}
                  className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-colors ${
                    pedido.cobertura_id === cobertura.id
                      ? 'bg-rose-100 border-2 border-rose-500'
                      : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value={cobertura.id} />
                    <div>
                      <p className="font-medium text-gray-900">{cobertura.nome}</p>
                      {cobertura.observacoes && (
                        <p className="text-sm text-gray-500">{cobertura.observacoes}</p>
                      )}
                    </div>
                  </div>
                  {cobertura.valor_adicional > 0 ? (
                    <span className="font-bold text-rose-600">
                      + R$ {cobertura.valor_adicional?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  ) : (
                    <Badge variant="secondary">Incluso</Badge>
                  )}
                </label>
              ))}
            </RadioGroup>
          )}

          {/* Step 6: Extras */}
          {tipoPedido === 'personalizado' && currentStep === 6 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500 mb-4">Selecione os extras desejados (opcional)</p>
              {extras.map((extra) => {
                const selected = pedido.extras.find(e => e.id === extra.id);

                return (
                  <div
                    key={extra.id}
                    className={`p-4 rounded-xl transition-colors ${
                      selected
                        ? 'bg-rose-100 border-2 border-rose-500'
                        : 'bg-gray-50 border-2 border-transparent'
                    }`}
                  >
                    <label className="flex items-center justify-between cursor-pointer">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={!!selected}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setPedido({
                                ...pedido,
                                extras: [...pedido.extras, {
                                  id: extra.id,
                                  nome: extra.nome,
                                  valor: extra.valor || 0,
                                  observacao: '',
                                }],
                              });
                            } else {
                              setPedido({
                                ...pedido,
                                extras: pedido.extras.filter(e => e.id !== extra.id),
                              });
                            }
                          }}
                        />
                        <span className="font-medium text-gray-900">{extra.nome}</span>
                      </div>
                      <span className="font-bold text-rose-600">
                        R$ {extra.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </label>
                    {selected && extra.requer_observacao && (
                      <Input
                        className="mt-3"
                        placeholder="Observação (ex: texto do topo)"
                        value={selected.observacao || ''}
                        onChange={(e) => {
                          setPedido({
                            ...pedido,
                            extras: pedido.extras.map(ext =>
                              ext.id === extra.id ? { ...ext, observacao: e.target.value } : ext
                            ),
                          });
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* === PERSONALIZADO: Step 7 - Doces === */}
          {tipoPedido === 'personalizado' && currentStep === 7 && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div>
                    <p className="font-medium text-gray-900">Deseja adicionar doces?</p>
                    <p className="text-sm text-gray-500 mt-1">Brigadeiros, beijinhos, etc.</p>
                  </div>
                  <Checkbox
                    checked={pedido.deseja_doces}
                    onCheckedChange={(checked) => {
                      setPedido({ ...pedido, deseja_doces: checked, doces: checked ? pedido.doces : [] });
                    }}
                  />
                </div>

                {pedido.deseja_doces && (
                  <div className="space-y-3 mt-4">
                    {doces.length === 0 ? (
                      <p className="text-center text-gray-500 py-8">Nenhum doce disponível no momento</p>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-gray-700">Selecione os doces:</p>
                        {doces.map((doce) => {
                          const selected = pedido.doces.find(d => d.id === doce.id);
                          return (
                            <div
                              key={doce.id}
                              className={`p-4 rounded-xl transition-colors ${selected ? 'bg-rose-100 border-2 border-rose-500' : 'bg-gray-50 border-2 border-transparent'}`}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3 flex-1">
                                  <Checkbox
                                    checked={!!selected}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setPedido({ ...pedido, doces: [...pedido.doces, { id: doce.id, nome: doce.nome, valor_unitario: doce.valor_unitario, quantidade_minima: doce.quantidade_minima, quantidade: doce.quantidade_minima || 1 }] });
                                      } else {
                                        setPedido({ ...pedido, doces: pedido.doces.filter(d => d.id !== doce.id) });
                                      }
                                    }}
                                  />
                                  <div className="flex-1">
                                    <div className="flex items-start justify-between gap-2">
                                      <div>
                                        <p className="font-medium text-gray-900">{doce.nome}</p>
                                        {doce.quantidade_minima > 1 && (
                                          <p className="text-xs text-gray-500 mt-0.5">Mínimo: {doce.quantidade_minima} un.</p>
                                        )}
                                      </div>
                                      <span className="font-bold text-rose-600 whitespace-nowrap">
                                        R$ {doce.valor_unitario?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} /un
                                      </span>
                                    </div>
                                    {selected && (
                                      <div className="mt-3 flex items-center gap-2">
                                        <Label className="text-sm">Quantidade:</Label>
                                        <div className="flex items-center gap-2">
                                          <Button type="button" variant="outline" size="icon" className="h-9 w-9"
                                            onClick={() => {
                                              const novaQtd = Math.max(selected.quantidade - 10, doce.quantidade_minima || 1);
                                              setPedido({ ...pedido, doces: pedido.doces.map(d => d.id === doce.id ? { ...d, quantidade: novaQtd } : d) });
                                            }}>
                                            <Minus className="w-4 h-4" />
                                          </Button>
                                          <Input type="number" min={doce.quantidade_minima || 1} value={selected.quantidade}
                                            onChange={(e) => {
                                              const novaQtd = Math.max(parseInt(e.target.value) || 1, doce.quantidade_minima || 1);
                                              setPedido({ ...pedido, doces: pedido.doces.map(d => d.id === doce.id ? { ...d, quantidade: novaQtd } : d) });
                                            }}
                                            className="w-16 text-center"
                                          />
                                          <Button type="button" variant="outline" size="icon" className="h-9 w-9"
                                            onClick={() => {
                                              const novaQtd = selected.quantidade + 10;
                                              setPedido({ ...pedido, doces: pedido.doces.map(d => d.id === doce.id ? { ...d, quantidade: novaQtd } : d) });
                                            }}>
                                            <Plus className="w-4 h-4" />
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* === PERSONALIZADO: Step 8 - Salgados === */}
          {tipoPedido === 'personalizado' && currentStep === 8 && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div>
                    <p className="font-medium text-gray-900">Deseja adicionar salgados?</p>
                    <p className="text-sm text-gray-500 mt-1">Coxinhas, risoles, etc.</p>
                  </div>
                  <Checkbox
                    checked={pedido.deseja_salgados}
                    onCheckedChange={(checked) => {
                      setPedido({ ...pedido, deseja_salgados: checked, salgados: checked ? pedido.salgados : [] });
                    }}
                  />
                </div>

                {pedido.deseja_salgados && (
                  <div className="space-y-3 mt-4">
                    {salgados.length === 0 ? (
                      <p className="text-center text-gray-500 py-8">Nenhum salgado disponível no momento</p>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-gray-700">Selecione os salgados:</p>
                        {salgados.map((salgado) => {
                          const selected = pedido.salgados.find(s => s.id === salgado.id);
                          return (
                            <div
                              key={salgado.id}
                              className={`p-4 rounded-xl transition-colors ${selected ? 'bg-rose-100 border-2 border-rose-500' : 'bg-gray-50 border-2 border-transparent'}`}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3 flex-1">
                                  <Checkbox
                                    checked={!!selected}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setPedido({ ...pedido, salgados: [...pedido.salgados, { id: salgado.id, nome: salgado.nome, valor_unitario: salgado.valor_unitario, quantidade_minima: salgado.quantidade_minima, quantidade: salgado.quantidade_minima || 1 }] });
                                      } else {
                                        setPedido({ ...pedido, salgados: pedido.salgados.filter(s => s.id !== salgado.id) });
                                      }
                                    }}
                                  />
                                  <div className="flex-1">
                                    <div className="flex items-start justify-between gap-2">
                                      <div>
                                        <p className="font-medium text-gray-900">{salgado.nome}</p>
                                        {salgado.quantidade_minima > 1 && (
                                          <p className="text-xs text-gray-500 mt-0.5">Mínimo: {salgado.quantidade_minima} un.</p>
                                        )}
                                      </div>
                                      <span className="font-bold text-rose-600 whitespace-nowrap">
                                        R$ {salgado.valor_unitario?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} /un
                                      </span>
                                    </div>
                                    {selected && (
                                      <div className="mt-3 flex items-center gap-2">
                                        <Label className="text-sm">Quantidade:</Label>
                                        <div className="flex items-center gap-2">
                                          <Button type="button" variant="outline" size="icon" className="h-9 w-9"
                                            onClick={() => {
                                              const novaQtd = Math.max(selected.quantidade - 10, salgado.quantidade_minima || 1);
                                              setPedido({ ...pedido, salgados: pedido.salgados.map(s => s.id === salgado.id ? { ...s, quantidade: novaQtd } : s) });
                                            }}>
                                            <Minus className="w-4 h-4" />
                                          </Button>
                                          <Input type="number" min={salgado.quantidade_minima || 1} value={selected.quantidade}
                                            onChange={(e) => {
                                              const novaQtd = Math.max(parseInt(e.target.value) || 1, salgado.quantidade_minima || 1);
                                              setPedido({ ...pedido, salgados: pedido.salgados.map(s => s.id === salgado.id ? { ...s, quantidade: novaQtd } : s) });
                                            }}
                                            className="w-16 text-center"
                                          />
                                          <Button type="button" variant="outline" size="icon" className="h-9 w-9"
                                            onClick={() => {
                                              const novaQtd = selected.quantidade + 10;
                                              setPedido({ ...pedido, salgados: pedido.salgados.map(s => s.id === salgado.id ? { ...s, quantidade: novaQtd } : s) });
                                            }}>
                                            <Plus className="w-4 h-4" />
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* === PERSONALIZADO: Step 9 - Tipo de Entrega === */}
          {tipoPedido === 'personalizado' && currentStep === 9 && (
            <RadioGroup
              value={pedido.tipo_entrega}
              onValueChange={(value) => setPedido({ ...pedido, tipo_entrega: value, valor_delivery: value === 'entrega' ? (confeitaria?.taxa_delivery || 0) : 0 })}
              className="grid gap-3"
            >
              <label
                className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-colors ${pedido.tipo_entrega === 'retirada' ? 'bg-rose-100 border-2 border-rose-500' : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'}`}
              >
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="retirada" />
                  <div>
                    <p className="font-medium text-gray-900">Retirada no local</p>
                    <p className="text-sm text-gray-500">Retirada na confeitaria na data escolhida</p>
                  </div>
                </div>
              </label>
              {confeitaria?.delivery_ativo !== false && confeitaria?.delivery_interno_personalizado !== false && (
                <label
                  className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-colors ${pedido.tipo_entrega === 'entrega' ? 'bg-rose-100 border-2 border-rose-500' : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'}`}
                >
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value="entrega" />
                    <div>
                      <p className="font-medium text-gray-900">Delivery</p>
                      <p className="text-sm text-gray-500">Entrega no endereço combinado</p>
                    </div>
                  </div>
                  {confeitaria?.taxa_delivery > 0 && (
                    <span className="font-bold text-rose-600">
                      + R$ {Number(confeitaria.taxa_delivery || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  )}
                </label>
              )}
            </RadioGroup>
          )}

          {/* === PRODUTO PRONTO: Step 2 - Produtos === */}
          {tipoPedido === 'produto_pronto' && currentStep === 2 && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Buscar produto..."
                  value={produtoSearch}
                  onChange={(e) => setProdutoSearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              {carrinho.length > 0 && (
                <div className="p-4 bg-rose-50 rounded-xl space-y-2">
                  <p className="text-sm font-semibold text-gray-700">Carrinho</p>
                  {carrinho.map((item, idx) => (
                    <div key={idx} className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-gray-900 font-medium">{item.nome}</span>
                        {item.complementos_selecionados?.length > 0 && (
                          <div className="space-y-0.5 mt-0.5">
                            {item.complementos_selecionados.map((c, i) => (
                              <p key={i} className="text-xs text-rose-500">+ {c.nome}</p>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => updateQuantidade(item.id, -1)}>
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="text-sm font-medium w-6 text-center">{item.quantidade}</span>
                        <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => updateQuantidade(item.id, 1)}>
                          <Plus className="w-3 h-3" />
                        </Button>
                        {item.complementos_selecionados?.length > 0 && (
                          <Button size="icon" variant="ghost" className="w-7 h-7 text-rose-500" onClick={() => handleEditarItemCarrinho(item)}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                        )}
                        <span className="text-sm font-semibold text-rose-600 ml-1 tabular-nums">
                          R$ {((item.preco || 0) * item.quantidade).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-rose-200 flex justify-between font-bold">
                    <span>Subtotal</span>
                    <span className="text-rose-600">R$ {subtotalProdutos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              )}

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {filteredProdutos.map((produto) => (
                  <button
                    key={produto.id}
                    onClick={() => handleClickProduto(produto)}
                    className="w-full flex items-center justify-between p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-14 h-14 rounded-xl bg-white border overflow-hidden shrink-0">
                        {produto.foto_url ? (
                          <img
                            src={produto.foto_url}
                            alt={produto.nome}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-rose-50 text-rose-300">
                            <Package className="w-5 h-5" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900">{produto.nome}</p>
                        {produto.descricao && <p className="text-sm text-gray-500 line-clamp-2">{produto.descricao}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <span className="font-bold text-rose-600 block">
                          R$ {(produto.preco || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        {produto.complementos?.length > 0 && (
                          <span className="text-xs text-rose-400">+ complementos</span>
                        )}
                      </div>
                      <Plus className="w-4 h-4 text-gray-400" />
                    </div>
                  </button>
                ))}
                {filteredProdutos.length === 0 && (
                  <p className="text-gray-500 text-center py-4">Nenhum produto encontrado</p>
                )}
              </div>
            </div>
          )}

          {/* === PRODUTO PRONTO: Step 3 - Entrega === */}
          {tipoPedido === 'produto_pronto' && currentStep === 3 && (
            <div className="space-y-4">
              <Label>Tipo de Entrega *</Label>
              <div className={`grid gap-3 ${confeitaria?.delivery_ativo !== false && confeitaria?.delivery_interno_pronto !== false ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <button
                  onClick={() => setPedido({ ...pedido, tipo_entrega: 'retirada', valor_delivery: 0 })}
                  className={`p-4 rounded-xl text-center transition-colors ${
                    pedido.tipo_entrega === 'retirada'
                      ? 'bg-rose-100 border-2 border-rose-500'
                      : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                  }`}
                >
                  <Package className="w-6 h-6 mx-auto mb-2 text-gray-600" />
                  <p className="font-medium">Retirada</p>
                </button>
                {confeitaria?.delivery_ativo !== false && confeitaria?.delivery_interno_pronto !== false && (
                <button
                  onClick={() => setPedido({ ...pedido, tipo_entrega: 'delivery', valor_delivery: confeitaria?.taxa_delivery || 0 })}
                  className={`p-4 rounded-xl text-center transition-colors ${
                    pedido.tipo_entrega === 'delivery'
                      ? 'bg-rose-100 border-2 border-rose-500'
                      : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                  }`}
                >
                  <Truck className="w-6 h-6 mx-auto mb-2 text-gray-600" />
                  <p className="font-medium">Delivery</p>
                </button>
                )}
              </div>

              {pedido.tipo_entrega === 'delivery' && (
                <>
                  <div>
                    <Label>Endereço de Entrega</Label>
                    <Input
                      value={pedido.endereco_entrega}
                      onChange={(e) => setPedido({ ...pedido, endereco_entrega: e.target.value })}
                      placeholder="Rua, número, bairro..."
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Taxa de Entrega</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={pedido.valor_delivery}
                      onChange={(e) => setPedido({ ...pedido, valor_delivery: parseFloat(e.target.value) || 0 })}
                      className="mt-1"
                    />
                  </div>
                </>
              )}

              <div className="rounded-xl border border-dashed border-rose-200 bg-rose-50/60 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={querReservarProdutoPronto}
                    onCheckedChange={(checked) => {
                      const isChecked = Boolean(checked);
                      setQuerReservarProdutoPronto(isChecked);
                      if (!isChecked) {
                        setPedido((prev) => ({
                          ...prev,
                          data_entrega: '',
                          horario_entrega: '',
                        }));
                      }
                    }}
                  />
                  <div>
                    <p className="font-medium text-gray-900">Quero fazer uma reserva</p>
                    <p className="text-sm text-gray-500">
                      Ao marcar esta opção, informe a data e o horário para separar o produto.
                    </p>
                  </div>
                </div>
              </div>

              {querReservarProdutoPronto && (
                <>
                  <div>
                    <Label>Data da Reserva *</Label>
                    <Input
                      type="date"
                      value={pedido.data_entrega}
                      onChange={(e) => setPedido({ ...pedido, data_entrega: e.target.value })}
                      min={format(new Date(), 'yyyy-MM-dd')}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label>Horário da Reserva</Label>
                    <Input
                      type="time"
                      value={pedido.horario_entrega}
                      onChange={(e) => setPedido({ ...pedido, horario_entrega: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                </>
              )}

              <div>
                <Label>Observações</Label>
                <Textarea
                  value={pedido.observacoes}
                  onChange={(e) => setPedido({ ...pedido, observacoes: e.target.value })}
                  placeholder="Observações adicionais..."
                  className="mt-1 min-h-[80px]"
                />
              </div>
            </div>
          )}

          {/* === PRODUTO PRONTO: Step 4 - Pagamento === */}
          {tipoPedido === 'produto_pronto' && currentStep === 4 && (
            <div className="space-y-4">
              <Label>Forma de Pagamento *</Label>
              <RadioGroup
                value={pedido.forma_pagamento_nome || pedido.forma_pagamento}
                onValueChange={(value) => {
                  const forma = paymentOptions.find((item) => item.nome === value);
                  if (!forma) return;
                  setPedido({
                    ...pedido,
                    forma_pagamento: forma.nome,
                    forma_pagamento_id: forma.id || '',
                    forma_pagamento_nome: forma.nome,
                    parcelas: forma.a_vista ? 1 : Math.min(pedido.parcelas || 1, forma.parcelamento_max),
                  });
                }}
                className="grid gap-3"
              >
                {paymentOptions.map((forma) => (
                  <label
                    key={`${forma.id || 'fallback'}-${forma.nome}`}
                    className={`flex items-start gap-3 p-4 rounded-xl cursor-pointer transition-colors ${
                      (pedido.forma_pagamento_nome || pedido.forma_pagamento) === forma.nome
                        ? 'bg-rose-100 border-2 border-rose-500'
                        : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                    }`}
                  >
                    <RadioGroupItem value={forma.nome} className="mt-1" />
                    <div>
                      <p className="font-medium text-gray-900">{forma.nome}</p>
                      {forma.descricao && (
                        <p className="text-sm text-gray-500 mt-1">{forma.descricao}</p>
                      )}
                    </div>
                  </label>
                ))}
              </RadioGroup>

              {shouldShowInstallments && (
                <div>
                  <Label>Parcelas</Label>
                  <RadioGroup
                    value={String(pedido.parcelas || 1)}
                    onValueChange={(value) => setPedido({ ...pedido, parcelas: Number(value) || 1 })}
                    className="grid grid-cols-2 gap-2 mt-2 sm:grid-cols-3"
                  >
                    {Array.from({ length: selectedPayment.parcelamento_max }, (_, index) => index + 1).map((parcela) => (
                      <label
                        key={parcela}
                        className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                          Number(pedido.parcelas || 1) === parcela
                            ? 'bg-rose-100 border-rose-500'
                            : 'bg-gray-50 hover:bg-gray-100 border-transparent'
                        }`}
                      >
                        <RadioGroupItem value={String(parcela)} />
                        <span className="font-medium text-gray-900">{parcela}x</span>
                      </label>
                    ))}
                  </RadioGroup>
                </div>
              )}
            </div>
          )}

          {/* === PRODUTO PRONTO: Step 5 - Resumo === */}
          {tipoPedido === 'produto_pronto' && currentStep === 5 && (
            <div className="space-y-6">
              <div className="grid gap-4">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-500">Cliente</p>
                  <p className="font-semibold text-gray-900">{pedido.cliente_nome}</p>
                  <p className="text-sm text-gray-600">{pedido.cliente_telefone}</p>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-500">Produtos</p>
                  <div className="mt-2 space-y-1">
                    {carrinho.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span>{item.nome} x{item.quantidade}</span>
                        <span className="font-medium">R$ {(item.preco * item.quantidade).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-500">Entrega</p>
                  <p className="font-semibold text-gray-900">
                    {pedido.tipo_entrega === 'delivery' ? 'Delivery' : 'Retirada'}
                    {querReservarProdutoPronto && pedido.data_entrega
                      ? ` — ${format(parseISO(pedido.data_entrega), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`
                      : ' • Sem reserva'}
                    {querReservarProdutoPronto && pedido.horario_entrega && ` às ${pedido.horario_entrega}`}
                  </p>
                  {pedido.endereco_entrega && (
                    <p className="text-sm text-gray-600 mt-1">{pedido.endereco_entrega}</p>
                  )}
                </div>

                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-500">Pagamento</p>
                  <p className="font-semibold text-gray-900">
                    {pedido.forma_pagamento_nome || pedido.forma_pagamento || 'Não informado'}
                    {Number(pedido.parcelas) > 1 ? ` em ${pedido.parcelas}x` : ''}
                  </p>
                </div>

                {pedido.observacoes && (
                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                    <p className="text-sm text-gray-500">Observações</p>
                    <p className="text-gray-700">{pedido.observacoes}</p>
                  </div>
                )}
              </div>

              <div className="p-4 bg-rose-50 rounded-xl space-y-2">
                {carrinho.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span>{item.nome} x{item.quantidade}</span>
                    <span>R$ {(item.preco * item.quantidade).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
                {pedido.valor_delivery > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Taxa de entrega</span>
                    <span>+ R$ {pedido.valor_delivery.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-rose-200 flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span className="text-rose-600">
                    R$ {totalProdutos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* === PERSONALIZADO: Step 10 - Entrega === */}
          {tipoPedido === 'personalizado' && currentStep === 10 && (
            <div className="space-y-4">
              <div>
                <Label>Data de Entrega *</Label>
                <Input
                  type="date"
                  value={pedido.data_entrega}
                  onChange={(e) => setPedido({ ...pedido, data_entrega: e.target.value })}
                  min={format(new Date(), 'yyyy-MM-dd')}
                  className="mt-1"
                />
              </div>

              {pedido.data_entrega && confeitaria?.prazo_minimo_dias && confeitaria?.habilitar_taxa_urgencia !== false && (
                differenceInDays(parseISO(pedido.data_entrega), new Date()) < confeitaria.prazo_minimo_dias && (
                  <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-800">Pedido com urgência</p>
                      <p className="text-sm text-amber-700">
                        Prazo mínimo é de {confeitaria.prazo_minimo_dias} dias.
                        Será aplicada taxa de urgência de {confeitaria.taxa_urgencia_percentual || 20}%.
                      </p>
                    </div>
                  </div>
                )
              )}

              <div>
                <Label>Horário de Entrega</Label>
                <Input
                  type="time"
                  value={pedido.horario_entrega}
                  onChange={(e) => setPedido({ ...pedido, horario_entrega: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Observações</Label>
                <Textarea
                  value={pedido.observacoes}
                  onChange={(e) => setPedido({ ...pedido, observacoes: e.target.value })}
                  placeholder="Detalhes adicionais, decoração específica, alergias..."
                  className="mt-1 min-h-[100px]"
                />
              </div>
            </div>
          )}

          {/* === PERSONALIZADO: Step 11 - Pagamento === */}
          {tipoPedido === 'personalizado' && currentStep === 11 && (
            <div className="space-y-4">
              <Label>Forma de Pagamento *</Label>
              <RadioGroup
                value={pedido.forma_pagamento_nome || pedido.forma_pagamento}
                onValueChange={(value) => {
                  const forma = paymentOptions.find((item) => item.nome === value);
                  if (!forma) return;
                  setPedido({
                    ...pedido,
                    forma_pagamento: forma.nome,
                    forma_pagamento_id: forma.id || '',
                    forma_pagamento_nome: forma.nome,
                    parcelas: forma.a_vista ? 1 : Math.min(pedido.parcelas || 1, forma.parcelamento_max),
                  });
                }}
                className="grid gap-3"
              >
                {paymentOptions.map((forma) => (
                  <label
                    key={`${forma.id || 'fallback'}-${forma.nome}`}
                    className={`flex items-start gap-3 p-4 rounded-xl cursor-pointer transition-colors ${
                      (pedido.forma_pagamento_nome || pedido.forma_pagamento) === forma.nome
                        ? 'bg-rose-100 border-2 border-rose-500'
                        : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                    }`}
                  >
                    <RadioGroupItem value={forma.nome} className="mt-1" />
                    <div>
                      <p className="font-medium text-gray-900">{forma.nome}</p>
                      {forma.descricao && (
                        <p className="text-sm text-gray-500 mt-1">{forma.descricao}</p>
                      )}
                    </div>
                  </label>
                ))}
              </RadioGroup>

              {shouldShowInstallments && (
                <div>
                  <Label>Parcelas</Label>
                  <RadioGroup
                    value={String(pedido.parcelas || 1)}
                    onValueChange={(value) => setPedido({ ...pedido, parcelas: Number(value) || 1 })}
                    className="grid grid-cols-2 gap-2 mt-2 sm:grid-cols-3"
                  >
                    {Array.from({ length: selectedPayment.parcelamento_max }, (_, index) => index + 1).map((parcela) => (
                      <label
                        key={parcela}
                        className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                          Number(pedido.parcelas || 1) === parcela
                            ? 'bg-rose-100 border-rose-500'
                            : 'bg-gray-50 hover:bg-gray-100 border-transparent'
                        }`}
                      >
                        <RadioGroupItem value={String(parcela)} />
                        <span className="font-medium text-gray-900">{parcela}x</span>
                      </label>
                    ))}
                  </RadioGroup>
                </div>
              )}
            </div>
          )}

          {/* === PERSONALIZADO: Step 12 - Resumo === */}
          {tipoPedido === 'personalizado' && currentStep === 12 && (
            <div className="space-y-6">
              <div className="grid gap-4">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-500">Cliente</p>
                  <p className="font-semibold text-gray-900">{pedido.cliente_nome}</p>
                  <p className="text-sm text-gray-600">{pedido.cliente_telefone}</p>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-500">Bolo</p>
                  <p className="font-semibold text-gray-900">
                    {pedido.tamanho_nome} • {pedido.massa_nome}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {pedido.recheios.map((r, i) => (
                      <Badge key={i} className="bg-rose-100 text-rose-700">{r.nome}</Badge>
                    ))}
                  </div>
                  <p className="mt-2 text-gray-700">Cobertura: {pedido.cobertura_nome}</p>
                </div>

                {pedido.extras.length > 0 && (
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-sm text-gray-500">Extras</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {pedido.extras.map((e, i) => (
                        <Badge key={i} variant="outline">
                          {e.nome}
                          {e.observacao && `: ${e.observacao}`}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {pedido.doces.length > 0 && (
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-sm text-gray-500">Doces</p>
                    <div className="mt-2 space-y-1">
                      {pedido.doces.map((d, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span>{d.quantidade}x {d.nome}</span>
                          <span className="font-medium">R$ {(d.valor_unitario * d.quantidade).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {pedido.salgados.length > 0 && (
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-sm text-gray-500">Salgados</p>
                    <div className="mt-2 space-y-1">
                      {pedido.salgados.map((s, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span>{s.quantidade}x {s.nome}</span>
                          <span className="font-medium">R$ {(s.valor_unitario * s.quantidade).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-500">Entrega</p>
                  <p className="font-semibold text-gray-900">
                    {pedido.tipo_entrega === 'entrega' ? 'Delivery' : pedido.tipo_entrega === 'retirada' ? 'Retirada no local' : ''}
                  </p>
                  <p className="font-semibold text-gray-900 mt-1">
                    {pedido.data_entrega && format(parseISO(pedido.data_entrega), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    {pedido.horario_entrega && ` às ${pedido.horario_entrega}`}
                  </p>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-500">Pagamento</p>
                  <p className="font-semibold text-gray-900">
                    {pedido.forma_pagamento_nome || pedido.forma_pagamento || 'Não informado'}
                    {Number(pedido.parcelas) > 1 ? ` em ${pedido.parcelas}x` : ''}
                  </p>
                  {selectedPayment?.descricao && (
                    <p className="text-sm text-gray-500 mt-1">{selectedPayment.descricao}</p>
                  )}
                </div>

                {pedido.observacoes && (
                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                    <p className="text-sm text-gray-500">Observações</p>
                    <p className="text-gray-700">{pedido.observacoes}</p>
                  </div>
                )}
              </div>

              {/* Valores */}
              <div className="p-4 bg-rose-50 rounded-xl space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Tamanho</span>
                  <span>R$ {pedido.valor_tamanho?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                {pedido.valor_massa > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Massa</span>
                    <span>+ R$ {pedido.valor_massa?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {pedido.valor_recheios > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Recheios</span>
                    <span>+ R$ {pedido.valor_recheios?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {pedido.valor_cobertura > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Cobertura</span>
                    <span>+ R$ {pedido.valor_cobertura?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {pedido.valor_extras > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Extras</span>
                    <span>+ R$ {pedido.valor_extras?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {pedido.valor_doces > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Doces</span>
                    <span>+ R$ {pedido.valor_doces?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {pedido.valor_salgados > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Salgados</span>
                    <span>+ R$ {pedido.valor_salgados?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {pedido.valor_delivery > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Taxa de entrega</span>
                    <span>+ R$ {pedido.valor_delivery?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {pedido.valor_urgencia > 0 && (
                  <div className="flex justify-between text-sm text-amber-700">
                    <span>Taxa de urgência</span>
                    <span>+ R$ {pedido.valor_urgencia?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-rose-200 flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span className="text-rose-600">
                    R$ {pedido.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between gap-4">
        <Button
          variant="outline"
          onClick={() => setCurrentStep(currentStep - 1)}
          disabled={currentStep === 1}
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Voltar
        </Button>

        {currentStep < steps.length ? (
          <Button
            onClick={() => setCurrentStep(currentStep + 1)}
            disabled={!canProceed()}
            className="bg-rose-500 hover:bg-rose-600"
          >
            Próximo
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button
            onClick={() => createPedidoMutation.mutate()}
            disabled={createPedidoMutation.isPending}
            className="bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 shadow-lg shadow-rose-200"
          >
            {createPedidoMutation.isPending
              ? (isEditing ? 'Salvando...' : 'Criando...')
              : (isEditing ? 'Salvar Alterações' : 'Criar Pedido')}
          </Button>
        )}
      </div>

      {/* New Client Dialog */}
      <Dialog open={showNewClientDialog} onOpenChange={setShowNewClientDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Nome *</Label>
              <Input
                value={newClient.nome}
                onChange={(e) => setNewClient({ ...newClient, nome: e.target.value })}
                placeholder="Nome completo"
              />
            </div>
            <div>
              <Label>Telefone *</Label>
              <Input
                value={newClient.telefone}
                onChange={(e) => setNewClient({ ...newClient, telefone: e.target.value })}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input
                type="email"
                value={newClient.email}
                onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                placeholder="email@exemplo.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewClientDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => createClientMutation.mutate(newClient)}
              disabled={!newClient.nome || !newClient.telefone || createClientMutation.isPending}
              className="bg-rose-500 hover:bg-rose-600"
            >
              {createClientMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Customizador de Complementos */}
      <CustomizadorProdutoModal
        open={showCustomizador}
        onOpenChange={(val) => { if (!val) setEditandoItemCarrinho(null); setShowCustomizador(val); }}
        produto={produtoCustomizando}
        onAdicionar={adicionarComComplementos}
        initialSelecionados={editandoItemCarrinho?.complementos_selecionados?.map(c => c.nome) ?? []}
        initialQuantidade={editandoItemCarrinho?.quantidade ?? 1}
      />
    </div>
  );
}
