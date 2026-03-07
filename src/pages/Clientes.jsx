import React, { useEffect, useState } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';
import {
  Search,
  Plus,
  User,
  Phone,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Trash2,
  ShoppingBag,
  Cake
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CPFInput, TelefoneInput } from '@/components/ui/masked-input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { syncClientToBrevo } from '@/lib/brevoClientSync';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export default function Clientes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingCliente, setEditingCliente] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [clienteToDelete, setClienteToDelete] = useState(null);
  const [selectedCliente, setSelectedCliente] = useState(null);
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    nome: '',
    cpf: '',
    telefone: '',
    email: '',
    endereco: '',
    bairro: '',
    cidade: '',
    observacoes: '',
  });

  useEffect(() => {
    if (user && !user.confeitaria_id) {
      window.location.href = createPageUrl('Onboarding');
    }
  }, [user]);

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ['clientes', user?.confeitaria_id],
    queryFn: () => appClient.entities.Cliente.filter({ confeitaria_id: user.confeitaria_id }, '-created_date'),
    enabled: !!user?.confeitaria_id,
  });

  const { data: pedidos = [] } = useQuery({
    queryKey: ['pedidos', user?.confeitaria_id],
    queryFn: () => appClient.entities.Pedido.filter({ confeitaria_id: user.confeitaria_id }),
    enabled: !!user?.confeitaria_id,
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const payload = {
        nome: data.nome?.trim() || '',
        cpf: data.cpf || '',
        telefone: data.telefone || '',
        email: data.email?.trim() || '',
        endereco: data.endereco || '',
        bairro: data.bairro || '',
        cidade: data.cidade || '',
        observacoes: data.observacoes || '',
      };

      const persistAndSync = async (clientePromise, syncPayload) => {
        const cliente = await clientePromise;
        const brevoResult = await syncClientToBrevo(syncPayload(cliente));
        return { cliente, brevoSynced: brevoResult.success };
      };

      try {
        if (editingCliente) {
          return persistAndSync(
            appClient.entities.Cliente.update(editingCliente.id, payload),
            (cliente) => ({
              cliente_id: cliente.id,
              confeitaria_id: user.confeitaria_id,
              nome: cliente.nome,
              telefone: cliente.telefone,
              email: cliente.email
            })
          );
        }

        return persistAndSync(
          appClient.entities.Cliente.create({
            ...payload,
            confeitaria_id: user.confeitaria_id,
          }),
          (cliente) => ({
            cliente_id: cliente.id,
            confeitaria_id: user.confeitaria_id,
            nome: cliente.nome,
            telefone: cliente.telefone,
            email: cliente.email
          })
        );
      } catch (error) {
        const message = String(error?.message || '').toLowerCase();
        const shouldRetryWithProfileSync =
          Number(error?.status) === 401 ||
          Number(error?.status) === 403 ||
          message.includes('rls') ||
          message.includes('row-level security') ||
          message.includes('policy');

        if (shouldRetryWithProfileSync && user?.confeitaria_id) {
          await appClient.auth.updateMe({ confeitaria_id: user.confeitaria_id });

          if (editingCliente) {
            return persistAndSync(
              appClient.entities.Cliente.update(editingCliente.id, payload),
              (cliente) => ({
                cliente_id: cliente.id,
                confeitaria_id: user.confeitaria_id,
                nome: cliente.nome,
                telefone: cliente.telefone,
                email: cliente.email
              })
            );
          }

          return persistAndSync(
            appClient.entities.Cliente.create({
              ...payload,
              confeitaria_id: user.confeitaria_id,
            }),
            (cliente) => ({
              cliente_id: cliente.id,
              confeitaria_id: user.confeitaria_id,
              nome: cliente.nome,
              telefone: cliente.telefone,
              email: cliente.email
            })
          );
        }

        throw error;
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['clientes', user?.confeitaria_id] });
      toast({
        title: editingCliente ? 'Cliente atualizado' : 'Cliente criado',
        description:
          result?.brevoSynced === false
            ? 'Dados salvos, mas o contato não foi sincronizado com o Brevo.'
            : 'Dados do cliente salvos com sucesso.',
        duration: 2500
      });
      closeForm();
    },
    onError: (error) => {
      toast({
        title: 'Erro ao salvar cliente',
        description: error?.message || 'Não foi possível salvar o cliente.',
        variant: 'destructive'
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => appClient.entities.Cliente.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      setShowDeleteDialog(false);
      setClienteToDelete(null);
    },
  });

  const closeForm = () => {
    setShowForm(false);
    setEditingCliente(null);
    setFormData({
      nome: '',
      cpf: '',
      telefone: '',
      email: '',
      endereco: '',
      bairro: '',
      cidade: '',
      observacoes: '',
    });
  };

  const openEditForm = (cliente) => {
    setEditingCliente(cliente);
    setFormData({
      nome: cliente.nome || '',
      cpf: cliente.cpf || '',
      telefone: cliente.telefone || '',
      email: cliente.email || '',
      endereco: cliente.endereco || '',
      bairro: cliente.bairro || '',
      cidade: cliente.cidade || '',
      observacoes: cliente.observacoes || '',
    });
    setShowForm(true);
  };

  const filteredClientes = clientes.filter(c =>
    c.nome?.toLowerCase().includes(search.toLowerCase()) ||
    c.telefone?.includes(search) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  const getClientePedidos = (clienteId) => {
    return pedidos.filter(p => p.cliente_id === clienteId);
  };

  const handleWhatsApp = (telefone) => {
    const phone = telefone?.replace(/\D/g, '');
    window.open(`https://wa.me/55${phone}`, '_blank');
  };

  const handleNovoPedido = (cliente) => {
    window.location.href = `${createPageUrl('NovoPedido')}?clienteId=${cliente.id}`;
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar por nome, telefone ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11 border-gray-200"
          />
        </div>
        <Button
          onClick={() => setShowForm(true)}
          className="h-11 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 shadow-lg shadow-rose-200"
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo Cliente
        </Button>
      </div>

      {/* Clientes Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Carregando...</div>
      ) : filteredClientes.length === 0 ? (
        <Card className="border-0 shadow-lg shadow-gray-100/50">
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <User className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500 mb-4">Nenhum cliente encontrado</p>
            <Button onClick={() => setShowForm(true)} className="bg-rose-500 hover:bg-rose-600">
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Cliente
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredClientes.map((cliente) => {
            const clientePedidos = getClientePedidos(cliente.id);
            const totalGasto = clientePedidos.reduce((acc, p) => acc + (p.valor_total || 0), 0);

            return (
              <Card
                key={cliente.id}
                className="border-0 shadow-lg shadow-gray-100/50 hover:shadow-xl transition-shadow cursor-pointer group"
                onClick={() => setSelectedCliente(cliente)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-100 to-rose-200 flex items-center justify-center">
                        <span className="text-lg font-bold text-rose-600">
                          {cliente.nome?.[0]?.toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 group-hover:text-rose-600 transition-colors">
                          {cliente.nome}
                        </h3>
                        {clientePedidos.length > 0 && (
                          <Badge variant="secondary" className="mt-1">
                            {clientePedidos.length} pedido(s)
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    {cliente.telefone && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Phone className="w-3.5 h-3.5" />
                        {cliente.telefone}
                      </div>
                    )}
                    {cliente.email && (
                      <div className="flex items-center gap-2 text-gray-600 truncate">
                        <Mail className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{cliente.email}</span>
                      </div>
                    )}
                    {cliente.bairro && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <MapPin className="w-3.5 h-3.5" />
                        {cliente.bairro}
                      </div>
                    )}
                  </div>

                  {totalGasto > 0 && (
                    <div className="mt-4 pt-4 border-t flex items-center justify-between">
                      <span className="text-sm text-gray-500">Total gasto</span>
                      <span className="font-semibold text-rose-600">
                        R$ {totalGasto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}

                  <div className="mt-4 flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 border-rose-200 text-rose-600 hover:bg-rose-50"
                      onClick={() => handleNovoPedido(cliente)}
                    >
                      <Cake className="w-4 h-4 mr-1" />
                      Novo Pedido
                    </Button>
                    {cliente.telefone && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-green-600 border-green-200 hover:bg-green-50"
                        onClick={() => handleWhatsApp(cliente.telefone)}
                      >
                        <MessageCircle className="w-4 h-4 mr-1" />
                        WhatsApp
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditForm(cliente)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => {
                        setClienteToDelete(cliente);
                        setShowDeleteDialog(true);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={closeForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingCliente ? 'Editar Cliente' : 'Novo Cliente'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Nome *</Label>
                <Input
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Nome completo"
                />
              </div>
              <div>
                <Label>CPF</Label>
                <CPFInput
                  value={formData.cpf}
                  onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                  placeholder="000.000.000-00"
                />
              </div>
              <div>
                <Label>Telefone *</Label>
                <TelefoneInput
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div className="col-span-2">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@exemplo.com"
                />
              </div>
              <div className="col-span-2">
                <Label>Endereço</Label>
                <Input
                  value={formData.endereco}
                  onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                  placeholder="Rua, número"
                />
              </div>
              <div>
                <Label>Bairro</Label>
                <Input
                  value={formData.bairro}
                  onChange={(e) => setFormData({ ...formData, bairro: e.target.value })}
                />
              </div>
              <div>
                <Label>Cidade</Label>
                <Input
                  value={formData.cidade}
                  onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <Label>Observações</Label>
                <Textarea
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Preferências, alergias, datas importantes..."
                  className="min-h-[80px]"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeForm}>
              Cancelar
            </Button>
            <Button
              onClick={() => saveMutation.mutate(formData)}
              disabled={!formData.nome || !formData.telefone || saveMutation.isPending}
              className="bg-rose-500 hover:bg-rose-600"
            >
              {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Cliente</DialogTitle>
          </DialogHeader>
          <p className="text-gray-600">
            Tem certeza que deseja excluir <strong>{clienteToDelete?.nome}</strong>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate(clienteToDelete?.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cliente Details Sheet */}
      {selectedCliente && (
        <Sheet open={true} onOpenChange={() => setSelectedCliente(null)}>
          <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
            <SheetHeader className="pb-4 border-b">
              <SheetTitle className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-100 to-rose-200 flex items-center justify-center">
                  <span className="text-lg font-bold text-rose-600">
                    {selectedCliente.nome?.[0]?.toUpperCase()}
                  </span>
                </div>
                {selectedCliente.nome}
              </SheetTitle>
            </SheetHeader>

            <div className="py-6 space-y-6">
              <div className="space-y-3">
                {selectedCliente.telefone && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-gray-600">
                      <Phone className="w-4 h-4" />
                      {selectedCliente.telefone}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-green-600 hover:bg-green-50"
                      onClick={() => handleWhatsApp(selectedCliente.telefone)}
                    >
                      <MessageCircle className="w-4 h-4 mr-1" />
                      WhatsApp
                    </Button>
                  </div>
                )}
                {selectedCliente.email && (
                  <div className="flex items-center gap-3 text-gray-600">
                    <Mail className="w-4 h-4" />
                    {selectedCliente.email}
                  </div>
                )}
                {(selectedCliente.endereco || selectedCliente.bairro) && (
                  <div className="flex items-center gap-3 text-gray-600">
                    <MapPin className="w-4 h-4" />
                    {[selectedCliente.endereco, selectedCliente.bairro, selectedCliente.cidade]
                      .filter(Boolean)
                      .join(', ')}
                  </div>
                )}
              </div>

              <Button
                variant="outline"
                className="w-full border-rose-200 text-rose-600 hover:bg-rose-50"
                onClick={() => handleNovoPedido(selectedCliente)}
              >
                <Cake className="w-4 h-4 mr-2" />
                Novo Pedido
              </Button>

              {selectedCliente.observacoes && (
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                  <p className="text-sm font-medium text-gray-700 mb-1">Observações</p>
                  <p className="text-gray-600">{selectedCliente.observacoes}</p>
                </div>
              )}

              {/* Histórico de Pedidos */}
              <div>
                <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
                  <ShoppingBag className="w-4 h-4 text-rose-500" />
                  Histórico de Pedidos
                </h3>
                {getClientePedidos(selectedCliente.id).length === 0 ? (
                  <p className="text-gray-500 text-sm">Nenhum pedido ainda</p>
                ) : (
                  <div className="space-y-2">
                    {getClientePedidos(selectedCliente.id).map((pedido) => (
                      <div
                        key={pedido.id}
                        className="p-3 bg-gray-50 rounded-xl"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">#{pedido.numero || pedido.id?.slice(-4)}</span>
                          <span className="font-semibold text-rose-600">
                            R$ {pedido.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        
                        {pedido.tipo === 'personalizado' ? (
                          <p className="text-sm text-gray-500">
                            {pedido.tamanho_nome && pedido.massa_nome 
                              ? `${pedido.tamanho_nome} • ${pedido.massa_nome}` 
                              : 'Pedido Personalizado'}
                          </p>
                        ) : (
                          <div className="text-sm text-gray-500">
                            {pedido.produtos_catalogo?.length > 0 ? (
                              <div className="space-y-0.5">
                                {pedido.produtos_catalogo.map((produto, idx) => (
                                  <div key={idx}>
                                    {produto.quantidade}x {produto.nome}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p>Produto do Catálogo</p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
