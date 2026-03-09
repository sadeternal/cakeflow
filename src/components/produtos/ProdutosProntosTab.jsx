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

const categorias = [
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
    mutationFn: (id) => appClient.entities.Produto.delete(id),
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredProdutos.map((produto) => (
            <Card
              key={produto.id}
              className={`border-0 shadow-lg shadow-gray-100/50 overflow-hidden transition-opacity ${
                !produto.disponivel ? 'opacity-60' : ''
              }`}
            >
              <div className="aspect-square relative bg-gray-100">
                {produto.foto_url ? (
                  <img
                    src={produto.foto_url}
                    alt={produto.nome}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-12 h-12 text-gray-300" />
                  </div>
                )}
                {!produto.disponivel && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Badge variant="secondary" className="bg-white/90">
                      Indisponível
                    </Badge>
                  </div>
                )}
                <Badge className="absolute top-3 left-3 bg-white/90 text-gray-700">
                  {categorias.find((c) => c.value === produto.categoria)?.label}
                </Badge>
                {produto.complementos?.length > 0 && (
                  <Badge className="absolute top-3 right-3 bg-rose-500 text-white gap-1">
                    <Puzzle className="w-3 h-3" />
                    {produto.complementos.length}
                  </Badge>
                )}
              </div>
              <CardContent className="p-4">
                <h3 className="font-semibold text-gray-900 mb-1">{produto.nome}</h3>
                {produto.descricao && (
                  <p className="text-sm text-gray-500 line-clamp-2 mb-3">{produto.descricao}</p>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-rose-600">
                    R${' '}
                    {produto.preco?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openForm(produto)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => {
                        setProdutoToDelete(produto);
                        setShowDeleteDialog(true);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t flex items-center justify-between">
                  <span className="text-sm text-gray-500">Disponível</span>
                  <Switch
                    checked={produto.disponivel !== false}
                    onCheckedChange={(checked) =>
                      toggleDisponivel.mutate({ id: produto.id, disponivel: checked })
                    }
                  />
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
              onClick={() => deleteMutation.mutate(produtoToDelete?.id)}
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
