import React from 'react';
import { AlertCircle, Settings, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function TrialExpiredModal({ onSubscribe, onLogout, isLoading }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
      <Card className="w-full max-w-md border-0 shadow-2xl">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-red-100 rounded-full">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
          </div>
          <CardTitle className="text-2xl">Período de Teste Expirado</CardTitle>
          <CardDescription>Sua avaliação gratuita de 7 dias terminou</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
            <p className="text-sm text-amber-900">
              Para continuar utilizando o CakeFlow e gerenciar sua confeitaria, é necessário contratar um plano.
            </p>
          </div>

          <div className="space-y-3">
            <Button
              onClick={onSubscribe}
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-rose-500 to-rose-600 h-11"
            >
              {isLoading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Aguarde...</>
              ) : (
                <><Settings className="w-4 h-4 mr-2" /> Ir para Assinaturas</>
              )}
            </Button>
            <Button
              onClick={onLogout}
              variant="outline"
              className="w-full h-11"
            >
              Sair
            </Button>
          </div>

          <div className="text-xs text-gray-500 text-center">
            Você poderá cancelar a qualquer momento. Sem compromisso.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
