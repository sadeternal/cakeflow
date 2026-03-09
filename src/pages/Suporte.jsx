import React, { useState, useEffect } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { MessageCircle, Send, BookOpen, Video } from 'lucide-react';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const ASSUNTOS = [
  'Dúvidas sobre o sistema',
  'Problemas técnicos / Bugs',
  'Relatórios e análises',
  'Faturamento e pagamentos',
  'Cancelamento',
  'Melhorias e novidades',
  'Integração com outras plataformas',
  'Segurança e privacidade',
  'Treinamento/Onboarding',
  'Feedback geral',
];

export default function Suporte() {
  const primeirosPassosUrl = 'https://www.youtube.com/watch?v=L7PpgxdsZEc';
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    nome: '',
    confeitaria: '',
    assunto: '',
    mensagem: ''
  });

  useEffect(() => {
    if (!user) return;
    setFormData(prev => ({
      ...prev,
      nome: user.full_name || ''
    }));
  }, [user]);

  const { data: confeitaria } = useQuery({
    queryKey: ['confeitaria', user?.confeitaria_id],
    queryFn: async () => {
      if (!user?.confeitaria_id) return null;
      const list = await appClient.entities.Confeitaria.filter({ id: user.confeitaria_id });
      return list[0] || null;
    },
    enabled: !!user?.confeitaria_id,
    onSuccess: (data) => {
      if (data) {
        setFormData(prev => ({
          ...prev,
          confeitaria: data.nome || ''
        }));
      }
    }
  });

  useEffect(() => {
    if (confeitaria) {
      setFormData(prev => ({
        ...prev,
        confeitaria: confeitaria.nome || ''
      }));
    }
  }, [confeitaria]);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.nome || !formData.confeitaria || !formData.assunto || !formData.mensagem) {
      toast.error('Preencha todos os campos');
      return;
    }

    const numeroSuporte = '5575999501988';
    const mensagemWhatsApp = `*Solicitação de Suporte - CakeFlow*\n\n` +
      `*Nome:* ${formData.nome}\n` +
      `*Confeitaria:* ${formData.confeitaria}\n` +
      `*Assunto:* ${formData.assunto}\n\n` +
      `*Mensagem:*\n${formData.mensagem}`;

    const url = `https://wa.me/${numeroSuporte}?text=${encodeURIComponent(mensagemWhatsApp)}`;
    
    window.open(url, '_blank');
    
    // Limpar assunto e mensagem após envio
    setFormData(prev => ({
      ...prev,
      assunto: '',
      mensagem: ''
    }));
    
    toast.success('Redirecionando para o WhatsApp...');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Suporte</h1>
        <p className="text-gray-600">
          Entre em contato conosco ou acesse nossos tutoriais
        </p>
      </div>

      <Tabs defaultValue="atendimento" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="atendimento" className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4" />
            Atendimento
          </TabsTrigger>
          <TabsTrigger value="tutoriais" className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            Tutoriais
          </TabsTrigger>
        </TabsList>

        <TabsContent value="atendimento" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-rose-500" />
                Fale Conosco
              </CardTitle>
              <CardDescription>
                Envie sua mensagem e entraremos em contato pelo WhatsApp
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome Completo</Label>
                  <Input
                    id="nome"
                    placeholder="Seu nome completo"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confeitaria">Nome da Confeitaria</Label>
                  <Input
                    id="confeitaria"
                    placeholder="Nome da sua confeitaria"
                    value={formData.confeitaria}
                    onChange={(e) => setFormData({ ...formData, confeitaria: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Assunto</Label>
                  <Select
                    value={formData.assunto}
                    onValueChange={(value) => setFormData({ ...formData, assunto: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o assunto..." />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSUNTOS.map((assunto) => (
                        <SelectItem key={assunto} value={assunto}>
                          {assunto}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mensagem">Mensagem</Label>
                  <Textarea
                    id="mensagem"
                    placeholder="Descreva sua dúvida ou solicitação..."
                    value={formData.mensagem}
                    onChange={(e) => setFormData({ ...formData, mensagem: e.target.value })}
                    rows={6}
                    required
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Enviar via WhatsApp
                </Button>
              </form>

              <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-900">
                  <strong>Horário de atendimento:</strong> Segunda a Sexta, 9h às 18h
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  Você será redirecionado para o WhatsApp ao enviar sua mensagem
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tutoriais" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-rose-500" />
                Tutoriais e Guias
              </CardTitle>
              <CardDescription>
                Aprenda a usar todas as funcionalidades do CakeFlow
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div
                  className="p-6 border border-gray-200 rounded-lg hover:border-rose-300 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => window.open(primeirosPassosUrl, '_blank', 'noopener,noreferrer')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      window.open(primeirosPassosUrl, '_blank', 'noopener,noreferrer');
                    }
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-rose-100 rounded-lg">
                      <Video className="w-6 h-6 text-rose-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">
                        Primeiros Passos
                      </h3>
                      <p className="text-sm text-gray-600">
                        Aprenda a configurar sua confeitaria e criar seu primeiro pedido
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-6 border border-gray-200 rounded-lg hover:border-rose-300 hover:shadow-md transition-all cursor-pointer">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-rose-100 rounded-lg">
                      <Video className="w-6 h-6 text-rose-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">
                        Gerenciando Produtos
                      </h3>
                      <p className="text-sm text-gray-600">
                        Como cadastrar massas, recheios, coberturas e produtos prontos
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-6 border border-gray-200 rounded-lg hover:border-rose-300 hover:shadow-md transition-all cursor-pointer">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-rose-100 rounded-lg">
                      <Video className="w-6 h-6 text-rose-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">
                        Catálogo Online
                      </h3>
                      <p className="text-sm text-gray-600">
                        Personalize e compartilhe seu catálogo com clientes
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-sm text-amber-900">
                    <strong>Em breve:</strong> Vídeos tutoriais e documentação completa
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
