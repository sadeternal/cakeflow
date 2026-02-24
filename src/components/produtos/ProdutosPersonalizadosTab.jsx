import React, { useState, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Layers, Cookie, Ruler, Sparkles, Gift, Candy, Pizza } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MoedaInput } from '@/components/ui/masked-input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import GerenciarItem from './GerenciarItem';

export default function ProdutosPersonalizadosTab({ user }) {
  const [categoria, setCategoria] = useState('massas');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const categorias = [
    { value: 'massas', label: 'Massas', icon: Layers },
    { value: 'recheios', label: 'Recheios', icon: Cookie },
    { value: 'tamanhos', label: 'Tamanhos', icon: Ruler },
    { value: 'coberturas', label: 'Coberturas', icon: Sparkles },
    { value: 'extras', label: 'Extras', icon: Gift },
    { value: 'doces', label: 'Doces', icon: Candy },
    { value: 'salgados', label: 'Salgados', icon: Pizza },
  ];

  return (
    <div className="space-y-6">
      <div className="text-center pb-4">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Produtos Personalizados</h2>
        <p className="text-gray-600">
          Configure os ingredientes e opções para bolos e produtos personalizados
        </p>
      </div>

      {/* Dropdown para mobile */}
      {isMobile && (
        <div className="mb-6">
          <Label className="mb-2 block">Selecione a categoria</Label>
          <Select value={categoria} onValueChange={setCategoria}>
            <SelectTrigger className="w-full h-12 bg-white border-gray-200">
              <SelectValue>
                <div className="flex items-center gap-3">
                  {(() => {
                    const cat = categorias.find(c => c.value === categoria);
                    const Icon = cat?.icon;
                    return (
                      <>
                        {Icon && <Icon className="w-5 h-5 text-rose-500" />}
                        <span className="font-medium">{cat?.label}</span>
                      </>
                    );
                  })()}
                </div>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {categorias.map((cat) => {
                const Icon = cat.icon;
                return (
                  <SelectItem key={cat.value} value={cat.value}>
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5 text-rose-500" />
                      <span>{cat.label}</span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Tabs para desktop */}
      {!isMobile && (
        <Tabs value={categoria} onValueChange={setCategoria} className="w-full mb-6">
          <TabsList className="grid w-full grid-cols-7 h-auto">
            {categorias.map((cat) => {
              const Icon = cat.icon;
              return (
                <TabsTrigger key={cat.value} value={cat.value} className="flex flex-col gap-1 py-2">
                  <Icon className="w-4 h-4" />
                  <span className="text-xs">{cat.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      )}

      <div>
        {/* Massas */}
        {categoria === 'massas' && (
          <GerenciarItem
            user={user}
            type="massas"
            title="Massas"
            icon={Layers}
            entityName="Massa"
            defaultFormData={{ nome: '', descricao: '', valor_adicional: 0, ativo: true }}
            renderFormFields={(formData, setFormData) => (
              <>
                <div>
                  <Label>Nome *</Label>
                  <Input
                    value={formData.nome || ''}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Ex: Chocolate"
                  />
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Input
                    value={formData.descricao || ''}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    placeholder="Descrição opcional"
                  />
                </div>
                <div>
                  <Label>Valor Adicional</Label>
                  <MoedaInput
                    value={formData.valor_adicional ? formData.valor_adicional.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''}
                    onChange={(e) => {
                      const valor = parseFloat(e.target.value.replace(/\./g, '').replace(',', '.')) || 0;
                      setFormData({ ...formData, valor_adicional: valor });
                    }}
                    placeholder="0,00"
                  />
                </div>
              </>
            )}
          />
        )}

        {/* Recheios */}
        {categoria === 'recheios' && (
          <GerenciarItem
            user={user}
            type="recheios"
            title="Recheios"
            icon={Cookie}
            entityName="Recheio"
            defaultFormData={{ nome: '', tipo: 'tradicional', valor_adicional: 0, ativo: true }}
            renderFormFields={(formData, setFormData) => (
              <>
                <div>
                  <Label>Nome *</Label>
                  <Input
                    value={formData.nome || ''}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Ex: Brigadeiro"
                  />
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select
                    value={formData.tipo || 'tradicional'}
                    onValueChange={(value) => setFormData({ ...formData, tipo: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tradicional">Tradicional</SelectItem>
                      <SelectItem value="premium">Premium</SelectItem>
                      <SelectItem value="especial">Especial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Valor Adicional</Label>
                  <MoedaInput
                    value={formData.valor_adicional ? formData.valor_adicional.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''}
                    onChange={(e) => {
                      const valor = parseFloat(e.target.value.replace(/\./g, '').replace(',', '.')) || 0;
                      setFormData({ ...formData, valor_adicional: valor });
                    }}
                    placeholder="0,00"
                  />
                </div>
              </>
            )}
            renderItemDetails={(item) => (
              <>
                <p className="font-medium text-gray-900">{item.nome}</p>
                <div className="flex items-center gap-2 mt-1">
                  {item.valor_adicional > 0 && (
                    <p className="text-sm text-rose-600">
                      + R$ {item.valor_adicional?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  )}
                  {item.tipo && (
                    <Badge variant="secondary" className="text-xs">{item.tipo}</Badge>
                  )}
                </div>
              </>
            )}
          />
        )}

        {/* Tamanhos */}
        {categoria === 'tamanhos' && (
          <GerenciarItem
            user={user}
            type="tamanhos"
            title="Tamanhos"
            icon={Ruler}
            entityName="Tamanho"
            defaultFormData={{ nome: '', tipo_medida: 'kg', quantidade_base: 1, valor_base: 0, max_recheios: 2, ativo: true }}
            renderFormFields={(formData, setFormData) => (
              <>
                <div>
                  <Label>Nome *</Label>
                  <Input
                    value={formData.nome || ''}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Ex: M - 2kg (20 fatias)"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Tipo de Medida</Label>
                    <Select
                      value={formData.tipo_medida || 'kg'}
                      onValueChange={(value) => setFormData({ ...formData, tipo_medida: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kg">Por Peso (kg)</SelectItem>
                        <SelectItem value="fatias">Por Fatias</SelectItem>
                        <SelectItem value="tamanho">Por Tamanho</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Quantidade Base</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.quantidade_base || ''}
                      onChange={(e) => setFormData({ ...formData, quantidade_base: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Valor Base *</Label>
                    <MoedaInput
                      value={formData.valor_base ? formData.valor_base.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''}
                      onChange={(e) => {
                        const valor = parseFloat(e.target.value.replace(/\./g, '').replace(',', '.')) || 0;
                        setFormData({ ...formData, valor_base: valor });
                      }}
                      placeholder="0,00"
                    />
                  </div>
                  <div>
                    <Label>Máx. Recheios</Label>
                    <Input
                      type="number"
                      value={formData.max_recheios || ''}
                      onChange={(e) => setFormData({ ...formData, max_recheios: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                </div>
              </>
            )}
            renderItemDetails={(item) => (
              <>
                <p className="font-medium text-gray-900">{item.nome}</p>
                <p className="text-sm text-rose-600">
                  R$ {item.valor_base?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </>
            )}
          />
        )}

        {/* Coberturas */}
        {categoria === 'coberturas' && (
          <GerenciarItem
            user={user}
            type="coberturas"
            title="Coberturas"
            icon={Sparkles}
            entityName="Cobertura"
            defaultFormData={{ nome: '', valor_adicional: 0, observacoes: '', ativo: true }}
            renderFormFields={(formData, setFormData) => (
              <>
                <div>
                  <Label>Nome *</Label>
                  <Input
                    value={formData.nome || ''}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Ex: Ganache"
                  />
                </div>
                <div>
                  <Label>Valor Adicional</Label>
                  <MoedaInput
                    value={formData.valor_adicional ? formData.valor_adicional.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''}
                    onChange={(e) => {
                      const valor = parseFloat(e.target.value.replace(/\./g, '').replace(',', '.')) || 0;
                      setFormData({ ...formData, valor_adicional: valor });
                    }}
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <Label>Observações</Label>
                  <Textarea
                    value={formData.observacoes || ''}
                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                    placeholder="Ex: Não indicado para dias quentes"
                  />
                </div>
              </>
            )}
          />
        )}

        {/* Extras */}
        {categoria === 'extras' && (
          <GerenciarItem
            user={user}
            type="extras"
            title="Extras"
            icon={Gift}
            entityName="Extra"
            defaultFormData={{ nome: '', valor: 0, valor_variavel: false, requer_observacao: false, ativo: true }}
            renderFormFields={(formData, setFormData) => (
              <>
                <div>
                  <Label>Nome *</Label>
                  <Input
                    value={formData.nome || ''}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Ex: Topper Personalizado"
                  />
                </div>
                <div>
                  <Label>Valor</Label>
                  <MoedaInput
                    value={formData.valor ? formData.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''}
                    onChange={(e) => {
                      const valor = parseFloat(e.target.value.replace(/\./g, '').replace(',', '.')) || 0;
                      setFormData({ ...formData, valor: valor });
                    }}
                    placeholder="0,00"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Valor pode variar no pedido</Label>
                  <Switch
                    checked={formData.valor_variavel || false}
                    onCheckedChange={(checked) => setFormData({ ...formData, valor_variavel: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Requer observação (ex: texto)</Label>
                  <Switch
                    checked={formData.requer_observacao || false}
                    onCheckedChange={(checked) => setFormData({ ...formData, requer_observacao: checked })}
                  />
                </div>
              </>
            )}
            renderItemDetails={(item) => (
              <>
                <p className="font-medium text-gray-900">{item.nome}</p>
                <p className="text-sm text-rose-600">
                  R$ {item.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </>
            )}
          />
        )}

        {/* Doces */}
        {categoria === 'doces' && (
          <GerenciarItem
            user={user}
            type="doces"
            title="Doces"
            icon={Candy}
            entityName="Doce"
            defaultFormData={{ nome: '', valor_unitario: 0, quantidade_minima: 1, ativo: true }}
            renderFormFields={(formData, setFormData) => (
              <>
                <div>
                  <Label>Nome *</Label>
                  <Input
                    value={formData.nome || ''}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Ex: Brigadeiro"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Valor Unitário *</Label>
                    <MoedaInput
                      value={formData.valor_unitario ? formData.valor_unitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''}
                      onChange={(e) => {
                        const valor = parseFloat(e.target.value.replace(/\./g, '').replace(',', '.')) || 0;
                        setFormData({ ...formData, valor_unitario: valor });
                      }}
                      placeholder="0,00"
                    />
                  </div>
                  <div>
                    <Label>Quantidade Mínima</Label>
                    <Input
                      type="number"
                      value={formData.quantidade_minima || 1}
                      onChange={(e) => setFormData({ ...formData, quantidade_minima: parseInt(e.target.value) || 1 })}
                      min="1"
                    />
                  </div>
                </div>
              </>
            )}
            renderItemDetails={(item) => (
              <>
                <p className="font-medium text-gray-900">{item.nome}</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-sm text-rose-600">
                    R$ {item.valor_unitario?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} /un
                  </p>
                  {item.quantidade_minima > 1 && (
                    <p className="text-xs text-gray-500">Mín: {item.quantidade_minima} un.</p>
                  )}
                </div>
              </>
            )}
          />
        )}

        {/* Salgados */}
        {categoria === 'salgados' && (
          <GerenciarItem
            user={user}
            type="salgados"
            title="Salgados"
            icon={Pizza}
            entityName="Salgado"
            defaultFormData={{ nome: '', valor_unitario: 0, quantidade_minima: 1, ativo: true }}
            renderFormFields={(formData, setFormData) => (
              <>
                <div>
                  <Label>Nome *</Label>
                  <Input
                    value={formData.nome || ''}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Ex: Coxinha"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Valor Unitário *</Label>
                    <MoedaInput
                      value={formData.valor_unitario ? formData.valor_unitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''}
                      onChange={(e) => {
                        const valor = parseFloat(e.target.value.replace(/\./g, '').replace(',', '.')) || 0;
                        setFormData({ ...formData, valor_unitario: valor });
                      }}
                      placeholder="0,00"
                    />
                  </div>
                  <div>
                    <Label>Quantidade Mínima</Label>
                    <Input
                      type="number"
                      value={formData.quantidade_minima || 1}
                      onChange={(e) => setFormData({ ...formData, quantidade_minima: parseInt(e.target.value) || 1 })}
                      min="1"
                    />
                  </div>
                </div>
              </>
            )}
            renderItemDetails={(item) => (
              <>
                <p className="font-medium text-gray-900">{item.nome}</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-sm text-rose-600">
                    R$ {item.valor_unitario?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} /un
                  </p>
                  {item.quantidade_minima > 1 && (
                    <p className="text-xs text-gray-500">Mín: {item.quantidade_minima} un.</p>
                  )}
                </div>
              </>
            )}
          />
        )}
      </div>
    </div>
  );
}