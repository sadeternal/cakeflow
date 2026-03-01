import React, { useEffect, useState } from 'react';
import { appClient } from '@/api/appClient';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createCatalogUrl, createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { 
  CheckCircle2, 
  Circle, 
  Settings, 
  Package, 
  CreditCard, 
  ShoppingBag, 
  Share2,
  X,
  Sparkles
} from 'lucide-react';
import confetti from 'canvas-confetti';

const etapasConfig = [
  {
    id: 'configurar_confeitaria',
    titulo: 'Configurar Confeitaria',
    descricao: 'Complete os dados da sua confeitaria',
    icone: Settings,
    link: 'Configuracoes',
    verificar: (confeitaria) => {
      return !!(confeitaria?.nome && confeitaria?.telefone && confeitaria?.endereco);
    }
  },
  {
    id: 'criar_produtos',
    titulo: 'Criar Produtos',
    descricao: 'Adicione seus produtos ao catálogo',
    icone: Package,
    link: 'Produtos',
    verificar: async (confeitaria, user) => {
      const produtos = await appClient.entities.Produto.filter({ confeitaria_id: user.confeitaria_id });
      return produtos.length > 0;
    }
  },
  {
    id: 'configurar_pagamentos',
    titulo: 'Configurar Pagamentos',
    descricao: 'Configure as formas de pagamento',
    icone: CreditCard,
    link: 'Configuracoes?tab=pagamentos',
    verificar: async (confeitaria, user) => {
      const formas = await appClient.entities.FormaPagamento.filter({ confeitaria_id: user.confeitaria_id });
      return formas.length > 0;
    }
  },
  {
    id: 'testar_pedido',
    titulo: 'Testar Pedido',
    descricao: 'Crie seu primeiro pedido de teste',
    icone: ShoppingBag,
    link: 'NovoPedido',
    verificar: async (confeitaria, user) => {
      const pedidos = await appClient.entities.Pedido.filter({ confeitaria_id: user.confeitaria_id });
      return pedidos.length > 0;
    }
  },
  {
    id: 'divulgar_catalogo',
    titulo: 'Divulgar Catálogo',
    descricao: 'Acesse seu catálogo público',
    icone: Share2,
    link: null, // Será um botão customizado
    verificar: async (confeitaria, user) => {
      // Marca como concluído se já acessou o catálogo
      const etapas = user.onboarding_etapas_concluidas || [];
      return etapas.includes('divulgar_catalogo');
    }
  }
];

const VISIBILITY_STORAGE_KEY = 'cakeflow_onboarding_ocultar_dashboard';

const readHiddenPreference = (userId) => {
  if (typeof window === 'undefined' || !userId) return null;
  const value = window.localStorage.getItem(`${VISIBILITY_STORAGE_KEY}:${userId}`);
  if (value === null) return null;
  return value === 'true';
};

const writeHiddenPreference = (userId, value) => {
  if (typeof window === 'undefined' || !userId) return;
  window.localStorage.setItem(`${VISIBILITY_STORAGE_KEY}:${userId}`, String(value));
};

