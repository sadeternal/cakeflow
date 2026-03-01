import React, { useState } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Package,
  Pencil,
  Trash2,
  Search,
  Image as ImageIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MoedaInput } from '@/components/ui/masked-input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
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

  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    preco: '',
    categoria: 'bolo',
    foto_url: '',
    disponivel: true,
  });

  const { data: produtos = [], isLoading } = useQuery({
    queryKey: ['produtos', user?.confeitaria_id],
    queryFn: () => appClient.entities.Produto.filter({ confeitaria_id: user.confeitaria_id }),
    enabled: !!user?.confeitaria_id,
  });

  const saveMutation = useMutation({
    mutationFn: (data) => {
      const payload = {
        ...data,
        preco: parseFloat(data.preco) || 0,
      };
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
        description: 'As informações do produto foram salvas com sucesso.'
      });
      closeForm();
    },
    onError: (error) => {
      toast({
        title: 'Erro ao salvar produto',
        description: error?.message || 'Não foi possível salvar o produto.',
        variant: 'destructive'
      });
    }
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

  const closeForm = () => {
    setShowForm(false);
    setEditingProduto(null);
    setFormData({
      nome: '',
      descricao: '',
      preco: '',
      categoria: 'bolo',
      foto_url: '',
      disponivel: true,
    });
  };

  const openEditForm = (produto) => {
    setEditingProduto(produto);
    setFormData({
      nome: produto.nome || '',
      descricao: produto.descricao || '',
      preco: produto.preco?.toString() || '',
      categoria: produto.categoria || 'bolo',
      foto_url: produto.foto_url || '',
      disponivel: produto.disponivel !== false,
    });
    setShowForm(true);
  };

  const filteredProdutos = produtos.filter(p =>
    p.nome?.toLowerCase().includes(search.toLowerCase())
  );

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await appClient.integrations.Core.UploadFile({ file });
      setFormData((prev) => ({ ...prev, foto_url: result.file_url }));
      toast({
        title: 'Imagem enviada',
        description: 'Upload concluído com sucesso.'
      });
    } catch (error) {
      toast({
        title: 'Erro no upload da imagem',
        description: error?.message || 'Não foi possível enviar a imagem.',
        variant: 'destructive'
      });
    }
  };

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
          onClick={() => setShowForm(true)}
          className="h-11 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 shadow-lg shadow-rose-200"
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo Produto
        </Button>
      </div>

      {/* Produtos Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Carregando...</div>
      ) : filteredProdutos.length === 0 ? (
        <Card className="border-0 shadow-lg shadow-gray-100/50">
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500 mb-4">Nenhum produto cadastrado</p>
            <Button onClick={() => setShowForm(true)} className="bg-rose-500 hover:bg-rose-600">
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
                  {categorias.find(c => c.value === produto.categoria)?.label}
                </Badge>
              </div>
              <CardContent className="p-4">
                <h3 className="font-semibold text-gray-900 mb-1">{produto.nome}</h3>
                {produto.descricao && (
                  <p className="text-sm text-gray-500 line-clamp-2 mb-3">{produto.descricao}</p>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-rose-600">
                    R$ {produto.preco?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => openEditForm(produto)}
                    >
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

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={closeForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingProduto ? 'Editar Produto' : 'Novo Produto'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Nome *</Label>
              <Input
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Nome do produto"
              />
            </div>

            <div>
              <Label>Descrição</Label>
              <Textarea
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Descrição do produto"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Preço *</Label>
                <MoedaInput
                  value={formData.preco ? parseFloat(formData.preco).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}
                  onChange={(e) => {
                    const valor = parseFloat(e.target.value.replace(/\./g, '').replace(',', '.')) || 0;
                    setFormData({ ...formData, preco: valor.toString() });
                  }}
                  placeholder="0,00"
                />
              </div>
              <div>
                <Label>Categoria</Label>
                <Select
                  value={formData.categoria}
                  onValueChange={(value) => setFormData({ ...formData, categoria: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categorias.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Foto</Label>
              <div className="mt-1.5">
                {formData.foto_url ? (
                  <div className="relative w-32 h-32 rounded-lg overflow-hidden">
                    <img
                      src={formData.foto_url}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, foto_url: '' })}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center w-32 h-32 border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:border-rose-300 transition-colors">
                    <div className="text-center">
                      <ImageIcon className="w-8 h-8 text-gray-400 mx-auto mb-1" />
                      <span className="text-xs text-gray-500">Adicionar</span>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                  </label>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label>Disponível para venda</Label>
              <Switch
                checked={formData.disponivel}
                onCheckedChange={(checked) => setFormData({ ...formData, disponivel: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeForm}>
              Cancelar
            </Button>
            <Button
              onClick={() => saveMutation.mutate(formData)}
              disabled={!formData.nome || !formData.preco || saveMutation.isPending}
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
