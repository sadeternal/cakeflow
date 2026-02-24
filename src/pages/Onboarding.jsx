import React, { useEffect, useState } from 'react';
import { appClient } from '@/api/appClient';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TelefoneInput } from '@/components/ui/masked-input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import CakeflowLogoIcon from '@/components/CakeflowLogoIcon';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  MapPin,
  Phone,
  Share2,
  Sparkles,
  Store
} from 'lucide-react';
import { createPageUrl } from '@/utils';
import { isAuthError } from '@/lib/isAuthError';

const PLANOS = [
  {
    id: 'mensal',
    nome: 'Plano Completo',
    preco: 'R$ 59,90/mês',
    descricao: 'Teste grátis por 7 dias. Depois, cobrança automática no cartão cadastrado.',
    beneficios: [
      'Pedidos e produção',
      'Catálogo online',
      'Financeiro e relatórios',
      'Suporte'
    ]
  }
];

const BILLING_READY_STATUSES = new Set(['trial', 'active', 'canceling', 'past_due', 'incomplete']);

const hasPaymentSetup = (confeitaria) =>
  Boolean(confeitaria?.stripe_subscription_id) &&
  BILLING_READY_STATUSES.has(confeitaria?.status_assinatura || 'trial');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const clearCheckoutQueryParam = () => {
  const params = new URLSearchParams(window.location.search);
  if (!params.has('checkout')) return;
  params.delete('checkout');
  const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
  window.history.replaceState({}, document.title, nextUrl);
};

const fetchConfeitariaById = async (confeitariaId) => {
  const list = await appClient.entities.Confeitaria.filter({ id: confeitariaId });
  return list[0] || null;
};

