import React, { useEffect, useState } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createCatalogUrl, createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';
import {
  Store,
  Plus,
  Pencil,
  Trash2,
  Save,
  Settings2,
  ExternalLink,
  Upload,
  X,
  CreditCard,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Package,
  ShoppingBag,
  Truck,
  MessageSquare,
} from 'lucide-react';
import { useEventTracker } from '@/lib/useEventTracker';
import { useTour } from '@/lib/TourContext';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TelefoneInput, MoedaInput } from '@/components/ui/masked-input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';



import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const isPixPaymentName = (name = '') => name.toLowerCase().includes('pix');

const normalizeFormaPagamento = (forma = {}) => {
  const pix = isPixPaymentName(forma.nome || '');
  const aVista = forma.a_vista === true;
  const parcelamentoMax = aVista ? 1 : Math.max(Number(forma.parcelamento_max) || 1, 1);

  return {
    ...forma,
    descricao: aVista && pix && (!forma.descricao || forma.descricao === 'À vista')
      ? 'À vista'
      : (forma.descricao || ''),
    a_vista: aVista,
    parcelamento_max: parcelamentoMax,
    chave_pix: forma.chave_pix || '',
    ativo: forma.ativo !== false,
  };
};

const defaultEtapasPedido = [
  { key: 'tamanho', label: 'Tamanho', ativo: true },
  { key: 'massa', label: 'Massa', ativo: true },
  { key: 'recheios', label: 'Recheios', ativo: true },
  { key: 'cobertura', label: 'Cobertura', ativo: true },
  { key: 'extras', label: 'Extras', ativo: true },
  { key: 'doces', label: 'Doces', ativo: true },
  { key: 'salgados', label: 'Salgados', ativo: true },
  { key: 'tipo_entrega', label: 'Tipo de Entrega', ativo: true },
  { key: 'entrega', label: 'Entrega', ativo: true },
  { key: 'dados', label: 'Seus Dados', ativo: true },
  { key: 'pagamento', label: 'Pagamento', ativo: true },
  { key: 'resumo', label: 'Resumo', ativo: true }
];

const normalizeEtapasPedido = (etapas) => {
  const baseEtapas = Array.isArray(etapas) && etapas.length > 0
    ? etapas.flatMap((etapa) =>
      etapa.key === 'doces_salgados'
        ? [
          { key: 'doces', label: 'Doces', ativo: etapa.ativo !== false },
          { key: 'salgados', label: 'Salgados', ativo: etapa.ativo !== false }
        ]
        : [{
          ...etapa,
          label: etapa.label || defaultEtapasPedido.find((item) => item.key === etapa.key)?.label || etapa.key
        }]
    )
    : defaultEtapasPedido;

  if (baseEtapas.some((etapa) => etapa.key === 'tipo_entrega')) {
    return baseEtapas;
  }

  const etapaTipoEntrega = { key: 'tipo_entrega', label: 'Tipo de Entrega', ativo: true };
  const entregaIndex = baseEtapas.findIndex((etapa) => etapa.key === 'entrega');

  if (entregaIndex === -1) {
    return [...baseEtapas, etapaTipoEntrega];
  }

  const novasEtapas = [...baseEtapas];
  novasEtapas.splice(entregaIndex, 0, etapaTipoEntrega);
  return novasEtapas;
};

