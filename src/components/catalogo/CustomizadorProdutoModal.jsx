import React, { useState, useMemo, useEffect } from 'react';
import { Minus, Plus, ShoppingCart, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

const fmt = (val) =>
  (parseFloat(val) || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function CustomizadorProdutoModal({
  open,
  onOpenChange,
  produto,
  onAdicionar,
  initialSelecionados = [],
  initialQuantidade = 1,
  maxComplementos = 4,
}) {
  const [selecionados, setSelecionados] = useState([]);
  const [quantidade, setQuantidade] = useState(1);

  useEffect(() => {
    if (open) {
      setSelecionados(initialSelecionados);
      setQuantidade(initialQuantidade);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const complementos = produto?.complementos || [];
  const precoBase = produto?.preco || 0;

  const valorComplementos = useMemo(() => {
    return selecionados.reduce((total, nome) => {
      const c = complementos.find((c) => c.nome === nome);
      return total + (parseFloat(c?.valor) || 0);
    }, 0);
  }, [selecionados, complementos]);

  const precoUnitario = precoBase + valorComplementos;
  const precoTotal = precoUnitario * quantidade;

  const toggleComplemento = (nome) => {
    setSelecionados((prev) => {
      if (prev.includes(nome)) return prev.filter((n) => n !== nome);
      if (prev.length >= maxComplementos) return prev;
      return [...prev, nome];
    });
  };

  const handleAdicionar = () => {
    const complementosDetalhados = selecionados
      .map((nome) => complementos.find((c) => c.nome === nome))
      .filter(Boolean)
      .map((c) => ({ nome: c.nome, valor: parseFloat(c.valor) || 0 }));

    onAdicionar({
      id: produto.id,
      nome: produto.nome,
      foto_url: produto.foto_url,
      preco: precoUnitario,
      preco_base: precoBase,
      quantidade,
      complementos_selecionados: complementosDetalhados,
      valor_complementos: valorComplementos,
      valor_total: precoTotal,
    });

    onOpenChange(false);
  };

  if (!produto) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Personalizar Produto</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Info do produto */}
          <div className="flex gap-4 items-center">
            <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100 shrink-0">
              {produto.foto_url ? (
                <img
                  src={produto.foto_url}
                  alt={produto.nome}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon className="w-8 h-8 text-gray-300" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900 text-lg leading-tight">{produto.nome}</h3>
              {produto.descricao && (
                <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{produto.descricao}</p>
              )}
              <p className="text-rose-600 font-semibold mt-1 text-sm">
                Base: R$ {fmt(precoBase)}
              </p>
            </div>
          </div>

          {/* Complementos */}
          {complementos.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-gray-700">Complementos Disponíveis</p>
                <span className="text-xs text-gray-400">{selecionados.length}/{maxComplementos} selecionados</span>
              </div>
              <div className="space-y-2">
                {complementos.map((c, i) => {
                  const checked = selecionados.includes(c.nome);
                  const limitReached = !checked && selecionados.length >= maxComplementos;
                  return (
                    <div
                      key={i}
                      className={`flex items-center justify-between p-3 rounded-lg border transition-colors select-none ${
                        limitReached
                          ? 'bg-gray-50 border-gray-100 opacity-40 cursor-not-allowed'
                          : checked
                          ? 'bg-rose-50 border-rose-200 cursor-pointer'
                          : 'bg-gray-50 border-gray-200 hover:bg-gray-100 cursor-pointer'
                      }`}
                      onClick={() => !limitReached && toggleComplemento(c.nome)}
                    >
                      <div className="flex items-center gap-2.5">
                        <Checkbox
                          checked={checked}
                          disabled={limitReached}
                          onCheckedChange={() => !limitReached && toggleComplemento(c.nome)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <Label className={`font-medium text-sm ${limitReached ? '' : 'cursor-pointer'}`}>{c.nome}</Label>
                      </div>
                      <span className="text-sm font-semibold text-rose-600 shrink-0 ml-4">
                        + R$ {fmt(parseFloat(c.valor) || 0)}
                      </span>
                    </div>
                  );
                })}
              </div>
              {selecionados.length >= maxComplementos && (
                <p className="text-xs text-amber-600 mt-2">Limite de {maxComplementos} complemento{maxComplementos !== 1 ? 's' : ''} atingido.</p>
              )}
            </div>
          )}

          {/* Quantidade e Total */}
          <div className="border-t pt-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700">Quantidade:</span>
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
                  onClick={() => setQuantidade((q) => Math.max(1, q - 1))}
                >
                  <Minus className="w-3 h-3" />
                </Button>
                <span className="w-8 text-center font-semibold tabular-nums">{quantidade}</span>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
                  onClick={() => setQuantidade((q) => q + 1)}
                >
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Total</p>
              <p className="text-xl font-bold text-rose-600">R$ {fmt(precoTotal)}</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleAdicionar} className="bg-rose-500 hover:bg-rose-600">
            <ShoppingCart className="w-4 h-4 mr-2" />
            Adicionar ao Carrinho
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
