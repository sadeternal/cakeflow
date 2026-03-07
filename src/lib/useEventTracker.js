import { appClient } from '@/api/appClient';

/**
 * Hook para rastrear eventos do funil de conversão.
 * Falhas silenciosas — nunca interrompem a UX.
 */
export function useEventTracker() {
  const trackEvent = async (eventName, metadata = {}) => {
    try {
      await appClient.functions.invoke('trackEvent', {
        event_name: eventName,
        metadata,
      });
    } catch (e) {
      console.warn('[eventTracker]', eventName, e?.message ?? e);
    }
  };

  return { trackEvent };
}
