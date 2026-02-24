import React, { useEffect } from 'react';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProdutosProntosTab from '@/components/produtos/ProdutosProntosTab';
import ProdutosPersonalizadosTab from '@/components/produtos/ProdutosPersonalizadosTab';

export default function Produtos() {
  const { user } = useAuth();

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
