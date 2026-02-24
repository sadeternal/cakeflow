export const isAuthError = (error) => {
  const status = Number(error?.status ?? error?.response?.status);
  if (status === 401 || status === 403) return true;

  const message = String(
    error?.message ||
      error?.payload?.message ||
      error?.payload?.error_description ||
      error?.payload?.error ||
      ''
  ).toLowerCase();

  return (
    message.includes('unauthorized') ||
    message.includes('auth_required') ||
    message.includes('authentication required') ||
    message.includes('invalid jwt') ||
    message.includes('jwt expired') ||
    message.includes('sessão expirada') ||
    message.includes('session expired')
  );
};
