import React, { useState, useEffect } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';
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
  Check,
  AlertCircle,
  Plus,
  Search
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

const steps = [
  { id: 1, title: 'Cliente', icon: User },
  { id: 2, title: 'Tamanho', icon: Cake },
  { id: 3, title: 'Massa', icon: Layers },
  { id: 4, title: 'Recheios', icon: Cookie },
  { id: 5, title: 'Cobertura', icon: Sparkles },
  { id: 6, title: 'Extras', icon: Sparkles },
  { id: 7, title: 'Entrega', icon: Calendar },
  { id: 8, title: 'Resumo', icon: Check },
];

export default function NovoPedido() {
  const { user } = useAuth();
  const [confeitaria, setConfeitaria] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [showNewClientDialog, setShowNewClientDialog] = useState(false);
  const [clienteSearch, setClienteSearch] = useState('');
  const queryClient = useQueryClient();

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
    data_entrega: '',
    horario_entrega: '',
    observacoes: '',
    valor_tamanho: 0,
    valor_massa: 0,
    valor_recheios: 0,
    valor_cobertura: 0,
    valor_extras: 0,
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

  // Mutations
  const createClientMutation = useMutation({
    mutationFn: (data) => appClient.entities.Cliente.create({
      ...data,
      confeitaria_id: user.confeitaria_id,
    }),
    onSuccess: (client) => {
      queryClient.invalidateQueries(['clientes']);
      setPedido({
        ...pedido,
        cliente_id: client.id,
        cliente_nome: client.nome,
        cliente_telefone: client.telefone,
      });
      setShowNewClientDialog(false);
      setNewClient({ nome: '', telefone: '', email: '' });
    },
  });

  const createPedidoMutation = useMutation({
    mutationFn: async () => {
      // Buscar todos os pedidos da confeitaria para determinar o próximo número
      const todosPedidos = await appClient.entities.Pedido.filter({ confeitaria_id: user.confeitaria_id });
      
      // Encontrar o maior número de pedido existente (apenas números puros, ignorar formatos antigos)
      let proximoNumero = 1;
      if (todosPedidos.length > 0) {
        const numeros = todosPedidos
          .filter(p => p.numero && /^\d+$/.test(p.numero)) // Apenas números puros
          .map(p => parseInt(p.numero))
          .filter(n => !isNaN(n));
        
        if (numeros.length > 0) {
          const maiorNumero = Math.max(...numeros);
          proximoNumero = maiorNumero + 1;
        }
      }
      
      return appClient.entities.Pedido.create({
        ...pedido,
        confeitaria_id: user.confeitaria_id,
        numero: proximoNumero.toString(),
        status: 'orcamento',
        tipo: 'personalizado',
      });
    },
    onSuccess: () => {
      window.location.href = createPageUrl('Pedidos');
    },
  });

  // Calculate totals
  useEffect(() => {
    const valorRecheios = pedido.recheios.reduce((acc, r) => acc + (r.valor || 0), 0);
    const valorExtras = pedido.extras.reduce((acc, e) => acc + (e.valor || 0), 0);

    let valorUrgencia = 0;
    if (pedido.data_entrega && confeitaria?.prazo_minimo_dias && confeitaria?.habilitar_taxa_urgencia !== false) {
      const dias = differenceInDays(parseISO(pedido.data_entrega), new Date());
      if (dias < confeitaria.prazo_minimo_dias && dias >= 0) {
        const subtotal = pedido.valor_tamanho + pedido.valor_massa + valorRecheios + pedido.valor_cobertura + valorExtras;
        valorUrgencia = subtotal * ((confeitaria.taxa_urgencia_percentual || 20) / 100);
      }
    }

    const total = pedido.valor_tamanho + pedido.valor_massa + valorRecheios + pedido.valor_cobertura + valorExtras + valorUrgencia;

    setPedido(prev => ({
      ...prev,
      valor_recheios: valorRecheios,
      valor_extras: valorExtras,
      valor_urgencia: valorUrgencia,
      valor_total: total,
    }));
  }, [pedido.valor_tamanho, pedido.valor_massa, pedido.recheios, pedido.valor_cobertura, pedido.extras, pedido.data_entrega, confeitaria]);

  const selectedTamanho = tamanhos.find(t => t.id === pedido.tamanho_id);
  const maxRecheios = selectedTamanho?.max_recheios || 2;

  const filteredClientes = clientes.filter(c =>
    c.nome?.toLowerCase().includes(clienteSearch.toLowerCase()) ||
    c.telefone?.includes(clienteSearch)
  );

  const canProceed = () => {
    switch (currentStep) {
      case 1: return pedido.cliente_nome && pedido.cliente_telefone;
      case 2: return pedido.tamanho_id;
      case 3: return pedido.massa_id;
      case 4: return pedido.recheios.length > 0;
      case 5: return pedido.cobertura_id;
      case 6: return true;
      case 7: return pedido.data_entrega;
      default: return true;
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <Link to={createPageUrl('Pedidos')}>
            <Button variant="ghost" size="sm">
              <ChevronLeft className="w-4 h-4 mr-1" />
              Voltar
            </Button>
          </Link>
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
            {steps[currentStep - 1].title}
          </h2>
        </div>
      </div>

      {/* Step Content */}
      <Card className="border-0 shadow-xl shadow-gray-100/50 mb-6">
        <CardContent className="p-6">
          {/* Step 1: Cliente */}
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

          {/* Step 2: Tamanho */}
          {currentStep === 2 && (
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
          {currentStep === 3 && (
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
          {currentStep === 4 && (
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
          {currentStep === 5 && (
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
          {currentStep === 6 && (
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

          {/* Step 7: Entrega */}
          {currentStep === 7 && (
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

          {/* Step 8: Resumo */}
          {currentStep === 8 && (
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

                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-500">Entrega</p>
                  <p className="font-semibold text-gray-900">
                    {pedido.data_entrega && format(parseISO(pedido.data_entrega), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    {pedido.horario_entrega && ` às ${pedido.horario_entrega}`}
                  </p>
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
            {createPedidoMutation.isPending ? 'Criando...' : 'Criar Pedido'}
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
    </div>
  );
}
