import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { appClient } from '@/api/appClient';
import AssinaturasTab from '@/components/configuracoes/AssinaturasTab';
import { Loader2 } from 'lucide-react';

export default function Assinatura() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: confeitaria, refetch: refetchConfeitaria, isLoading } = useQuery({
    queryKey: ['confeitaria', user?.confeitaria_id],
    queryFn: async () => {
      const list = await appClient.entities.Confeitaria.filter({ id: user.confeitaria_id });
      return list[0] || null;
    },
    enabled: !!user?.confeitaria_id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <AssinaturasTab
        confeitaria={confeitaria}
        onUpdate={async () => {
          await refetchConfeitaria();
          queryClient.invalidateQueries({ queryKey: ['confeitaria'] });
        }}
      />
    </div>
  );
}
