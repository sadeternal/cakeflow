import { appClient } from '@/api/appClient';

export const syncClientToBrevo = async (payload, options = {}) => {
  const invoke = options.isPublic ? appClient.functions.invokePublic : appClient.functions.invoke;

  try {
    await invoke('syncBrevoClientContact', payload);
    return { success: true };
  } catch (error) {
    console.error('[brevo] Falha ao sincronizar contato:', error);
    return { success: false, error };
  }
};
