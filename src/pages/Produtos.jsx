import React, { useEffect } from 'react';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProdutosProntosTab from '@/components/produtos/ProdutosProntosTab';
import ProdutosPersonalizadosTab from '@/components/produtos/ProdutosPersonalizadosTab';
import { useRegisterTour } from '@/lib/TourContext';
import { Package, Tag } from 'lucide-react';

const PRODUTOS_TOUR_SLIDES = [
  {
    icon: Package,
    title: 'Produtos Prontos',
    description: '"Produtos Prontos" são itens com valor fixo, podendo adicionar titulo, descrição e valor os produtos cadastrados são exibidos no seu catálogo online. Você ainda pode adicionar complementos opcionais melhorando ainda mais a experiência do seu cliente.',
    highlight: 'Produtos Prontos é uma boa opção para você que vende (bolos de pote, brownie, trufas, etc.)',
  },
  {
    icon: Package,
    title: 'Produtos Personalizados',
    description: '"Produtos Personalizados" O cliente pode montar seu produto de forma personalizada, você pode cadastrar e editar as etapas como tamanho, massas, recheios, coberturas, doces e salgados entre outros.',
    highlight: 'Produtos Personalizados é excelente para quem vende Bolos confeitados, agiliza o processo e a escolha dos ingredientes para o cliente.',
  },
  {
    icon: Tag,
    title: 'Organizando por Categorias',
    description: 'Crie categorias (ex: Bolos, Doces, Salgados) para organizar seus produtos no catálogo. As categorias aparecem como filtros para seus clientes quando eles visitam seu catálogo público.',
    highlight: 'Você pode criar e editar todas as categorias em Configurações > Produtos > Categorias.',
  },
];

export default function Produtos() {
  const { user } = useAuth();
  useRegisterTour('produtos', PRODUTOS_TOUR_SLIDES, !!user);

  useEffect(() => {
    if (user && !user.confeitaria_id) {
      window.location.href = createPageUrl('Onboarding');
    }
  }, [user]);

  if (!user) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          Você está visualizando a página de Produtos no modo público.
          Para gerenciar cadastro, estoque e preços, faça login.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="prontos" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="prontos">Produtos Prontos</TabsTrigger>
          <TabsTrigger value="personalizados">Produtos Personalizados</TabsTrigger>
        </TabsList>
        <TabsContent value="prontos" className="mt-6">
          <ProdutosProntosTab user={user} />
        </TabsContent>
        <TabsContent value="personalizados" className="mt-6">
          <ProdutosPersonalizadosTab user={user} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
