import React, { useState } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Package,
  Pencil,
  Trash2,
  Search,
  Image as ImageIcon,
  Puzzle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import FormProductoModal from '@/components/produtos/FormProductoModal';

const DEFAULT_CATEGORIAS = [
  { value: 'bolo', label: 'Bolo' },
  { value: 'doce', label: 'Doce' },
  { value: 'salgado', label: 'Salgado' },
  { value: 'bebida', label: 'Bebida' },
  { value: 'outro', label: 'Outro' },
];

export default function ProdutosProntosTab({ user }) {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingProduto, setEditingProduto] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [produtoToDelete, setProdutoToDelete] = useState(null);
  const queryClient = useQueryClient();

  const { data: confeitaria } = useQuery({
    queryKey: ['confeitaria', user?.confeitaria_id],
    queryFn: async () => {
      const list = await appClient.entities.Confeitaria.filter({ id: user.confeitaria_id });
      return list[0] || null;
    },
    enabled: !!user?.confeitaria_id,
  });

  const maxComplementos = Math.min(10, Math.max(1, confeitaria?.max_complementos_produto || 4));
  const categorias = Array.isArray(confeitaria?.categorias_produto) && confeitaria.categorias_produto.length > 0
    ? confeitaria.categorias_produto
    : DEFAULT_CATEGORIAS;

  const { data: produtos = [], isLoading } = useQuery({
    queryKey: ['produtos', user?.confeitaria_id],
    queryFn: () => appClient.entities.Produto.filter({ confeitaria_id: user.confeitaria_id }),
    enabled: !!user?.confeitaria_id,
  });

  const saveMutation = useMutation({
    mutationFn: (data) => {
      const payload = { ...data, preco: parseFloat(data.preco) || 0 };
      if (editingProduto) {
        return appClient.entities.Produto.update(editingProduto.id, payload);
      }
      return appClient.entities.Produto.create({
        ...payload,
        confeitaria_id: user.confeitaria_id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      toast({
        title: editingProduto ? 'Produto atualizado' : 'Produto criado',
        description: 'As informações do produto foram salvas com sucesso.',
      });
      closeForm();
    },
    onError: (error) => {
      toast({
        title: 'Erro ao salvar produto',
        description: error?.message || 'Não foi possível salvar o produto.',
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (produto) => {
      if (produto.foto_url) {
        try {
          await appClient.integrations.Core.DeleteFile({ fileUrl: produto.foto_url });
        } catch (e) {
          console.warn('Não foi possível apagar a imagem do storage:', e);
        }
      }
      return appClient.entities.Produto.delete(produto.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      setShowDeleteDialog(false);
      setProdutoToDelete(null);
    },
  });

  const toggleDisponivel = useMutation({
    mutationFn: ({ id, disponivel }) => appClient.entities.Produto.update(id, { disponivel }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['produtos'] }),
  });

  const openForm = (produto = null) => {
    setEditingProduto(produto);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingProduto(null);
  };

  const filteredProdutos = produtos.filter((p) =>
    p.nome?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar produto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11 border-gray-200"
          />
        </div>
        <Button
          onClick={() => openForm()}
          className="h-11 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 shadow-lg shadow-rose-200"
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo Produto
        </Button>
      </div>

      {/* Grid de Produtos */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Carregando...</div>
      ) : filteredProdutos.length === 0 ? (
        <Card className="border-0 shadow-lg shadow-gray-100/50">
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500 mb-4">Nenhum produto cadastrado</p>
            <Button onClick={() => openForm()} className="bg-rose-500 hover:bg-rose-600">
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Produto
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {/* Cabeçalho — apenas desktop */}
          <div className="hidden md:grid grid-cols-[3rem_1fr_8rem_7rem_6rem_5rem] gap-4 items-center px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide border-b">
            <span></span>
            <span>Produto</span>
            <span>Preço</span>
            <span>Categoria</span>
            <span>Disponível</span>
            <span className="text-right">Ações</span>
          </div>

          {filteredProdutos.map((produto) => (
            <Card
              key={produto.id}
              className={`border-0 shadow-sm shadow-gray-100/50 transition-opacity ${
                !produto.disponivel ? 'opacity-60' : ''
              }`}
            >
              <CardContent className="p-0">
                {/* Layout desktop: linha */}
                <div className="hidden md:grid grid-cols-[3rem_1fr_8rem_7rem_6rem_5rem] gap-4 items-center px-4 py-3">
                  {/* Foto */}
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                    {produto.foto_url ? (
                      <img src={produto.foto_url} alt={produto.nome} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-5 h-5 text-gray-300" />
                      </div>
                    )}
                  </div>

                  {/* Nome + descrição + badges */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm">{produto.nome}</span>
                      {produto.complementos?.length > 0 && (
                        <Badge className="bg-rose-100 text-rose-600 border-0 gap-1 text-xs px-1.5 py-0">
                          <Puzzle className="w-3 h-3" />
                          {produto.complementos.length} compl.
                        </Badge>
                      )}
                    </div>
                    {produto.descricao && (
                      <p className="text-xs text-gray-400 truncate mt-0.5">{produto.descricao}</p>
                    )}
                  </div>

                  {/* Preço */}
                  <span className="font-bold text-rose-600 text-sm">
                    R$ {produto.preco?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>

                  {/* Categoria */}
                  <span className="text-sm text-gray-500">
                    {categorias.find((c) => c.value === produto.categoria)?.label || '—'}
                  </span>

                  {/* Disponível */}
                  <Switch
                    checked={produto.disponivel !== false}
                    onCheckedChange={(checked) =>
                      toggleDisponivel.mutate({ id: produto.id, disponivel: checked })
                    }
                  />

                  {/* Ações */}
                  <div className="flex gap-1 justify-end">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openForm(produto)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-red-500 hover:bg-red-50"
                      onClick={() => { setProdutoToDelete(produto); setShowDeleteDialog(true); }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Layout mobile: card compacto */}
                <div className="flex md:hidden items-center gap-3 p-3">
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                    {produto.foto_url ? (
                      <img src={produto.foto_url} alt={produto.nome} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-6 h-6 text-gray-300" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm">{produto.nome}</span>
                      {produto.complementos?.length > 0 && (
                        <Badge className="bg-rose-100 text-rose-600 border-0 gap-1 text-xs px-1.5 py-0">
                          <Puzzle className="w-3 h-3" />
                          {produto.complementos.length}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-sm font-bold text-rose-600">
                        R$ {produto.preco?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-xs text-gray-400">
                        {categorias.find((c) => c.value === produto.categoria)?.label}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Switch
                      checked={produto.disponivel !== false}
                      onCheckedChange={(checked) =>
                        toggleDisponivel.mutate({ id: produto.id, disponivel: checked })
                      }
                    />
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openForm(produto)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-red-500 hover:bg-red-50"
                      onClick={() => { setProdutoToDelete(produto); setShowDeleteDialog(true); }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Form */}
      <FormProductoModal
        open={showForm}
        onOpenChange={(val) => { if (!val) closeForm(); else setShowForm(true); }}
        editingProduto={editingProduto}
        onSave={(data) => saveMutation.mutate(data)}
        isSaving={saveMutation.isPending}
        maxComplementos={maxComplementos}
        categorias={categorias}
      />

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Produto</DialogTitle>
          </DialogHeader>
          <p className="text-gray-600">
            Tem certeza que deseja excluir <strong>{produtoToDelete?.nome}</strong>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate(produtoToDelete)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
