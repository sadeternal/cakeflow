import React, { useState, useEffect } from 'react';
import { appClient } from '@/api/appClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Clock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { toast } from 'sonner';

export default function AssinaturasTab({ confeitaria, onUpdate }) {
  const [loading, setLoading] = useState(false);
  const [checkoutProcessed, setCheckoutProcessed] = useState(false);

  useEffect(() => {
    const handleCheckoutSuccess = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('checkout') === 'success' && !checkoutProcessed) {
        setCheckoutProcessed(true);
        toast.success('Assinatura iniciada com sucesso!');
        
        // Aguardar webhook processar (3 segundos)
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Recarregar dados
        if (onUpdate) {
          await onUpdate();
        }
        
        // Limpar URL
        urlParams.delete('checkout');
        const newUrl = `${window.location.pathname}${urlParams.toString() ? '?' + urlParams.toString() : ''}`;
        window.history.replaceState({}, '', newUrl);
      }
    };
    
    handleCheckoutSuccess();
  }, [checkoutProcessed, onUpdate]);

  // Auto-sincronizar quando dados estiverem incompletos
  useEffect(() => {
    const autoSync = async () => {
      if (
        confeitaria?.stripe_subscription_id &&
        !confeitaria?.data_proximo_pagamento &&
        (
          confeitaria?.status_assinatura === 'active' ||
          confeitaria?.status_assinatura === 'trial' ||
          confeitaria?.status_assinatura === 'canceling'
        )
      ) {
        console.log('🔄 Auto-sincronizando dados da assinatura...');
        try {
          const response = await appClient.functions.invoke('syncSubscription', {
            confeitaria_id: confeitaria.id
          });
          
          if (response?.data?.success && onUpdate) {
            await onUpdate();
          }
        } catch (error) {
          console.error('Erro na sincronização automática:', error);
        }
      }
    };
    
    autoSync();
  }, [
    confeitaria?.id,
    confeitaria?.stripe_subscription_id,
    confeitaria?.data_proximo_pagamento,
    confeitaria?.status_assinatura
  ]);

  const statusConfig = {
    trial: {
      label: 'Período de Teste',
      color: 'bg-blue-100 text-blue-800',
      icon: Clock,
      description: 'Você está no período de teste gratuito de 7 dias'
    },
    active: {
      label: 'Ativa',
      color: 'bg-green-100 text-green-800',
      icon: CheckCircle2,
      description: 'Sua assinatura está ativa'
    },
    canceling: {
      label: 'Cancelamento Agendado',
      color: 'bg-orange-100 text-orange-800',
      icon: AlertCircle,
      description: 'Sua assinatura permanece ativa até o fim do período atual'
    },
    past_due: {
      label: 'Pagamento Pendente',
      color: 'bg-yellow-100 text-yellow-800',
      icon: AlertCircle,
      description: 'Há um problema com o pagamento'
    },
    canceled: {
      label: 'Cancelada',
      color: 'bg-red-100 text-red-800',
      icon: AlertCircle,
      description: 'Sua assinatura foi cancelada'
    },
    incomplete: {
      label: 'Incompleta',
      color: 'bg-gray-100 text-gray-800',
      icon: AlertCircle,
      description: 'Complete o processo de assinatura'
    }
  };

  const status = confeitaria?.status_assinatura || 'trial';
  const config = statusConfig[status] || statusConfig.trial;
  const StatusIcon = config.icon;
  const hasOngoingSubscription =
    Boolean(confeitaria?.stripe_subscription_id) &&
    ['active', 'canceling', 'past_due', 'incomplete', 'trial'].includes(status);

  const buildBillingReturnUrl = () => {
    const returnUrl = new URL(`${window.location.origin}/Configuracoes`);
    returnUrl.searchParams.set('tab', 'assinaturas');
    return returnUrl.toString();
  };

  const handleOpenBilling = async () => {
    try {
      setLoading(true);

      const response = await appClient.functions.invoke('createCheckoutSession', {
        confeitaria_id: confeitaria.id
      });

      if (response?.data?.url) {
        window.location.href = response.data.url;
      } else {
        throw new Error('URL de cobrança não retornada');
      }
    } catch (error) {
      console.error('❌ Erro ao abrir cobrança:', error);
      if (Number(error?.status) === 401 || /unauthorized|invalid jwt/i.test(String(error?.message || ''))) {
        appClient.auth.redirectToLogin(buildBillingReturnUrl());
        return;
      }
      alert(`Erro ao abrir cobrança: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncSubscription = async () => {
    try {
      setLoading(true);
      const response = await appClient.functions.invoke('syncSubscription', {
        confeitaria_id: confeitaria.id
      });
      
      if (response?.data?.success) {
        toast.success('Assinatura sincronizada com sucesso!');
        if (onUpdate) {
          await onUpdate();
        }
      }
    } catch (error) {
      console.error('❌ Erro ao sincronizar:', error);
      toast.error('Erro ao sincronizar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (!confeitaria) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status da Assinatura */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Status da Assinatura
          </CardTitle>
          <CardDescription>Gerencie seu plano e forma de pagamento</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-full ${config.color}`}>
              <StatusIcon className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-lg">{config.label}</h3>
                <Badge className={config.color}>{status}</Badge>
              </div>
              <p className="text-sm text-gray-600">{config.description}</p>
            </div>
          </div>

          {/* Período de Teste */}
          {confeitaria?.data_fim_trial && status === 'trial' && (
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-900">
                <strong>Período de teste até:</strong>{' '}
                {format(new Date(confeitaria.data_fim_trial), "d 'de' MMMM 'de' yyyy", {
                  locale: ptBR
                })}
              </p>
              <p className="text-xs text-blue-700 mt-1">
                Após prazo gratuito é necessario assinar um plano.
              </p>
            </div>
          )}

          {/* Próximo Pagamento */}
          {confeitaria?.data_proximo_pagamento &&
            (status === 'active' || status === 'past_due' || status === 'canceling') && (
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-900">
                  <strong>Próximo pagamento:</strong>{' '}
                  {format(new Date(confeitaria.data_proximo_pagamento), "d 'de' MMMM 'de' yyyy", {
                    locale: ptBR
                  })}
                </p>
                <p className="text-xs text-gray-700 mt-1">Valor: R$ 59,90/mês</p>
              </div>
            )}
        </CardContent>
      </Card>

      {/* Plano */}
      <Card>
        <CardHeader>
          <CardTitle>Plano CakeFlow Completo</CardTitle>
          <CardDescription>Sistema completo de gestão para confeitarias</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900">R$ 59,90</span>
            <span className="text-gray-600">/mês</span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <span>Gestão completa de pedidos</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <span>Cadastro ilimitado de produtos</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <span>Controle financeiro</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <span>Catálogo online personalizado</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <span>Relatórios e análises</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <span>Suporte prioritário</span>
            </div>
          </div>

          <div className="pt-4 border-t space-y-2">
            <Button
              onClick={handleOpenBilling}
              disabled={loading}
              className="w-full bg-gradient-to-r from-rose-500 to-rose-600"
            >
              {loading
                ? 'Processando...'
                : hasOngoingSubscription
                  ? 'Gerenciar Assinatura'
                  : status === 'canceled'
                    ? 'Assinar Novamente'
                    : 'Assinar o Plano'}
            </Button>
            {hasOngoingSubscription && !confeitaria?.data_proximo_pagamento && (
              <Button
                onClick={handleSyncSubscription}
                disabled={loading}
                variant="ghost"
                size="sm"
                className="w-full text-xs"
              >
                {loading ? 'Sincronizando...' : 'Sincronizar dados da assinatura'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
