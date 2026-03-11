import React, { useState, useEffect } from 'react';
import { appClient } from '@/api/appClient';
import { Trash2, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { MoedaInput } from '@/components/ui/masked-input';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const DEFAULT_CATEGORIAS = [
  { value: 'bolo', label: 'Bolo' },
  { value: 'doce', label: 'Doce' },
  { value: 'salgado', label: 'Salgado' },
  { value: 'bebida', label: 'Bebida' },
  { value: 'outro', label: 'Outro' },
];

const COMPLEMENTOS_VAZIOS = [
  { nome: '', valor: '', ativo: false },
  { nome: '', valor: '', ativo: false },
  { nome: '', valor: '', ativo: false },
  { nome: '', valor: '', ativo: false },
];

const FORM_INICIAL = {
  nome: '',
  descricao: '',
  preco: '',
  categoria: 'bolo',
  foto_url: '',
  disponivel: true,
};

export default function FormProductoModal({ open, onOpenChange, editingProduto, onSave, isSaving, maxComplementos = 4, categorias = DEFAULT_CATEGORIAS }) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('dados');
  const [formData, setFormData] = useState(FORM_INICIAL);
  const [complementos, setComplementos] = useState([]);
  const [limiteComplementos, setLimiteComplementos] = useState(null);

  useEffect(() => {
    if (!open) return;

    if (editingProduto) {
      setFormData({
        nome: editingProduto.nome || '',
        descricao: editingProduto.descricao || '',
        preco: editingProduto.preco?.toString() || '',
        categoria: editingProduto.categoria || 'bolo',
        foto_url: editingProduto.foto_url || '',
        disponivel: editingProduto.disponivel !== false,
      });
      setLimiteComplementos(editingProduto.limite_complementos ?? null);

      const saved = Array.isArray(editingProduto.complementos) ? editingProduto.complementos : [];
      const slots = Array.from({ length: maxComplementos }, () => ({ nome: '', valor: '', ativo: false }));
      saved.slice(0, maxComplementos).forEach((c, i) => {
        slots[i] = { nome: c.nome || '', valor: String(c.valor ?? ''), ativo: true };
      });
      setComplementos(slots);
    } else {
      setFormData(FORM_INICIAL);
      setLimiteComplementos(null);
      setComplementos(Array.from({ length: maxComplementos }, () => ({ nome: '', valor: '', ativo: false })));
    }

    setActiveTab('dados');
  }, [open, editingProduto]);

  const toggleComplemento = (index) => {
    setComplementos((prev) =>
      prev.map((c, i) =>
        i === index
          ? { ...c, ativo: !c.ativo, valor: !c.ativo && c.valor === '' ? '0' : c.valor }
          : c
      )
    );
  };

  const updateComplemento = (index, field, value) => {
    setComplementos((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    );
  };

  const clearComplemento = (index) => {
    setComplementos((prev) =>
      prev.map((c, i) => (i === index ? { nome: '', valor: '', ativo: false } : c))
    );
  };

  const complementosAtivos = complementos.filter((c) => c.ativo);

  const isValid = () => {
    if (!formData.nome.trim()) return false;
    if (!formData.preco || parseFloat(formData.preco) <= 0) return false;
    for (const c of complementosAtivos) {
      if (!c.nome.trim()) return false;
      const val = parseFloat(c.valor);
      if (!isNaN(val) && val < 0) return false;
    }
    return true;
  };

  const handleSave = () => {
    if (!isValid()) return;
    const complementosFiltrados = complementosAtivos.map(({ nome, valor }) => ({
      nome,
      valor: String(parseFloat(valor) || 0),
    }));
    onSave({
      ...formData,
      preco: parseFloat(formData.preco) || 0,
      complementos: complementosFiltrados,
      limite_complementos: limiteComplementos ? Math.min(maxComplementos, Math.max(1, Number(limiteComplementos))) : null,
    });
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await appClient.integrations.Core.UploadFile({ file });
      setFormData((prev) => ({ ...prev, foto_url: result.file_url }));
      toast({ title: 'Imagem enviada', description: 'Upload concluído com sucesso.' });
    } catch (error) {
      toast({
        title: 'Erro no upload da imagem',
        description: error?.message || 'Não foi possível enviar a imagem.',
        variant: 'destructive',
      });
    }
  };

  const handleOpenChange = (val) => {
    if (!val) setActiveTab('dados');
    onOpenChange(val);
  };

  const fmtPreco = (val) =>
    val
      ? parseFloat(val).toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : '';

  const parsePreco = (raw) =>
    String(parseFloat(raw.replace(/\./g, '').replace(',', '.')) || 0);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingProduto ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="dados">Dados do Produto</TabsTrigger>
            <TabsTrigger value="complementos" className="relative">
              Complementos
              {complementosAtivos.length > 0 && (
                <Badge className="ml-2 bg-rose-500 text-white h-5 min-w-5 flex items-center justify-center px-1 text-xs rounded-full">
                  {complementosAtivos.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Aba 1: Dados */}
          <TabsContent value="dados" className="space-y-4 pt-4">
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
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Preço *</Label>
                <MoedaInput
                  value={fmtPreco(formData.preco)}
                  onChange={(e) => setFormData({ ...formData, preco: parsePreco(e.target.value) })}
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
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-sm leading-none"
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
                className="data-[state=checked]:bg-rose-500"
              />
            </div>
          </TabsContent>

          {/* Aba 2: Complementos */}
          <TabsContent value="complementos" className="space-y-4 pt-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-900">
                Adicione até {maxComplementos} complementos opcionais. Clientes poderão escolher quais desejam ao adicionar ao carrinho.
              </p>
            </div>

            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Limite de seleção pelo cliente</p>
                <p className="text-xs text-gray-500 mt-0.5">Quantos complementos o cliente pode escolher. Deixe em branco para usar o padrão global.</p>
              </div>
              <Input
                type="number"
                min={1}
                max={maxComplementos}
                className="w-20 h-8 text-center"
                value={limiteComplementos ?? ''}
                placeholder="—"
                onChange={(e) => {
                  const val = e.target.value;
                  setLimiteComplementos(val === '' ? null : Math.min(maxComplementos, Math.max(1, parseInt(val) || 1)));
                }}
              />
            </div>

            <div className="space-y-3">
              {complementos.map((c, index) => (
                <Card
                  key={index}
                  className={`border transition-colors ${
                    c.ativo ? 'bg-rose-50 border-rose-200' : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Switch
                          checked={c.ativo}
                          onCheckedChange={() => toggleComplemento(index)}
                          className="data-[state=checked]:bg-rose-500"
                        />
                        <span
                          className={`text-xs font-semibold w-6 ${
                            c.ativo ? 'text-rose-600' : 'text-gray-400'
                          }`}
                        >
                          {c.ativo ? 'ON' : 'OFF'}
                        </span>
                      </div>

                      <div className="flex-1 grid grid-cols-2 gap-2 min-w-0">
                        <Input
                          value={c.nome}
                          onChange={(e) => updateComplemento(index, 'nome', e.target.value)}
                          disabled={!c.ativo}
                          className={`text-sm h-8 ${!c.ativo ? 'bg-gray-100 text-gray-400' : ''}`}
                          placeholder="Ex: Ganache Premium"
                        />
                        <MoedaInput
                          value={c.valor ? fmtPreco(c.valor) : ''}
                          onChange={(e) =>
                            updateComplemento(index, 'valor', parsePreco(e.target.value))
                          }
                          disabled={!c.ativo}
                          className={`text-sm h-8 ${!c.ativo ? 'bg-gray-100 text-gray-400' : ''}`}
                          placeholder="0,00"
                        />
                      </div>

                      {c.ativo && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 shrink-0 text-red-500 hover:bg-red-50"
                          onClick={() => clearComplemento(index)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <p className="text-sm text-center">
              {complementosAtivos.length > 0 ? (
                <span className="text-rose-600 font-medium">
                  ✅ {complementosAtivos.length} complemento(s) habilitado(s) de {maxComplementos}
                </span>
              ) : (
                <span className="text-gray-400">Nenhum complemento habilitado</span>
              )}
            </p>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={!isValid() || isSaving}
            className="bg-rose-500 hover:bg-rose-600"
          >
            {isSaving ? 'Salvando...' : 'Salvar Produto'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
