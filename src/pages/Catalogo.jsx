import React, { useState, useEffect } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import {
  Store,
  Phone,
  Instagram,
  MapPin,
  ShoppingBag,
  Sparkles,
  MessageCircle,
  ShoppingCart,
  Clock,
  Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import PedidoPublico from '@/components/catalogo/PedidoPublico';
import CarrinhoCheckout from '@/components/catalogo/CarrinhoCheckout';
import CustomizadorProdutoModal from '@/components/catalogo/CustomizadorProdutoModal';

export default function Catalogo() {
  const { slug: routeSlug } = useParams();
  const [slug, setSlug] = useState('');
  const [showPedidoForm, setShowPedidoForm] = useState(false);
  const [carrinho, setCarrinho] = useState([]);
  const [showCarrinho, setShowCarrinho] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoria, setSelectedCategoria] = useState('todas');
  const [showCustomizador, setShowCustomizador] = useState(false);
  const [produtoCustomizando, setProdutoCustomizando] = useState(null);
  const [editandoItemCarrinho, setEditandoItemCarrinho] = useState(null);

  useEffect(() => {
    if (routeSlug) {
      setSlug(routeSlug);
      return;
    }

    // Extrair slug do subdomínio
    const hostname = window.location.hostname;

    // Remover o domínio base (cakeflow.com.br) e pegar apenas o subdomínio
    const subdomain = hostname.replace('.cakeflow.com.br', '').replace('cakeflow.com.br', '');

    // Se houver subdomínio e não for 'app' ou 'www', usar como slug
    if (subdomain && subdomain !== 'app' && subdomain !== 'www' && subdomain !== hostname) {
      setSlug(subdomain);
    } else {
      // Para ambiente local/dev, tentar pegar do query string como fallback
      const params = new URLSearchParams(window.location.search);
      const slugParam = params.get('slug');
      setSlug(slugParam || '');
    }
  }, [routeSlug]);

  const { data: confeitarias = [], isLoading } = useQuery({
    queryKey: ['confeitaria-publica', slug],
    queryFn: () => appClient.entities.Confeitaria.filter({ slug }),
    enabled: !!slug,
  });

  const confeitaria = confeitarias[0];

  // Registrar acesso ao catálogo
  useEffect(() => {
    if (!confeitaria?.id) return;

    // Gerar ou pegar session_id do localStorage
    let sessionId = localStorage.getItem('catalog_session_id');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('catalog_session_id', sessionId);
    }

    // Registrar acesso
    appClient.entities.AcessoCatalogo.create({
      confeitaria_id: confeitaria.id,
      session_id: sessionId,
      referrer: document.referrer || 'direto',
      origem: document.referrer || 'direto',
      user_agent: navigator.userAgent || null
    }, { asAnon: true }).catch(err => console.error('Erro ao registrar acesso:', err));
  }, [confeitaria?.id]);

  // Atualizar título da página
  useEffect(() => {
    if (confeitaria?.nome) {
      document.title = `${confeitaria.nome} | Catálogo`;
    }
    return () => {
      document.title = 'CakeFlow';
    };
  }, [confeitaria?.nome]);

  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos-publicos', confeitaria?.id],
    queryFn: () => appClient.entities.Produto.filter({
      confeitaria_id: confeitaria.id,
      disponivel: true
    }),
    enabled: !!confeitaria?.id,
  });

  const handleWhatsApp = () => {
    const phone = confeitaria?.telefone?.replace(/\D/g, '');
    window.open(`https://wa.me/55${phone}`, '_blank');
  };

  const handleClickProduto = (produto) => {
    if (produto.complementos && produto.complementos.length > 0) {
      setProdutoCustomizando(produto);
      setShowCustomizador(true);
    } else {
      adicionarAoCarrinho(produto);
    }
  };

  const adicionarAoCarrinho = (produto) => {
    setCarrinho(prev => {
      const itemExistente = prev.find(item => item.id === produto.id);
      if (itemExistente) {
        return prev.map(item =>
          item.id === produto.id
            ? { ...item, quantidade: item.quantidade + 1 }
            : item
        );
      }
      return [...prev, { ...produto, quantidade: 1 }];
    });
  };

  const adicionarComComplementos = (item) => {
    if (editandoItemCarrinho) {
      setCarrinho(prev => prev.map(i => i === editandoItemCarrinho ? { ...item, quantidade: item.quantidade } : i));
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

  const updateQuantidadeCarrinho = (produtoId, quantidade) => {
    setCarrinho(prev =>
      prev.map(item =>
        item.id === produtoId ? { ...item, quantidade: Math.max(1, quantidade) } : item
      )
    );
  };

  const removerDoCarrinho = (produtoId) => {
    setCarrinho(prev => prev.filter(item => item.id !== produtoId));
  };

  const totalCarrinho = carrinho.reduce((acc, item) => acc + ((item.preco || 0) * item.quantidade), 0);
  const quantidadeItens = carrinho.reduce((acc, item) => acc + item.quantidade, 0);

  const produtosFiltrados = produtos.filter(p => {
    const matchNome = p.nome.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCategoria = selectedCategoria === 'todas' || p.categoria === selectedCategoria;
    return matchNome && matchCategoria;
  });

  const categorias = [...new Set(produtos.map(p => p.categoria))].filter(Boolean);

  const categoriasConfig = Array.isArray(confeitaria?.categorias_produto) ? confeitaria.categorias_produto : [];
  const getCategoriaLabel = (value) => {
    const found = categoriasConfig.find(c => c.value === value);
    return found ? found.label : value.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 to-amber-50 flex items-center justify-center">
        <div className="animate-pulse text-rose-400">Carregando...</div>
      </div>
    );
  }

  if (!confeitaria) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 to-amber-50 flex items-center justify-center p-4">
        <Card className="max-w-md text-center">
          <CardContent className="p-8">
            <Store className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Confeitaria não encontrada</h1>
            <p className="text-gray-500">Verifique se o endereço está correto.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const corPrincipal = confeitaria.cor_principal || '#ec4899';

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              {confeitaria.logo_url ? (
                <img
                  src={confeitaria.logo_url}
                  alt={confeitaria.nome}
                  className="h-10 w-10 sm:h-12 sm:w-12 rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-gradient-to-br from-rose-400 to-rose-600 flex items-center justify-center shrink-0">
                  <Store className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h1 className="text-base sm:text-xl font-bold text-gray-900 truncate">{confeitaria.nome}</h1>
                {confeitaria.descricao && (
                  <p className="text-xs sm:text-sm text-gray-600 line-clamp-1 sm:line-clamp-2 mt-0.5">
                    {confeitaria.descricao}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1 text-xs text-gray-500">
                  {confeitaria.instagram && (
                    <a
                      href={`https://instagram.com/${confeitaria.instagram.replace('@', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-rose-600 flex items-center gap-1"
                    >
                      <Instagram className="w-3 h-3" />
                      <span className="truncate">{confeitaria.instagram}</span>
                    </a>
                  )}
                  {confeitaria.endereco && (
                    <div className="hidden sm:flex items-center gap-1">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="truncate">{confeitaria.endereco}</span>
                    </div>
                  )}
                  {confeitaria.horario_funcionamento?.inicio && confeitaria.horario_funcionamento?.fim && (
                    <div className="hidden sm:flex items-center gap-1">
                      <Clock className="w-3 h-3 shrink-0" />
                      <span>
                        {confeitaria.horario_funcionamento.inicio} - {confeitaria.horario_funcionamento.fim}
                        {confeitaria.dias_funcionamento && confeitaria.dias_funcionamento.length > 0 && (
                          <span className="text-gray-400 ml-1">
                            ({confeitaria.dias_funcionamento.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ')})
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {confeitaria.telefone && (
                <Button
                  onClick={handleWhatsApp}
                  size="sm"
                  className="bg-green-500 hover:bg-green-600 hidden sm:flex"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  WhatsApp
                </Button>
              )}
              {confeitaria.telefone && (
                <Button
                  onClick={handleWhatsApp}
                  size="sm"
                  className="bg-green-500 hover:bg-green-600 sm:hidden p-2"
                >
                  <MessageCircle className="w-4 h-4" />
                </Button>
              )}
              <Button
                onClick={() => setShowCarrinho(true)}
                size="sm"
                className="relative hidden sm:flex"
                style={{ backgroundColor: corPrincipal }}
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                Carrinho
                {quantidadeItens > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {quantidadeItens}
                  </span>
                )}
              </Button>
              <Button
                onClick={() => setShowCarrinho(true)}
                size="sm"
                className="relative sm:hidden p-2"
                style={{ backgroundColor: corPrincipal }}
              >
                <ShoppingCart className="w-4 h-4" />
                {quantidadeItens > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                    {quantidadeItens}
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-8 flex-1">
        {/* Sobre - Mobile apenas */}
        {(confeitaria.endereco || confeitaria.horario_funcionamento?.inicio || confeitaria.telefone) && (
          <Card className="mb-4 sm:hidden border-0 shadow-lg">
            <CardContent className="p-4">
              <h2 className="text-sm font-bold text-gray-900 mb-3">Informações</h2>
              <div className="space-y-2 text-xs text-gray-600">
                {confeitaria.telefone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 shrink-0 text-gray-400" />
                    <span>{confeitaria.telefone}</span>
                  </div>
                )}
                {confeitaria.endereco && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 shrink-0 text-gray-400 mt-0.5" />
                    <span className="flex-1">{confeitaria.endereco}</span>
                  </div>
                )}
                {confeitaria.horario_funcionamento?.inicio && confeitaria.horario_funcionamento?.fim && (
                  <div className="flex items-start gap-2">
                    <Clock className="w-4 h-4 shrink-0 text-gray-400 mt-0.5" />
                    <div>
                      <div>{confeitaria.horario_funcionamento.inicio} - {confeitaria.horario_funcionamento.fim}</div>
                      {confeitaria.dias_funcionamento && confeitaria.dias_funcionamento.length > 0 && (
                        <div className="text-gray-400 mt-0.5">
                          {confeitaria.dias_funcionamento.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* CTA Pedido Personalizado */}
        {confeitaria.exibir_pedido_personalizado !== false && (
          <Card
            className="mb-4 sm:mb-8 border-0 shadow-xl overflow-hidden"
            style={{
              background: `linear-gradient(135deg, ${corPrincipal}15 0%, ${corPrincipal}05 100%)`,
              borderLeft: `4px solid ${corPrincipal}`
            }}
          >
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
                    <Sparkles className="w-5 h-5" style={{ color: corPrincipal }} />
                    {confeitaria.frase_pedido_personalizado || 'Monte seu Bolo Personalizado'}
                  </h2>
                  <p className="text-sm sm:text-base text-gray-600">
                    Escolha massa, recheio, cobertura e muito mais!
                  </p>
                </div>
                <Button
                  onClick={() => setShowPedidoForm(true)}
                  size="lg"
                  style={{ backgroundColor: corPrincipal }}
                  className="hover:opacity-90 w-full sm:w-auto"
                >
                  Fazer Pedido
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Produtos */}
        {produtos.length > 0 && (
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6 flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: corPrincipal }} />
              Nossos Produtos
            </h2>

            {/* Busca e Filtros */}
            <div className="mb-6 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Buscar produto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              {categorias.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={selectedCategoria === 'todas' ? 'default' : 'outline'}
                    onClick={() => setSelectedCategoria('todas')}
                    style={selectedCategoria === 'todas' ? { backgroundColor: corPrincipal } : {}}
                  >
                    Todas
                  </Button>
                  {categorias.map((cat) => (
                    <Button
                      key={cat}
                      size="sm"
                      variant={selectedCategoria === cat ? 'default' : 'outline'}
                      onClick={() => setSelectedCategoria(cat)}
                      style={selectedCategoria === cat ? { backgroundColor: corPrincipal } : {}}
                    >
                      {getCategoriaLabel(cat)}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            {/* Grid de Produtos */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {produtosFiltrados.map((produto) => (
                <Card key={produto.id} className="border-0 shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                  <div className="aspect-square relative bg-gray-100">
                    {produto.foto_url ? (
                      <img
                        src={produto.foto_url}
                        alt={produto.nome}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingBag className="w-8 h-8 text-gray-300" />
                      </div>
                    )}
                    {produto.categoria && (
                      <Badge className="absolute top-2 left-2 text-xs" variant="secondary">
                        {getCategoriaLabel(produto.categoria)}
                      </Badge>
                    )}
                  </div>
                  <CardContent className="p-3">
                    <h3 className="font-semibold text-gray-900 text-sm mb-1 line-clamp-1">{produto.nome}</h3>
                    {produto.descricao && (
                      <p className="text-xs text-gray-500 mb-2 line-clamp-2">{produto.descricao}</p>
                    )}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-lg font-bold" style={{ color: corPrincipal }}>
                        R$ {produto.preco?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <Button
                      onClick={() => handleClickProduto(produto)}
                      style={{ backgroundColor: corPrincipal }}
                      className="hover:opacity-90 w-full"
                      size="sm"
                    >
                      <ShoppingCart className="w-4 h-4 mr-1" />
                      {produto.complementos?.length > 0 ? 'Personalizar' : 'Adicionar'}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            {produtosFiltrados.length === 0 && (
              <div className="text-center py-8">
                <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Nenhum produto encontrado</p>
              </div>
            )}
          </div>
        )}

        {produtos.length === 0 && (
          <div className="text-center py-8 sm:py-12 px-4">
            <ShoppingBag className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-3 sm:mb-4" />
            <p className="text-sm sm:text-base text-gray-500">
              Entre em contato para conhecer nossos produtos!
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t py-6 sm:py-8 mt-auto">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 text-center text-gray-500 text-xs sm:text-sm">
          <p>© {new Date().getFullYear()} {confeitaria.nome}. Todos os direitos reservados.</p>
        </div>
      </footer>

      {/* Modal Customizador de Produto */}
      <CustomizadorProdutoModal
        open={showCustomizador}
        onOpenChange={(val) => { if (!val) setEditandoItemCarrinho(null); setShowCustomizador(val); }}
        produto={produtoCustomizando}
        onAdicionar={adicionarComComplementos}
        initialSelecionados={editandoItemCarrinho?.complementos_selecionados?.map(c => c.nome) ?? []}
        initialQuantidade={editandoItemCarrinho?.quantidade ?? 1}
        maxComplementos={produtoCustomizando?.limite_complementos ?? confeitaria?.max_complementos_produto ?? 4}
      />

      {/* Modal Pedido Personalizado */}
      {showPedidoForm && (
        <PedidoPublico
          confeitaria={confeitaria}
          onClose={() => setShowPedidoForm(false)}
        />
      )}

      {/* Modal Carrinho */}
      {showCarrinho && (
        <CarrinhoCheckout
          confeitaria={confeitaria}
          carrinho={carrinho}
          onClose={() => setShowCarrinho(false)}
          onUpdateQuantidade={updateQuantidadeCarrinho}
          onRemoverItem={removerDoCarrinho}
          onLimparCarrinho={() => setCarrinho([])}
          onEditarItem={handleEditarItemCarrinho}
        />
      )}
    </div>
  );
}