export default function Configuracoes() {
  const { user } = useAuth();
  const { toast, dismiss } = useToast();
  const { trackEvent } = useEventTracker();
  const urlParams = new URLSearchParams(window.location.search);
  const [activeTab, setActiveTab] = useState(urlParams.get('tab') || 'geral');
  const queryClient = useQueryClient();

  const { iconsEnabled: tourIconsEnabled, setIconsEnabled: setTourContextIcons } = useTour();
  const TOUR_ICONS_KEY = 'cakeflow_tour_icons_enabled';
  const toggleTourIcons = (val) => {
    localStorage.setItem(TOUR_ICONS_KEY, val ? 'true' : 'false');
    setTourContextIcons(val);
  };

  // Form states
  const [confeitariaForm, setConfeitariaForm] = useState({
    nome: '',
    slug: '',
    descricao: '',
    logo_url: '',
    cor_principal: '',
    telefone: '',
    endereco: '',
    instagram: '',
    prazo_minimo_dias: 3,
    habilitar_taxa_urgencia: true,
    taxa_urgencia_percentual: 20,
    taxa_delivery: 0,
    delivery_ativo: true,
    delivery_catalogo_pronto: true,
    delivery_catalogo_personalizado: true,
    delivery_interno_pronto: true,
    delivery_interno_personalizado: true,
    mensagem_confirmacao_pedido: '',
    max_complementos_produto: 4,
    categorias_produto: [
      { value: 'bolo', label: 'Bolo' },
      { value: 'doce', label: 'Doce' },
      { value: 'salgado', label: 'Salgado' },
      { value: 'bebida', label: 'Bebida' },
      { value: 'outro', label: 'Outro' },
    ],
    catalogo_ativo: true,
    receber_pedidos_whatsapp: true,
    exibir_pedido_personalizado: true,
    frase_pedido_personalizado: 'Monte seu Bolo Personalizado',
    limite_pedidos_personalizados_diarios: '',
    horario_funcionamento: { inicio: '', fim: '' },
    dias_funcionamento: [],
    etapas_pedido: [],
  });

  const [novaCategoria, setNovaCategoria] = useState('');

  // Item forms
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [itemType, setItemType] = useState('massa');
  const [itemForm, setItemForm] = useState({});
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    if (user && !user.confeitaria_id) {
      window.location.href = createPageUrl('Onboarding');
    }
  }, [user]);

  const { data: confeitaria, refetch: refetchConfeitaria } = useQuery({
    queryKey: ['confeitaria', user?.confeitaria_id],
    queryFn: async () => {
      const list = await appClient.entities.Confeitaria.filter({ id: user.confeitaria_id });
      const conf = list[0];
      if (conf) {
        setConfeitariaForm({
          nome: conf.nome || '',
          slug: conf.slug || '',
          descricao: conf.descricao || '',
          logo_url: conf.logo_url || '',
          cor_principal: conf.cor_principal || '',
          telefone: conf.telefone || '',
          endereco: conf.endereco || '',
          instagram: conf.instagram || '',
          prazo_minimo_dias: conf.prazo_minimo_dias || 3,
          habilitar_taxa_urgencia: conf.habilitar_taxa_urgencia !== false,
          taxa_urgencia_percentual: conf.taxa_urgencia_percentual || 20,
          taxa_delivery: conf.taxa_delivery || 0,
          delivery_ativo: conf.delivery_ativo !== false,
          delivery_catalogo_pronto: conf.delivery_catalogo_pronto !== false,
          delivery_catalogo_personalizado: conf.delivery_catalogo_personalizado !== false,
          delivery_interno_pronto: conf.delivery_interno_pronto !== false,
          delivery_interno_personalizado: conf.delivery_interno_personalizado !== false,
          mensagem_confirmacao_pedido: conf.mensagem_confirmacao_pedido || '',
          max_complementos_produto: conf.max_complementos_produto || 4,
          categorias_produto: Array.isArray(conf.categorias_produto) && conf.categorias_produto.length > 0
            ? conf.categorias_produto
            : [
              { value: 'bolo', label: 'Bolo' },
              { value: 'doce', label: 'Doce' },
              { value: 'salgado', label: 'Salgado' },
              { value: 'bebida', label: 'Bebida' },
              { value: 'outro', label: 'Outro' },
            ],
          catalogo_ativo: conf.catalogo_ativo !== false,
          receber_pedidos_whatsapp: conf.receber_pedidos_whatsapp !== false,
          exibir_pedido_personalizado: conf.exibir_pedido_personalizado !== false,
          frase_pedido_personalizado: conf.frase_pedido_personalizado || 'Monte seu Bolo Personalizado',
          limite_pedidos_personalizados_diarios: conf.limite_pedidos_personalizados_diarios ?? '',
          horario_funcionamento: conf.horario_funcionamento || { inicio: '', fim: '' },
          dias_funcionamento: conf.dias_funcionamento || [],
          etapas_pedido: normalizeEtapasPedido(conf.etapas_pedido),
        });
      }
      return conf;
    },
    enabled: !!user?.confeitaria_id,
  });

  const { data: formasPagamento = [] } = useQuery({
    queryKey: ['formasPagamento', user?.confeitaria_id],
    queryFn: () => appClient.entities.FormaPagamento.filter({ confeitaria_id: user.confeitaria_id }),
    enabled: !!user?.confeitaria_id,
  });

  // Mutations
  const buildConfeitariaPayload = () => ({
    nome: confeitariaForm.nome?.trim() || '',
    descricao: confeitariaForm.descricao || '',
    logo_url: confeitariaForm.logo_url || '',
    cor_principal: confeitariaForm.cor_principal || '',
    telefone: confeitariaForm.telefone || '',
    endereco: confeitariaForm.endereco || '',
    instagram: confeitariaForm.instagram || '',
    prazo_minimo_dias: Number(confeitariaForm.prazo_minimo_dias) || 0,
    habilitar_taxa_urgencia: !!confeitariaForm.habilitar_taxa_urgencia,
    taxa_urgencia_percentual: Number(confeitariaForm.taxa_urgencia_percentual) || 0,
    taxa_delivery: Number(confeitariaForm.taxa_delivery) || 0,
    delivery_ativo: confeitariaForm.delivery_ativo !== false,
    delivery_catalogo_pronto: confeitariaForm.delivery_catalogo_pronto !== false,
    delivery_catalogo_personalizado: confeitariaForm.delivery_catalogo_personalizado !== false,
    delivery_interno_pronto: confeitariaForm.delivery_interno_pronto !== false,
    delivery_interno_personalizado: confeitariaForm.delivery_interno_personalizado !== false,
    mensagem_confirmacao_pedido: confeitariaForm.mensagem_confirmacao_pedido || '',
    max_complementos_produto: Math.min(10, Math.max(1, Number(confeitariaForm.max_complementos_produto) || 4)),
    categorias_produto: confeitariaForm.categorias_produto,
    catalogo_ativo: !!confeitariaForm.catalogo_ativo,
    receber_pedidos_whatsapp: !!confeitariaForm.receber_pedidos_whatsapp,
    exibir_pedido_personalizado: !!confeitariaForm.exibir_pedido_personalizado,
    frase_pedido_personalizado: confeitariaForm.frase_pedido_personalizado || '',
    limite_pedidos_personalizados_diarios: confeitariaForm.limite_pedidos_personalizados_diarios !== ''
      ? Number(confeitariaForm.limite_pedidos_personalizados_diarios) || null
      : null,
    horario_funcionamento: confeitariaForm.horario_funcionamento || { inicio: '', fim: '' },
    dias_funcionamento: Array.isArray(confeitariaForm.dias_funcionamento)
      ? confeitariaForm.dias_funcionamento
      : [],
    etapas_pedido: normalizeEtapasPedido(confeitariaForm.etapas_pedido)
  });

  const updateConfeitaria = useMutation({
    mutationFn: async () => {
      if (!confeitaria?.id) {
        throw new Error('Confeitaria não encontrada para salvar as configurações.');
      }

      const payload = buildConfeitariaPayload();
      let updated = await appClient.entities.Confeitaria.update(confeitaria.id, payload);

      // Fallback para casos em que o perfil perdeu o confeitaria_id e o RLS bloqueia update.
      if (!updated?.id) {
        try {
          await appClient.auth.updateMe({ confeitaria_id: confeitaria.id });
          updated = await appClient.entities.Confeitaria.update(confeitaria.id, payload);
        } catch (syncError) {
          console.error('Falha ao sincronizar confeitaria_id antes de salvar:', syncError);
        }
      }

      if (!updated?.id) {
        throw new Error(
          'Não foi possível atualizar os dados da confeitaria. Refaça o login para renovar a sessão e tente novamente.'
        );
      }
      return updated;
    },
    onSuccess: async (data) => {
      queryClient.setQueryData(['confeitaria', user?.confeitaria_id], data);
      await queryClient.invalidateQueries({ queryKey: ['confeitaria', user?.confeitaria_id] });
      dismiss();
      toast({
        title: 'Configurações salvas',
        description: 'As alterações foram salvas com sucesso.',
        duration: 2500
      });
    },
    onError: (error) => {
      if (Number(error?.status) === 401) {
        appClient.auth.redirectToLogin(window.location.href);
        return;
      }

      toast({
        title: 'Erro ao salvar',
        description: error?.message || 'Não foi possível salvar as configurações.',
        variant: 'destructive'
      });
    }
  });

  const getEntityForType = (type) => {
    switch (type) {
      case 'FormaPagamento': return appClient.entities.FormaPagamento;
      default: return null;
    }
  };

  const invalidateEntityQueries = (type) => {
    if (type === 'FormaPagamento') {
      queryClient.invalidateQueries({ queryKey: ['formasPagamento', user?.confeitaria_id] });
      return;
    }
    queryClient.invalidateQueries({ queryKey: [`${type}s`] });
  };

  const saveItem = useMutation({
    mutationFn: async ({ type, data, id }) => {
      const entity = getEntityForType(type);
      // Strip read-only/internal fields before sending
      const { id: _id, confeitaria_id: _cid, created_date, updated_date, ...cleanData } = data;
      if (id) {
        return entity.update(id, cleanData);
      }
      return entity.create({
        ...cleanData,
        confeitaria_id: user.confeitaria_id,
      });
    },
    onSuccess: () => {
      invalidateEntityQueries(itemType);
      closeItemForm();
      toast({ title: 'Salvo com sucesso!' });
    },
    onError: (error) => {
      console.error('Erro ao salvar:', error);
      toast({
        title: 'Erro ao salvar',
        description: error?.message || 'Tente novamente.',
        variant: 'destructive',
      });
    },
  });

  const deleteItem = useMutation({
    mutationFn: async ({ type, id }) => {
      const entity = getEntityForType(type);
      return entity.delete(id);
    },
    onSuccess: (_, { type }) => {
      invalidateEntityQueries(type);
    },
  });

  const toggleItemActive = useMutation({
    mutationFn: async ({ type, id, ativo }) => {
      const entity = getEntityForType(type);
      return entity.update(id, { ativo });
    },
    onSuccess: (_, { type }) => {
      invalidateEntityQueries(type);
    },
  });

  const openItemForm = (type, item = null) => {
    setItemType(type);
    setEditingItem(item);

    if (item) {
      setItemForm(type === 'FormaPagamento' ? normalizeFormaPagamento(item) : { ...item });
    } else {
      setItemForm(
        type === 'FormaPagamento'
          ? normalizeFormaPagamento({ nome: '', descricao: '', a_vista: false, parcelamento_max: 1, chave_pix: '', ativo: true })
          : { nome: '', ativo: true }
      );
    }
    setShowItemForm(true);
  };

  const closeItemForm = () => {
    setShowItemForm(false);
    setEditingItem(null);
    setItemForm({});
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const { file_url } = await appClient.integrations.Core.UploadFile({ file });
      setConfeitariaForm({ ...confeitariaForm, logo_url: file_url });
      toast({
        title: 'Imagem enviada',
        description: 'Upload concluído com sucesso.',
        duration: 2500
      });
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      toast({
        title: 'Erro no upload da imagem',
        description: error?.message || 'Não foi possível enviar a imagem.',
        variant: 'destructive'
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  const renderItemFormFields = () => {
    const isPix = itemType === 'FormaPagamento' && isPixPaymentName(itemForm.nome || '');

    return (
      <div className="space-y-4">
        <div>
          <Label>Nome *</Label>
          <Input
            value={itemForm.nome || ''}
            onChange={(e) => {
              const nome = e.target.value;
              setItemForm(normalizeFormaPagamento({
                ...itemForm,
                nome,
              }));
            }}
            placeholder="Ex: PIX, Dinheiro, Cartão de Crédito"
          />
        </div>

        {itemType === 'FormaPagamento' && (
          <>
            <div className="flex items-start justify-between rounded-xl border p-4">
              <div>
                <Label className="text-base">Pagamento à vista</Label>
                <p className="text-sm text-gray-500 mt-1">
                  Quando ativado, não exibe parcelamento e salva sempre 1x.
                </p>
              </div>
              <Switch
                checked={itemForm.a_vista === true}
                onCheckedChange={(checked) =>
                  setItemForm(normalizeFormaPagamento({
                    ...itemForm,
                    a_vista: checked,
                    parcelamento_max: checked ? 1 : itemForm.parcelamento_max,
                    descricao: checked && isPix ? 'À vista' : (!checked && isPix && itemForm.descricao === 'À vista' ? '' : itemForm.descricao),
                  }))
                }
              />
            </div>

            {!normalizeFormaPagamento(itemForm).a_vista && (
              <div>
                <Label>Quantidade máxima de parcelas *</Label>
                <Input
                  type="number"
                  min="1"
                  value={itemForm.parcelamento_max || 1}
                  onChange={(e) =>
                    setItemForm(normalizeFormaPagamento({
                      ...itemForm,
                      parcelamento_max: Math.max(Number(e.target.value) || 1, 1)
                    }))
                  }
                />
              </div>
            )}

            <div>
              <Label>Observação</Label>
              {isPix && normalizeFormaPagamento(itemForm).a_vista ? (
                <Input value="À vista" disabled />
              ) : (
                <Textarea
                  value={itemForm.descricao || ''}
                  onChange={(e) => setItemForm({ ...itemForm, descricao: e.target.value })}
                  placeholder="Ex: Taxas, instruções ou condições de pagamento"
                  className="min-h-[80px]"
                />
              )}
            </div>

            {isPix && (
              <div>
                <Label>Chave Pix</Label>
                <Input
                  value={itemForm.chave_pix || ''}
                  onChange={(e) => setItemForm({ ...itemForm, chave_pix: e.target.value })}
                  placeholder="CPF, e-mail, telefone ou chave aleatória"
                />
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  const ItemCard = ({ item, icon: Icon }) => (
    <div className={`flex items-center justify-between p-4 rounded-xl ${item.ativo !== false ? 'bg-gray-50' : 'bg-gray-100 opacity-60'}`}>
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-rose-100">
          <Icon className="w-4 h-4 text-rose-600" />
        </div>
        <div>
          <p className="font-medium text-gray-900">{item.nome}</p>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className="text-xs font-medium text-gray-500">
              {normalizeFormaPagamento(item).a_vista ? 'À vista' : `Até ${normalizeFormaPagamento(item).parcelamento_max}x`}
            </span>
            {normalizeFormaPagamento(item).descricao && (
              <span className="text-xs text-gray-400">{normalizeFormaPagamento(item).descricao}</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Switch
          checked={item.ativo !== false}
          onCheckedChange={(checked) => toggleItemActive.mutate({ type: 'FormaPagamento', id: item.id, ativo: checked })}
        />
        <Button size="icon" variant="ghost" onClick={() => openItemForm('FormaPagamento', item)}>
          <Pencil className="w-4 h-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="text-red-600 hover:bg-red-50"
          onClick={() => deleteItem.mutate({ type: 'FormaPagamento', id: item.id })}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );

  if (!user) return null;

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={(tab) => {
        setActiveTab(tab);
      }}>
        <TabsList className="grid w-full grid-cols-4 bg-white border-b border-gray-200 p-0 rounded-none h-auto gap-0">
          <TabsTrigger
            value="geral"
            className="flex flex-col items-center justify-center gap-1 rounded-none border-b-2 border-transparent px-4 py-4 text-gray-600 hover:text-rose-600 data-[state=active]:border-rose-500 data-[state=active]:text-rose-600 data-[state=active]:bg-white transition-all"
          >
            <Settings2 className="w-5 h-5" />
            <span className="text-xs font-medium">Geral</span>
          </TabsTrigger>
          <TabsTrigger
            value="catalogo"
            className="flex flex-col items-center justify-center gap-1 rounded-none border-b-2 border-transparent px-4 py-4 text-gray-600 hover:text-rose-600 data-[state=active]:border-rose-500 data-[state=active]:text-rose-600 data-[state=active]:bg-white transition-all"
          >
            <ExternalLink className="w-5 h-5" />
            <span className="text-xs font-medium">Catálogo</span>
          </TabsTrigger>
          <TabsTrigger
            value="produtos"
            className="flex flex-col items-center justify-center gap-1 rounded-none border-b-2 border-transparent px-4 py-4 text-gray-600 hover:text-rose-600 data-[state=active]:border-rose-500 data-[state=active]:text-rose-600 data-[state=active]:bg-white transition-all"
          >
            <Package className="w-5 h-5" />
            <span className="text-xs font-medium">Produtos</span>
          </TabsTrigger>
          <TabsTrigger
            value="pedidos"
            className="flex flex-col items-center justify-center gap-1 rounded-none border-b-2 border-transparent px-4 py-4 text-gray-600 hover:text-rose-600 data-[state=active]:border-rose-500 data-[state=active]:text-rose-600 data-[state=active]:bg-white transition-all"
          >
            <ShoppingBag className="w-5 h-5" />
            <span className="text-xs font-medium">Pedidos</span>
          </TabsTrigger>
        </TabsList>

        {/* Geral */}
        <TabsContent value="geral" className="mt-6">
          <Card className="border-0 shadow-lg shadow-gray-100/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="w-5 h-5 text-rose-500" />
                Dados da Confeitaria
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-semibold text-gray-900 mb-4">Informações Básicas</h4>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>Nome da Confeitaria</Label>
                    <Input
                      value={confeitariaForm.nome}
                      onChange={(e) => setConfeitariaForm({ ...confeitariaForm, nome: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Telefone / WhatsApp</Label>
                    <TelefoneInput
                      value={confeitariaForm.telefone}
                      onChange={(e) => setConfeitariaForm({ ...confeitariaForm, telefone: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Instagram</Label>
                    <Input
                      value={confeitariaForm.instagram}
                      onChange={(e) => setConfeitariaForm({ ...confeitariaForm, instagram: e.target.value })}
                      placeholder="@suaconfeitaria"
                    />
                  </div>
                  <div>
                    <Label>Endereço</Label>
                    <Input
                      value={confeitariaForm.endereco}
                      onChange={(e) => setConfeitariaForm({ ...confeitariaForm, endereco: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Descrição (para o catálogo público)</Label>
                    <Textarea
                      value={confeitariaForm.descricao}
                      onChange={(e) => setConfeitariaForm({ ...confeitariaForm, descricao: e.target.value })}
                      placeholder="Conte sobre sua confeitaria..."
                      className="min-h-[80px]"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <h4 className="font-semibold text-gray-900 mb-4">Horário de Funcionamento</h4>
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label>Horário de Abertura</Label>
                      <Input
                        type="time"
                        value={confeitariaForm.horario_funcionamento?.inicio || ''}
                        onChange={(e) => setConfeitariaForm({
                          ...confeitariaForm,
                          horario_funcionamento: {
                            ...confeitariaForm.horario_funcionamento,
                            inicio: e.target.value
                          }
                        })}
                      />
                    </div>
                    <div>
                      <Label>Horário de Fechamento</Label>
                      <Input
                        type="time"
                        value={confeitariaForm.horario_funcionamento?.fim || ''}
                        onChange={(e) => setConfeitariaForm({
                          ...confeitariaForm,
                          horario_funcionamento: {
                            ...confeitariaForm.horario_funcionamento,
                            fim: e.target.value
                          }
                        })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="mb-3 block">Dias de Funcionamento</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                      {[
                        { value: 'seg', label: 'Seg' },
                        { value: 'ter', label: 'Ter' },
                        { value: 'qua', label: 'Qua' },
                        { value: 'qui', label: 'Qui' },
                        { value: 'sex', label: 'Sex' },
                        { value: 'sab', label: 'Sáb' },
                        { value: 'dom', label: 'Dom' },
                      ].map((dia) => {
                        const isSelected = confeitariaForm.dias_funcionamento?.includes(dia.value);
                        return (
                          <label
                            key={dia.value}
                            className={`flex items-center justify-center p-2 rounded-lg border-2 cursor-pointer transition-colors ${isSelected
                              ? 'bg-rose-100 border-rose-500 text-rose-700'
                              : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                              }`}
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => {
                                const dias = confeitariaForm.dias_funcionamento || [];
                                setConfeitariaForm({
                                  ...confeitariaForm,
                                  dias_funcionamento: checked
                                    ? [...dias, dia.value]
                                    : dias.filter(d => d !== dia.value)
                                });
                              }}
                              className="sr-only"
                            />
                            <span className="text-sm font-medium">{dia.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <h4 className="font-semibold text-gray-900 mb-4">Regras de Negócio</h4>
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label>Prazo Mínimo para Encomendas (dias)</Label>
                      <Input
                        type="number"
                        value={confeitariaForm.prazo_minimo_dias}
                        onChange={(e) => setConfeitariaForm({ ...confeitariaForm, prazo_minimo_dias: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-xl space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <Label className="text-base font-medium text-gray-900">
                          Habilitar Taxa de Urgência
                        </Label>
                        <p className="text-sm text-gray-500 mt-1">
                          Cobra uma taxa adicional para pedidos realizados com menos do que o prazo mínimo
                        </p>
                      </div>
                      <Switch
                        checked={confeitariaForm.habilitar_taxa_urgencia}
                        onCheckedChange={(checked) => setConfeitariaForm({ ...confeitariaForm, habilitar_taxa_urgencia: checked })}
                        className="ml-4"
                      />
                    </div>
                    {confeitariaForm.habilitar_taxa_urgencia && (
                      <div>
                        <Label>Taxa de Urgência (%)</Label>
                        <Input
                          type="number"
                          value={confeitariaForm.taxa_urgencia_percentual}
                          onChange={(e) => setConfeitariaForm({ ...confeitariaForm, taxa_urgencia_percentual: parseInt(e.target.value) || 0 })}
                          placeholder="20"
                        />
                        <p className="text-xs text-gray-500 mt-2">
                          Percentual cobrado sobre o valor total do pedido quando feito com urgência
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </CardContent>
          </Card>

          {/* Preferências do Dashboard */}
          <Card className="border-0 shadow-lg shadow-gray-100/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Settings2 className="w-4 h-4" />
                Preferências do Dashboard
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">Exibir ícone de ajuda (Tour)</p>
                  <p className="text-xs text-gray-500 mt-0.5">Mostra o ícone ? na barra superior para acessar o tour de cada página</p>
                </div>
                <Switch
                  checked={tourIconsEnabled}
                  onCheckedChange={toggleTourIcons}
                />
              </div>
              <div className="pt-2 border-t">
                <Button
                  onClick={() => updateConfeitaria.mutate()}
                  disabled={updateConfeitaria.isPending || !confeitaria?.id}
                  className="bg-rose-500 hover:bg-rose-600"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {updateConfeitaria.isPending ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Produtos */}
        <TabsContent value="produtos" className="mt-6">
          <Card className="border-0 shadow-lg shadow-gray-100/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-rose-500" />
                Configurações de Produtos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="ajuste" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6 bg-rose-50/50 p-1">
                  <TabsTrigger value="ajuste" className="data-[state=active]:bg-white data-[state=active]:text-rose-600 data-[state=active]:shadow-sm">Ajuste</TabsTrigger>
                  <TabsTrigger value="categorias" className="data-[state=active]:bg-white data-[state=active]:text-rose-600 data-[state=active]:shadow-sm">Categorias</TabsTrigger>
                </TabsList>

                <TabsContent value="ajuste" className="space-y-6 mt-0">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-4">Complementos</h4>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label>Máximo de Complementos por Produto</Label>
                        <Input
                          type="number"
                          min={1}
                          max={10}
                          value={confeitariaForm.max_complementos_produto}
                          onChange={(e) => {
                            const val = Math.min(10, Math.max(1, parseInt(e.target.value) || 4));
                            setConfeitariaForm({ ...confeitariaForm, max_complementos_produto: val });
                          }}
                        />
                        <p className="text-xs text-gray-500 mt-1">Padrão: 4 • Máximo: 10</p>
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={() => updateConfeitaria.mutate()}
                    disabled={updateConfeitaria.isPending || !confeitaria?.id}
                    className="bg-rose-500 hover:bg-rose-600"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {updateConfeitaria.isPending ? 'Salvando...' : 'Salvar Alterações'}
                  </Button>
                </TabsContent>

                <TabsContent value="categorias" className="space-y-4 mt-0">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">Categorias de Produto</h4>
                    <p className="text-sm text-gray-500 mb-4">
                      Configure as categorias exibidas ao cadastrar produtos. Mínimo de 1 categoria.
                    </p>
                  </div>

                  <div className="space-y-2">
                    {confeitariaForm.categorias_produto.map((cat, index) => (
                      <div key={cat.value} className="flex items-center gap-2">
                        <div className="flex flex-col gap-0.5">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            disabled={index === 0}
                            onClick={() => {
                              const cats = [...confeitariaForm.categorias_produto];
                              [cats[index - 1], cats[index]] = [cats[index], cats[index - 1]];
                              setConfeitariaForm({ ...confeitariaForm, categorias_produto: cats });
                            }}
                          >
                            <ArrowUp className="w-3 h-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            disabled={index === confeitariaForm.categorias_produto.length - 1}
                            onClick={() => {
                              const cats = [...confeitariaForm.categorias_produto];
                              [cats[index], cats[index + 1]] = [cats[index + 1], cats[index]];
                              setConfeitariaForm({ ...confeitariaForm, categorias_produto: cats });
                            }}
                          >
                            <ArrowDown className="w-3 h-3" />
                          </Button>
                        </div>
                        <Input
                          value={cat.label}
                          onChange={(e) => {
                            const cats = [...confeitariaForm.categorias_produto];
                            cats[index] = { ...cat, label: e.target.value };
                            setConfeitariaForm({ ...confeitariaForm, categorias_produto: cats });
                          }}
                          className="flex-1"
                          placeholder="Nome da categoria"
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-red-500 hover:bg-red-50 shrink-0"
                          disabled={confeitariaForm.categorias_produto.length <= 1}
                          onClick={() => {
                            const cats = confeitariaForm.categorias_produto.filter((_, i) => i !== index);
                            setConfeitariaForm({ ...confeitariaForm, categorias_produto: cats });
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2 pt-2 border-t">
                    <Input
                      value={novaCategoria}
                      onChange={(e) => setNovaCategoria(e.target.value)}
                      placeholder="Nome da nova categoria"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && novaCategoria.trim()) {
                          const slug = novaCategoria.trim().toLowerCase()
                            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                            .replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
                          const value = slug || `cat_${Date.now()}`;
                          setConfeitariaForm({
                            ...confeitariaForm,
                            categorias_produto: [
                              ...confeitariaForm.categorias_produto,
                              { value, label: novaCategoria.trim() },
                            ],
                          });
                          setNovaCategoria('');
                        }
                      }}
                    />
                    <Button
                      variant="outline"
                      disabled={!novaCategoria.trim()}
                      onClick={() => {
                        const slug = novaCategoria.trim().toLowerCase()
                          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                          .replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
                        const value = slug || `cat_${Date.now()}`;
                        setConfeitariaForm({
                          ...confeitariaForm,
                          categorias_produto: [
                            ...confeitariaForm.categorias_produto,
                            { value, label: novaCategoria.trim() },
                          ],
                        });
                        setNovaCategoria('');
                      }}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Adicionar
                    </Button>
                  </div>

                  <Button
                    onClick={() => updateConfeitaria.mutate()}
                    disabled={updateConfeitaria.isPending || !confeitaria?.id}
                    className="bg-rose-500 hover:bg-rose-600"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {updateConfeitaria.isPending ? 'Salvando...' : 'Salvar Categorias'}
                  </Button>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Catálogo */}
        <TabsContent value="catalogo" className="mt-6">
          <Card className="border-0 shadow-lg shadow-gray-100/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ExternalLink className="w-5 h-5 text-rose-500" />
                Configurações do Catálogo Público
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <Tabs defaultValue="geral" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-6 bg-rose-50/50 p-1">
                  <TabsTrigger value="geral" className="data-[state=active]:bg-white data-[state=active]:text-rose-600 data-[state=active]:shadow-sm">Geral</TabsTrigger>
                  <TabsTrigger value="personalizacao" className="data-[state=active]:bg-white data-[state=active]:text-rose-600 data-[state=active]:shadow-sm">Personalização</TabsTrigger>
                  <TabsTrigger value="pagamentos" className="data-[state=active]:bg-white data-[state=active]:text-rose-600 data-[state=active]:shadow-sm">Pagamentos</TabsTrigger>
                </TabsList>

                <TabsContent value="geral" className="space-y-6 mt-0">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-4">URL do Catálogo</h4>
                    {confeitariaForm.slug && (() => {
                      const catalogUrl = createCatalogUrl(confeitariaForm.slug);
                      return (
                        <div className="p-4 bg-rose-50 rounded-xl border border-rose-200">
                          <p className="text-sm text-gray-600 mb-2">Link do seu catálogo:</p>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 p-2 bg-white rounded border text-sm text-rose-600 truncate">
                              {catalogUrl}
                            </code>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(catalogUrl, '_blank')}
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          </div>
                          <p className="text-xs text-gray-500 mt-2">
                            O slug foi definido no cadastro e não pode ser alterado
                          </p>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="pt-4 border-t">
                    <h4 className="font-semibold text-gray-900 mb-4">Disponibilidade</h4>
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                      <div>
                        <p className="text-sm font-medium text-gray-900">Catálogo online ativo</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Quando desativado, clientes verão uma mensagem de catálogo indisponível
                        </p>
                      </div>
                      <Switch
                        checked={confeitariaForm.catalogo_ativo}
                        onCheckedChange={(checked) => setConfeitariaForm({ ...confeitariaForm, catalogo_ativo: checked })}
                        className="data-[state=checked]:bg-rose-500 ml-4"
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <h4 className="font-semibold text-gray-900 mb-4">Identidade Visual</h4>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label>Logo da Confeitaria</Label>
                        <div className="mt-2 space-y-3">
                          {confeitariaForm.logo_url ? (
                            <div className="relative inline-block">
                              <img
                                src={confeitariaForm.logo_url}
                                alt="Logo"
                                className="h-24 w-24 object-cover rounded-full border-2 border-rose-200"
                              />
                              <button
                                onClick={() => setConfeitariaForm({ ...confeitariaForm, logo_url: '' })}
                                className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="h-24 w-24 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50">
                              <Upload className="w-6 h-6 text-gray-400" />
                            </div>
                          )}
                          <div>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleLogoUpload}
                              className="hidden"
                              id="logo-upload"
                              disabled={uploadingLogo}
                            />
                            <label htmlFor="logo-upload">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={uploadingLogo}
                                onClick={() => document.getElementById('logo-upload').click()}
                              >
                                <Upload className="w-4 h-4 mr-2" />
                                {uploadingLogo ? 'Enviando...' : 'Escolher Imagem'}
                              </Button>
                            </label>
                          </div>
                        </div>
                      </div>
                      <div>
                        <Label>Cor Principal</Label>
                        <div className="flex gap-2 mt-2">
                          <Input
                            type="color"
                            value={confeitariaForm.cor_principal || '#ec4899'}
                            onChange={(e) => setConfeitariaForm({ ...confeitariaForm, cor_principal: e.target.value })}
                            className="w-20 h-11"
                          />
                          <Input
                            value={confeitariaForm.cor_principal || '#ec4899'}
                            onChange={(e) => setConfeitariaForm({ ...confeitariaForm, cor_principal: e.target.value })}
                            placeholder="#ec4899"
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          Esta cor será usada nos botões e destaques do catálogo
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <h4 className="font-semibold text-gray-900 mb-4">Notificações</h4>
                    <div className="flex items-start justify-between p-4 bg-gray-50 rounded-xl">
                      <div className="flex-1">
                        <Label className="text-base font-medium text-gray-900">
                          Receber pedidos via WhatsApp
                        </Label>
                        <p className="text-sm text-gray-500 mt-1">
                          Quando ativado, os clientes poderão enviar os detalhes do pedido diretamente para seu WhatsApp após finalizar no catálogo
                        </p>
                      </div>
                      <Switch
                        checked={confeitariaForm.receber_pedidos_whatsapp}
                        onCheckedChange={(checked) => setConfeitariaForm({ ...confeitariaForm, receber_pedidos_whatsapp: checked })}
                        className="ml-4"
                      />
                    </div>
                    {confeitariaForm.receber_pedidos_whatsapp && !confeitariaForm.telefone && (
                      <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                        <div className="text-amber-600 text-sm">
                          ⚠️ Configure seu telefone/WhatsApp na aba <strong>Geral</strong> para receber os pedidos
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="personalizacao" className="space-y-6 mt-0">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-4">Pedido Personalizado</h4>
                    <div className="space-y-4">
                      <div className="flex items-start justify-between p-4 bg-gray-50 rounded-xl">
                        <div className="flex-1">
                          <Label className="text-base font-medium text-gray-900">
                            Exibir pedido personalizado no catálogo
                          </Label>
                          <p className="text-sm text-gray-500 mt-1">
                            Mostra a opção de montar bolo personalizado no catálogo público
                          </p>
                        </div>
                        <Switch
                          checked={confeitariaForm.exibir_pedido_personalizado}
                          onCheckedChange={(checked) => setConfeitariaForm({ ...confeitariaForm, exibir_pedido_personalizado: checked })}
                          className="ml-4"
                        />
                      </div>
                      {confeitariaForm.exibir_pedido_personalizado && (
                        <div className="space-y-4">
                          <div>
                            <Label>Frase do Pedido Personalizado</Label>
                            <Input
                              value={confeitariaForm.frase_pedido_personalizado}
                              onChange={(e) => setConfeitariaForm({ ...confeitariaForm, frase_pedido_personalizado: e.target.value })}
                              placeholder="Monte seu Bolo Personalizado"
                            />
                            <p className="text-xs text-gray-500 mt-2">
                              Esta frase será exibida no botão de pedido personalizado no catálogo
                            </p>
                          </div>
                          <div>
                            <Label>Limite de pedidos personalizados por dia</Label>
                            <Input
                              type="number"
                              min="1"
                              className="mt-1"
                              value={confeitariaForm.limite_pedidos_personalizados_diarios}
                              onChange={(e) => setConfeitariaForm({
                                ...confeitariaForm,
                                limite_pedidos_personalizados_diarios: e.target.value,
                              })}
                              placeholder="Sem limite"
                            />
                            <p className="text-xs text-gray-500 mt-2">
                              Quando o limite for atingido, o cliente não poderá escolher aquela data no catálogo. Deixe em branco para sem limite.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <h4 className="font-semibold text-gray-900 mb-4">Complementos</h4>
                    <div className="space-y-2">
                      <Label>Limite de complementos por produto</Label>
                      <Input
                        type="number"
                        min={1}
                        max={20}
                        className="max-w-xs"
                        value={confeitariaForm.max_complementos_produto}
                        onChange={(e) => {
                          const val = Math.min(20, Math.max(1, parseInt(e.target.value) || 4));
                          setConfeitariaForm({ ...confeitariaForm, max_complementos_produto: val });
                        }}
                      />
                      <p className="text-xs text-gray-500">
                        Limite de quantos complementos podem ser adicionados ao produto pelo cliente no catálogo. Padrão: 4.
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <h4 className="font-semibold text-gray-900 mb-2">Ordem e Visibilidade das Etapas</h4>
                    <p className="text-sm text-gray-500 mb-6">
                      Configure quais etapas serão exibidas aos seus clientes e em qual ordem elas devem aparecer.
                    </p>

                    <div className="space-y-3">
                      {confeitariaForm.etapas_pedido?.map((etapa, index) => (
                        <div
                          key={etapa.key}
                          className={`flex items-center justify-between p-4 rounded-xl border transition-all ${etapa.ativo === false ? 'bg-gray-50 opacity-60' : 'bg-white shadow-sm border-gray-100'
                            }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className="flex flex-col gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                disabled={index === 0}
                                onClick={() => {
                                  const novasEtapas = [...confeitariaForm.etapas_pedido];
                                  [novasEtapas[index - 1], novasEtapas[index]] = [novasEtapas[index], novasEtapas[index - 1]];
                                  setConfeitariaForm({ ...confeitariaForm, etapas_pedido: novasEtapas });
                                }}
                              >
                                <ArrowUp className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                disabled={index === confeitariaForm.etapas_pedido.length - 1}
                                onClick={() => {
                                  const novasEtapas = [...confeitariaForm.etapas_pedido];
                                  [novasEtapas[index], novasEtapas[index + 1]] = [novasEtapas[index + 1], novasEtapas[index]];
                                  setConfeitariaForm({ ...confeitariaForm, etapas_pedido: novasEtapas });
                                }}
                              >
                                <ArrowDown className="w-4 h-4" />
                              </Button>
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">{etapa.label}</p>
                              <p className="text-xs text-gray-500 capitalize">{etapa.key.replace('_', ' ')}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-xs font-medium text-gray-400">
                              {etapa.ativo === false ? 'Oculta' : 'Visível'}
                            </span>
                            <Switch
                              checked={etapa.ativo !== false}
                              onCheckedChange={(checked) => {
                                const novasEtapas = confeitariaForm.etapas_pedido.map((e, idx) =>
                                  idx === index ? { ...e, ativo: checked } : e
                                );
                                setConfeitariaForm({ ...confeitariaForm, etapas_pedido: novasEtapas });
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="pagamentos" className="space-y-4 mt-0">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-gray-900">Formas de Pagamento</h4>
                    <Button onClick={() => openItemForm('FormaPagamento')} className="bg-rose-500 hover:bg-rose-600">
                      <Plus className="w-4 h-4 mr-2" />
                      Nova Forma
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {formasPagamento.length === 0 ? (
                      <p className="text-center text-gray-500 py-8">Nenhuma forma de pagamento cadastrada</p>
                    ) : (
                      formasPagamento.map((item) => (
                        <ItemCard key={item.id} item={item} icon={Store} />
                      ))
                    )}
                  </div>
                </TabsContent>
              </Tabs>
              <Button
                onClick={() => updateConfeitaria.mutate()}
                disabled={updateConfeitaria.isPending || !confeitaria?.id}
                className="bg-rose-500 hover:bg-rose-600 mt-6"
              >
                <Save className="w-4 h-4 mr-2" />
                {updateConfeitaria.isPending ? 'Salvando...' : 'Salvar Configurações'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pedidos */}
        <TabsContent value="pedidos" className="mt-6">
          <Card className="border-0 shadow-lg shadow-gray-100/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-rose-500" />
                Configurações de Pedidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="ajustes" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6 bg-rose-50/50 p-1">
                  <TabsTrigger value="ajustes" className="data-[state=active]:bg-white data-[state=active]:text-rose-600 data-[state=active]:shadow-sm">Ajustes</TabsTrigger>
                  <TabsTrigger value="mensagens" className="data-[state=active]:bg-white data-[state=active]:text-rose-600 data-[state=active]:shadow-sm">Mensagens</TabsTrigger>
                </TabsList>

                {/* Ajustes */}
                <TabsContent value="ajustes" className="space-y-6 mt-0">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between p-4 bg-gray-50 rounded-xl">
                      <div className="flex items-start gap-3">
                        <Truck className="w-5 h-5 text-gray-500 mt-0.5" />
                        <div>
                          <p className="font-medium text-gray-900">Habilitar Delivery</p>
                          <p className="text-sm text-gray-500 mt-0.5">
                            Permite receber pedidos com entrega. Se desativado, apenas retirada estará disponível.
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={confeitariaForm.delivery_ativo}
                        onCheckedChange={(v) => setConfeitariaForm({ ...confeitariaForm, delivery_ativo: v })}
                        className="ml-4 shrink-0"
                      />
                    </div>

                    {confeitariaForm.delivery_ativo && (
                      <div className="space-y-4">
                        <div>
                          <Label>Taxa de Delivery</Label>
                          <MoedaInput
                            value={confeitariaForm.taxa_delivery?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || ''}
                            onChange={(e) => {
                              const valor = parseFloat(e.target.value.replace(/\./g, '').replace(',', '.')) || 0;
                              setConfeitariaForm({ ...confeitariaForm, taxa_delivery: valor });
                            }}
                            placeholder="0,00"
                            className="mt-1"
                          />
                          <p className="text-xs text-gray-500 mt-1">Valor cobrado por pedidos com entrega</p>
                        </div>

                        <div className="space-y-2">
                          <p className="text-sm font-medium text-gray-700">Onde o delivery está disponível:</p>

                          {[
                            { key: 'delivery_catalogo_pronto',        label: 'Catálogo — Produtos Prontos',        desc: 'Delivery disponível no catálogo público para produtos prontos' },
                            { key: 'delivery_catalogo_personalizado', label: 'Catálogo — Produtos Personalizados', desc: 'Delivery disponível no catálogo público para produtos personalizados' },
                            { key: 'delivery_interno_pronto',         label: 'Pedido Interno — Produtos Prontos',  desc: 'Delivery disponível ao criar pedido interno de produto pronto' },
                            { key: 'delivery_interno_personalizado',  label: 'Pedido Interno — Personalizado',     desc: 'Delivery disponível ao criar pedido interno personalizado' },
                          ].map(({ key, label, desc }) => (
                            <div key={key} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                              <div>
                                <p className="text-sm font-medium text-gray-800">{label}</p>
                                <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                              </div>
                              <Switch
                                checked={confeitariaForm[key] !== false}
                                onCheckedChange={(v) => setConfeitariaForm({ ...confeitariaForm, [key]: v })}
                                className="ml-4 shrink-0"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t">
                    <Button
                      onClick={() => updateConfeitaria.mutate()}
                      disabled={updateConfeitaria.isPending || !confeitaria?.id}
                      className="bg-rose-500 hover:bg-rose-600"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {updateConfeitaria.isPending ? 'Salvando...' : 'Salvar Alterações'}
                    </Button>
                  </div>
                </TabsContent>

                {/* Mensagens */}
                <TabsContent value="mensagens" className="space-y-6 mt-0">
                  {(() => {
                    const VARS = [
                      { value: '{nome_cliente}', label: 'Nome do cliente' },
                      { value: '{numero}', label: 'Número do pedido' },
                      { value: '{status}', label: 'Status do pedido' },
                      { value: '{total}', label: 'Valor total' },
                      { value: '{data_entrega}', label: 'Data de entrega' },
                      { value: '{forma_pagamento}', label: 'Forma de pagamento' },
                      { value: '{tipo_entrega}', label: 'Tipo de entrega' },
                      { value: '{nome_confeitaria}', label: 'Nome da confeitaria' },
                    ];

                    const insertVar = (varValue) => {
                      const active = document.activeElement;
                      if (active && active.tagName === 'TEXTAREA' && active.dataset.msgKey) {
                        const key = active.dataset.msgKey;
                        const start = active.selectionStart;
                        const end = active.selectionEnd;
                        const text = confeitariaForm[key] || '';
                        const newText = text.slice(0, start) + varValue + text.slice(end);
                        setConfeitariaForm({ ...confeitariaForm, [key]: newText });
                        setTimeout(() => {
                          active.focus();
                          active.setSelectionRange(start + varValue.length, start + varValue.length);
                        }, 0);
                      }
                    };

                    return (
                      <div className="space-y-5">
                        <div className="flex items-start gap-2">
                          <MessageSquare className="w-4 h-4 text-rose-500 mt-0.5" />
                          <div>
                            <p className="font-semibold text-gray-900">Mensagem de WhatsApp</p>
                            <p className="text-sm text-gray-500">Essa mensagem é enviada ao clicar em "Enviar confirmação" em qualquer pedido. Use variáveis para personalizar com os dados do pedido.</p>
                          </div>
                        </div>

                        {/* Variable chips */}
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-gray-600">Variáveis disponíveis — clique para inserir no cursor:</p>
                          <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-xl">
                            {VARS.map((v) => (
                              <button
                                key={v.value}
                                type="button"
                                onClick={() => insertVar(v.value)}
                                title={v.label}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 transition-colors"
                              >
                                <span className="font-mono">{v.value}</span>
                                <span className="text-rose-400">— {v.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Single message editor */}
                        <div className="space-y-2">
                          <Textarea
                            data-msg-key="mensagem_confirmacao_pedido"
                            value={confeitariaForm.mensagem_confirmacao_pedido}
                            onChange={(e) => setConfeitariaForm({ ...confeitariaForm, mensagem_confirmacao_pedido: e.target.value })}
                            placeholder={`Olá {nome_cliente}!\nSeu pedido *#{numero}* está com status *{status}*.\nEntrega: {data_entrega}\nTotal: R$ {total}\nObrigada pela preferência!`}
                            className="min-h-[160px] font-mono text-sm"
                          />
                          <p className="text-xs text-gray-400">Deixe em branco para usar a mensagem padrão do sistema.</p>
                        </div>

                        <div className="pt-4 border-t">
                          <Button
                            onClick={() => updateConfeitaria.mutate()}
                            disabled={updateConfeitaria.isPending || !confeitaria?.id}
                            className="bg-rose-500 hover:bg-rose-600"
                          >
                            <Save className="w-4 h-4 mr-2" />
                            {updateConfeitaria.isPending ? 'Salvando...' : 'Salvar Mensagem'}
                          </Button>
                        </div>
                      </div>
                    );
                  })()}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      {/* Item Form Dialog */}
      <Dialog open={showItemForm} onOpenChange={closeItemForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Editar' : 'Nova'} Forma de Pagamento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {renderItemFormFields()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeItemForm}>
              Cancelar
            </Button>
            <Button
              onClick={() => saveItem.mutate({
                type: itemType,
                data: itemType === 'FormaPagamento' ? normalizeFormaPagamento(itemForm) : itemForm,
                id: editingItem?.id,
              })}
              disabled={
                !itemForm.nome ||
                (itemType === 'FormaPagamento' && !normalizeFormaPagamento(itemForm).a_vista && !(Number(itemForm.parcelamento_max) >= 1)) ||
                ((itemType === 'doce' || itemType === 'salgado') && !itemForm.valor_unitario) ||
                saveItem.isPending
              }
              className="bg-rose-500 hover:bg-rose-600"
            >
              {saveItem.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog >
    </div >
  );
}