export default function Onboarding() {
  const { toast } = useToast();

  const getStoredPrefill = () => {
    try {
      const raw = window.localStorage.getItem('cakeflow_onboarding_prefill');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return {
        nome: parsed?.nome || '',
        telefone: parsed?.telefone || '',
        endereco: parsed?.endereco || '',
        instagram: parsed?.instagram || '',
        como_conheceu: parsed?.como_conheceu || ''
      };
    } catch {
      return null;
    }
  };

  const [step, setStep] = useState(1);
  const [user, setUser] = useState(null);
  const [confeitaria, setConfeitaria] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRedirectingCheckout, setIsRedirectingCheckout] = useState(false);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(PLANOS[0].id);
  const [checkoutNotice, setCheckoutNotice] = useState('');
  const [formData, setFormData] = useState(() => {
    const prefill = getStoredPrefill();
    return (
      prefill || {
        nome: '',
        telefone: '',
        endereco: '',
        instagram: '',
        como_conheceu: ''
      }
    );
  });

  const confirmarPagamento = async (confeitariaId, options = {}) => {
    const attempts = options.attempts || 8;
    const delayMs = options.delayMs || 2000;

    setIsCheckingPayment(true);
    try {
      let latest = null;

      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        const current = await fetchConfeitariaById(confeitariaId);
        latest = current;
        setConfeitaria(current);

        if (hasPaymentSetup(current)) {
          clearCheckoutQueryParam();
          window.location.href = createPageUrl('Dashboard');
          return true;
        }

        if (attempt < attempts) {
          await sleep(delayMs);
        }
      }

      setCheckoutNotice(
        'Pagamento recebido, mas ainda estamos aguardando confirmação final. Clique em "Já adicionei meu cartão" em alguns segundos.'
      );
      return false;
    } catch (error) {
      toast({
        title: 'Erro ao confirmar pagamento',
        description: error?.message || 'Não foi possível validar a assinatura agora.',
        variant: 'destructive'
      });
      return false;
    } finally {
      setIsCheckingPayment(false);
    }
  };

  const checkUser = async () => {
    try {
      const checkoutStatus = new URLSearchParams(window.location.search).get('checkout');
      const u = await appClient.auth.me();
      setUser(u);

      if (!u.confeitaria_id) {
        setLoading(false);
        return;
      }

      const conf = await fetchConfeitariaById(u.confeitaria_id);
      setConfeitaria(conf);

      if (hasPaymentSetup(conf)) {
        clearCheckoutQueryParam();
        window.location.href = createPageUrl('Dashboard');
        return;
      }

      setStep(3);

      if (checkoutStatus === 'success') {
        setCheckoutNotice('Confirmando seu pagamento...');
        await confirmarPagamento(u.confeitaria_id, { attempts: 10, delayMs: 1500 });
      } else if (checkoutStatus === 'canceled') {
        setCheckoutNotice('Checkout cancelado. Para concluir o cadastro, selecione um plano e adicione o cartão.');
      }

      clearCheckoutQueryParam();
    } catch (e) {
      if (isAuthError(e)) {
        appClient.auth.redirectToLogin(createPageUrl('Onboarding'));
        return;
      }

      console.error('Erro ao validar sessão no Onboarding:', e);
      toast({
        title: 'Erro no onboarding',
        description: e?.message || 'Não foi possível carregar os dados iniciais.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkUser();
  }, []);

  const createConfeitariaMutation = useMutation({
    mutationFn: async () => {
      const slug = formData.nome
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-');

      const existingConfeitarias = await appClient.entities.Confeitaria.filter({ slug });
      if (existingConfeitarias.length > 0) {
        throw new Error('Este nome já está em uso. Por favor, escolha um nome diferente para sua confeitaria.');
      }

      const dataFimTrial = new Date();
      dataFimTrial.setDate(dataFimTrial.getDate() + 7);

      const createdConfeitaria = await appClient.entities.Confeitaria.create({
        ...formData,
        slug,
        owner_email: user.email,
        status_assinatura: 'trial',
        data_fim_trial: dataFimTrial.toISOString()
      });

      await appClient.auth.updateMe({
        confeitaria_id: createdConfeitaria.id,
        onboarding_finalizado: false
      });

      await createInitialData(createdConfeitaria.id);

      return createdConfeitaria;
    },
    onSuccess: (createdConfeitaria) => {
      window.localStorage.removeItem('cakeflow_onboarding_prefill');
      setConfeitaria(createdConfeitaria);
      setStep(3);
      setCheckoutNotice('Confeitaria criada com sucesso. Agora selecione seu plano e adicione a forma de pagamento.');
    },
    onError: (error) => {
      toast({
        title: 'Erro ao criar confeitaria',
        description: error?.message || 'Não foi possível criar sua confeitaria.',
        variant: 'destructive'
      });
    }
  });

  const createInitialData = async (confeitariaId) => {
    await appClient.entities.Massa.bulkCreate([
      { confeitaria_id: confeitariaId, nome: 'Baunilha', valor_adicional: 0, ativo: true },
      { confeitaria_id: confeitariaId, nome: 'Chocolate', valor_adicional: 5, ativo: true },
      { confeitaria_id: confeitariaId, nome: 'Red Velvet', valor_adicional: 10, ativo: true }
    ]);

    await appClient.entities.Recheio.bulkCreate([
      { confeitaria_id: confeitariaId, nome: 'Brigadeiro', tipo: 'tradicional', valor_adicional: 0, ativo: true },
      { confeitaria_id: confeitariaId, nome: 'Beijinho', tipo: 'tradicional', valor_adicional: 0, ativo: true },
      { confeitaria_id: confeitariaId, nome: 'Ninho com Nutella', tipo: 'premium', valor_adicional: 15, ativo: true },
      { confeitaria_id: confeitariaId, nome: 'Frutas Vermelhas', tipo: 'especial', valor_adicional: 20, ativo: true }
    ]);

    await appClient.entities.Tamanho.bulkCreate([
      {
        confeitaria_id: confeitariaId,
        nome: 'P - 1kg (10 fatias)',
        tipo_medida: 'kg',
        quantidade_base: 1,
        valor_base: 80,
        max_recheios: 1,
        ativo: true
      },
      {
        confeitaria_id: confeitariaId,
        nome: 'M - 2kg (20 fatias)',
        tipo_medida: 'kg',
        quantidade_base: 2,
        valor_base: 150,
        max_recheios: 2,
        ativo: true
      },
      {
        confeitaria_id: confeitariaId,
        nome: 'G - 3kg (30 fatias)',
        tipo_medida: 'kg',
        quantidade_base: 3,
        valor_base: 220,
        max_recheios: 3,
        ativo: true
      }
    ]);

    await appClient.entities.Cobertura.bulkCreate([
      { confeitaria_id: confeitariaId, nome: 'Chantilly', valor_adicional: 0, observacoes: '', ativo: true },
      { confeitaria_id: confeitariaId, nome: 'Ganache', valor_adicional: 20, observacoes: '', ativo: true },
      {
        confeitaria_id: confeitariaId,
        nome: 'Pasta Americana',
        valor_adicional: 40,
        observacoes: 'Ideal para decorações elaboradas',
        ativo: true
      }
    ]);

    await appClient.entities.Extra.bulkCreate([
      {
        confeitaria_id: confeitariaId,
        nome: 'Topper Personalizado',
        valor: 15,
        valor_variavel: false,
        requer_observacao: true,
        ativo: true
      },
      {
        confeitaria_id: confeitariaId,
        nome: 'Escrita no Bolo',
        valor: 10,
        valor_variavel: false,
        requer_observacao: true,
        ativo: true
      },
      {
        confeitaria_id: confeitariaId,
        nome: 'Flores Comestíveis',
        valor: 25,
        valor_variavel: false,
        requer_observacao: false,
        ativo: true
      },
      {
        confeitaria_id: confeitariaId,
        nome: 'Taxa de Entrega',
        valor: 20,
        valor_variavel: true,
        requer_observacao: false,
        ativo: true
      }
    ]);
  };

  const handleIrParaPagamento = async () => {
    if (!confeitaria?.id) {
      toast({
        title: 'Confeitaria não encontrada',
        description: 'Finalize o cadastro da confeitaria antes de continuar.',
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsRedirectingCheckout(true);
      const response = await appClient.functions.invoke('createCheckoutSession', {
        confeitaria_id: confeitaria.id,
        plan: selectedPlan,
        trial_days: 7,
        success_path: '/Onboarding?checkout=success',
        cancel_path: '/Onboarding?checkout=canceled'
      });

      if (!response?.data?.url) {
        throw new Error('Não foi possível iniciar o checkout.');
      }

      window.location.href = response.data.url;
    } catch (error) {
      setIsRedirectingCheckout(false);
      toast({
        title: 'Erro ao iniciar pagamento',
        description: error?.message || 'Não foi possível abrir o checkout.',
        variant: 'destructive'
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-amber-50 flex items-center justify-center">
        <div className="animate-pulse">
          <CakeflowLogoIcon className="h-12 w-12" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-amber-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="flex justify-end mb-3">
          <Button
            variant="ghost"
            onClick={() => appClient.auth.logout(`${window.location.origin}/auth?force=1`)}
          >
            Sair
          </Button>
        </div>

        <div className="text-center mb-8">
          <CakeflowLogoIcon className="h-16 w-16 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900">CakeFlow</h1>
          <p className="text-gray-500 mt-2">Sistema completo para confeitarias</p>
        </div>

        <Card className="border-0 shadow-2xl shadow-rose-100/50">
          <CardContent className="p-8">
            {step === 1 && (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-rose-100 text-rose-600 text-sm font-medium mb-4">
                    <Sparkles className="w-4 h-4" />
                    Bem-vindo!
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">Vamos configurar sua confeitaria</h2>
                  <p className="text-gray-500 mt-2">
                    Olá, {user?.full_name}! Em poucos passos você terá seu sistema pronto.
                  </p>
                </div>
                <Button
                  onClick={() => setStep(2)}
                  className="w-full h-12 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white shadow-lg shadow-rose-200"
                >
                  Começar
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-1">Dados da Confeitaria</h2>
                  <p className="text-gray-500 text-sm">Preencha as informações básicas</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="nome" className="flex items-center gap-2 text-gray-700">
                      <Store className="w-4 h-4" />
                      Nome da Confeitaria *
                    </Label>
                    <Input
                      id="nome"
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      placeholder="Ex: Doces da Maria"
                      className="mt-1.5 h-12 border-gray-200 focus:border-rose-300 focus:ring-rose-200"
                    />
                  </div>

                  <div>
                    <Label htmlFor="telefone" className="flex items-center gap-2 text-gray-700">
                      <Phone className="w-4 h-4" />
                      WhatsApp
                    </Label>
                    <TelefoneInput
                      id="telefone"
                      value={formData.telefone}
                      onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                      placeholder="(00) 00000-0000"
                      className="mt-1.5 h-12 border-gray-200 focus:border-rose-300 focus:ring-rose-200"
                    />
                  </div>

                  <div>
                    <Label htmlFor="endereco" className="flex items-center gap-2 text-gray-700">
                      <MapPin className="w-4 h-4" />
                      Endereço
                    </Label>
                    <Input
                      id="endereco"
                      value={formData.endereco}
                      onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                      placeholder="Rua, número, bairro"
                      className="mt-1.5 h-12 border-gray-200 focus:border-rose-300 focus:ring-rose-200"
                    />
                  </div>

                  <div>
                    <Label htmlFor="instagram" className="text-gray-700">
                      Instagram
                    </Label>
                    <Input
                      id="instagram"
                      value={formData.instagram}
                      onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                      placeholder="@suaconfeitaria"
                      className="mt-1.5 h-12 border-gray-200 focus:border-rose-300 focus:ring-rose-200"
                    />
                  </div>

                  <div>
                    <Label htmlFor="como_conheceu" className="flex items-center gap-2 text-gray-700">
                      <Share2 className="w-4 h-4" />
                      Como conheceu o CakeFlow?
                    </Label>
                    <Select
                      value={formData.como_conheceu}
                      onValueChange={(value) => setFormData({ ...formData, como_conheceu: value })}
                    >
                      <SelectTrigger className="mt-1.5 h-12 border-gray-200 focus:border-rose-300 focus:ring-rose-200">
                        <SelectValue placeholder="Selecione uma opção" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="indicacao">Indicação</SelectItem>
                        <SelectItem value="facebook">Facebook</SelectItem>
                        <SelectItem value="instagram">Instagram</SelectItem>
                        <SelectItem value="pesquisa_google">Pesquisa Google</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button
                  onClick={() => createConfeitariaMutation.mutate()}
                  disabled={!formData.nome || createConfeitariaMutation.isPending}
                  className="w-full h-12 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white shadow-lg shadow-rose-200"
                >
                  {createConfeitariaMutation.isPending ? (
                    'Criando...'
                  ) : (
                    <>
                      Continuar para Plano
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-1">Plano e forma de pagamento</h2>
                  <p className="text-gray-500 text-sm">
                    Escolha seu plano e adicione o cartão para iniciar o teste gratuito de 7 dias.
                  </p>
                </div>

                {checkoutNotice && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{checkoutNotice}</span>
                  </div>
                )}

                <div className="space-y-3">
                  {PLANOS.map((plano) => (
                    <button
                      key={plano.id}
                      type="button"
                      onClick={() => setSelectedPlan(plano.id)}
                      className={`w-full rounded-xl border p-4 text-left transition-all ${
                        selectedPlan === plano.id
                          ? 'border-rose-400 bg-rose-50 shadow-sm'
                          : 'border-gray-200 bg-white hover:border-rose-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-gray-900">{plano.nome}</h3>
                          <p className="text-sm text-gray-600 mt-0.5">{plano.descricao}</p>
                        </div>
                        <span className="text-sm font-bold text-rose-600">{plano.preco}</span>
                      </div>
                      <div className="mt-3 space-y-1.5">
                        {plano.beneficios.map((beneficio) => (
                          <div key={beneficio} className="flex items-center gap-2 text-sm text-gray-700">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>{beneficio}</span>
                          </div>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                  Seu cartão será validado no checkout e a primeira cobrança ocorrerá automaticamente após 7 dias,
                  caso a assinatura permaneça ativa.
                </div>

                <div className="space-y-2">
                  <Button
                    onClick={handleIrParaPagamento}
                    disabled={isRedirectingCheckout || isCheckingPayment}
                    className="w-full h-12 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white shadow-lg shadow-rose-200"
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    {isRedirectingCheckout ? 'Abrindo checkout...' : 'Adicionar forma de pagamento'}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => confirmarPagamento(confeitaria?.id)}
                    disabled={isRedirectingCheckout || isCheckingPayment || !confeitaria?.id}
                    className="w-full"
                  >
                    {isCheckingPayment ? 'Verificando pagamento...' : 'Já adicionei meu cartão'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-sm text-gray-400 mt-6">
          Ao continuar, você concorda com nossos termos de uso
        </p>
      </div>
    </div>
  );
}
