import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';

export default function PWAUpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker
  } = useRegisterSW({
    onRegistered(sw) {
      // Verifica atualização a cada 60 segundos quando a aba está visível
      if (!sw) return;
      setInterval(() => {
        if (document.visibilityState === 'visible') {
          sw.update();
        }
      }, 60 * 1000);
    }
  });

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-lg border border-gray-700 max-w-sm w-[calc(100%-2rem)]">
      <RefreshCw className="w-4 h-4 shrink-0 text-rose-400" />
      <p className="text-sm flex-1 leading-tight">
        Nova versão disponível!
      </p>
      <button
        onClick={() => updateServiceWorker(true)}
        className="shrink-0 bg-rose-500 hover:bg-rose-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
      >
        Atualizar
      </button>
      <button
        onClick={() => setNeedRefresh(false)}
        className="shrink-0 text-gray-400 hover:text-white transition-colors"
        aria-label="Fechar"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