export default function OnboardingChecklist({ user, confeitaria }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [etapasStatus, setEtapasStatus] = useState({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [isHidden, setIsHidden] = useState(() => {
    const stored = readHiddenPreference(user?.id);
    if (stored !== null) return stored;
    return user?.onboarding_ocultar_dashboard === true;
  });

  useEffect(() => {
    const stored = readHiddenPreference(user?.id);
    if (stored !== null) {
      setIsHidden(stored);
      return;
    }
    setIsHidden(user?.onboarding_ocultar_dashboard === true);
  }, [user?.id, user?.onboarding_ocultar_dashboard]);

  const updateUserMutation = useMutation({
    mutationFn: (data) => appClient.auth.updateMe(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
    }
  });

  // Verificar status das etapas
  useEffect(() => {
    const verificarEtapas = async () => {
      const status = {};
      const etapasConcluidas = user.onboarding_etapas_concluidas || [];

      for (const etapa of etapasConfig) {
        // Se já está marcada como concluída, mantém
        if (etapasConcluidas.includes(etapa.id)) {
          status[etapa.id] = true;
          continue;
        }

        // Verifica se foi concluída
        try {
          const concluida = await etapa.verificar(confeitaria, user);
          status[etapa.id] = concluida;

          // Se foi concluída mas não está salva, atualiza
          if (concluida && !etapasConcluidas.includes(etapa.id)) {
            const novasEtapas = [...etapasConcluidas, etapa.id];
            await updateUserMutation.mutateAsync({
              onboarding_etapas_concluidas: novasEtapas
            });
          }
        } catch (error) {
          status[etapa.id] = false;
        }
      }

      setEtapasStatus(status);

      // Verificar se todas foram concluídas
      const todasConcluidas = etapasConfig.every(e => status[e.id]);
      if (todasConcluidas && !user.onboarding_finalizado) {
        await finalizarOnboarding();
      }
    };

    if (user && confeitaria) {
      verificarEtapas();
    }
  }, [user, confeitaria]);

  const finalizarOnboarding = async () => {
    await updateUserMutation.mutateAsync({
      onboarding_finalizado: true
    });
    
    setShowSuccess(true);
    
    // Confetti celebration
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });

    // Ocultar após 3 segundos
    setTimeout(() => {
      setShowSuccess(false);
    }, 3000);
  };

  const handleMarcarDivulgarCatalogo = async () => {
    const etapasConcluidas = user.onboarding_etapas_concluidas || [];
    if (!etapasConcluidas.includes('divulgar_catalogo')) {
      const novasEtapas = [...etapasConcluidas, 'divulgar_catalogo'];
      await updateUserMutation.mutateAsync({
        onboarding_etapas_concluidas: novasEtapas
      });
    }

    // Abrir catálogo
    const catalogUrl = createCatalogUrl(confeitaria.slug);
    window.open(catalogUrl, '_blank');
  };

  const handleFechar = async () => {
    await handleToggleOcultarDashboard(true);
  };

  const handleToggleOcultarDashboard = async (checked) => {
    const previous = isHidden;
    setIsHidden(checked);
    writeHiddenPreference(user?.id, checked);

    try {
      await updateUserMutation.mutateAsync({
        onboarding_ocultar_dashboard: checked
      });
    } catch (error) {
      setIsHidden(previous);
      writeHiddenPreference(user?.id, previous);
      toast({
        title: 'Não foi possível salvar sua preferência',
        description:
          error?.message ||
          'Aplicamos apenas nesta sessão. Se persistir, rode as migrations do Supabase.',
        variant: 'destructive'
      });
    }
  };

  const etapasConcluidas = Object.values(etapasStatus).filter(Boolean).length;
  const progresso = (etapasConcluidas / etapasConfig.length) * 100;

  if (isHidden) {
    return (
      <Card className="border border-gray-200 bg-white">
        <CardContent className="p-4 flex items-center justify-between gap-3">
          <div>
            <p className="font-medium text-gray-900">Primeiros passos ocultos</p>
            <p className="text-sm text-gray-600">Você pode exibir novamente quando quiser.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleToggleOcultarDashboard(false)}
          >
            Mostrar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Mensagem de sucesso
  if (showSuccess) {
    return (
      <Card className="border-2 border-emerald-500 shadow-lg shadow-emerald-100/50 bg-gradient-to-r from-emerald-50 to-green-50">
        <CardContent className="p-8 text-center">
          <div className="inline-flex p-4 rounded-full bg-emerald-100 mb-4">
            <Sparkles className="w-12 h-12 text-emerald-600" />
          </div>
          <h3 className="text-2xl font-bold text-emerald-900 mb-2">
            Parabéns! 🎉
          </h3>
          <p className="text-emerald-700">
            Você concluiu todas as etapas do onboarding. Seu CakeFlow está pronto para usar!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-rose-500 shadow-lg shadow-rose-100/50 bg-gradient-to-r from-rose-50 to-pink-50">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-rose-500" />
              Primeiros Passos
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              Complete estas etapas para começar a usar o CakeFlow
            </p>
            <div className="flex items-center gap-2 mt-3">
              <Switch
                id="onboarding-ocultar-dashboard"
                checked={isHidden}
                onCheckedChange={handleToggleOcultarDashboard}
              />
              <label htmlFor="onboarding-ocultar-dashboard" className="text-xs text-gray-600">
                Ocultar primeiros passos no dashboard
              </label>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleFechar}
            className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Barra de Progresso */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-700">Progresso</span>
            <span className="text-rose-600 font-bold">
              {etapasConcluidas} de {etapasConfig.length}
            </span>
          </div>
          <Progress value={progresso} className="h-2" />
        </div>

        {/* Lista de Etapas */}
        <div className="space-y-2">
          {etapasConfig.map((etapa) => {
            const Icone = etapa.icone;
            const concluida = etapasStatus[etapa.id];

            if (etapa.id === 'divulgar_catalogo') {
              return (
                <button
                  key={etapa.id}
                  onClick={handleMarcarDivulgarCatalogo}
                  disabled={concluida}
                  className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all ${
                    concluida
                      ? 'bg-emerald-50 border border-emerald-200 cursor-default'
                      : 'bg-white border border-gray-200 hover:border-rose-300 hover:bg-rose-50 cursor-pointer'
                  }`}>
                  <div className={`p-2 rounded-lg ${concluida ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                    <Icone className={`w-5 h-5 ${concluida ? 'text-emerald-600' : 'text-gray-600'}`} />
                  </div>
                  <div className="flex-1 text-left">
                    <h4 className={`font-semibold ${concluida ? 'text-emerald-900' : 'text-gray-900'}`}>
                      {etapa.titulo}
                    </h4>
                    <p className={`text-sm ${concluida ? 'text-emerald-700' : 'text-gray-600'}`}>
                      {etapa.descricao}
                    </p>
                  </div>
                  {concluida ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                  ) : (
                    <Circle className="w-6 h-6 text-gray-300" />
                  )}
                </button>
              );
            }

            return (
              <Link
                key={etapa.id}
                to={createPageUrl(etapa.link)}
                className={`flex items-center gap-3 p-4 rounded-xl transition-all ${
                  concluida
                    ? 'bg-emerald-50 border border-emerald-200 cursor-default pointer-events-none'
                    : 'bg-white border border-gray-200 hover:border-rose-300 hover:bg-rose-50'
                }`}>
                <div className={`p-2 rounded-lg ${concluida ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                  <Icone className={`w-5 h-5 ${concluida ? 'text-emerald-600' : 'text-gray-600'}`} />
                </div>
                <div className="flex-1">
                  <h4 className={`font-semibold ${concluida ? 'text-emerald-900' : 'text-gray-900'}`}>
                    {etapa.titulo}
                  </h4>
                  <p className={`text-sm ${concluida ? 'text-emerald-700' : 'text-gray-600'}`}>
                    {etapa.descricao}
                  </p>
                </div>
                {concluida ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                ) : (
                  <Circle className="w-6 h-6 text-gray-300" />
                )}
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
