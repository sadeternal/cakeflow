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
  ArrowRight,
  MapPin,
  Phone,
  Share2,
  Sparkles,
  Store
} from 'lucide-react';
import { createPageUrl } from '@/utils';
import { isAuthError } from '@/lib/isAuthError';

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
  const [loading, setLoading] = useState(true);
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

  const checkUser = async () => {
    try {
      const u = await appClient.auth.me();
      setUser(u);

      if (!u.confeitaria_id) {
        setLoading(false);
        return;
      }

      window.location.href = createPageUrl('Dashboard');
      return;
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
      toast({
        title: 'Cadastro concluído',
        description: 'Seu trial gratuito de 7 dias começou. Você pode assinar depois em Configurações > Assinaturas.'
      });
      window.location.href = createPageUrl('Dashboard');
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
                      Finalizar cadastro
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
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
