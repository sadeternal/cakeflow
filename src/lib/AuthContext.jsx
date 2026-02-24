import React, { createContext, useState, useContext, useEffect } from 'react';
import { appClient } from '@/api/appClient';
import { isAuthError } from '@/lib/isAuthError';

const AuthContext = createContext();
const AUTH_CHECK_TIMEOUT_MS = 12000;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings] = useState(null);

  useEffect(() => {
    checkAppState();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleAuthCleared = () => {
      setUser(null);
      setIsAuthenticated(false);
      setAuthError({ type: 'auth_required', message: 'Authentication required' });
    };

    window.addEventListener('cakeflow:auth-cleared', handleAuthCleared);
    return () => window.removeEventListener('cakeflow:auth-cleared', handleAuthCleared);
  }, []);

  const checkAppState = async () => {
    setAuthError(null);
    await checkUserAuth();
  };

  const checkUserAuth = async () => {
    setIsLoadingAuth(true);
    try {
      const currentUser = await Promise.race([
        appClient.auth.me(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Auth check timeout')), AUTH_CHECK_TIMEOUT_MS)
        )
      ]);

      setUser(currentUser);
      setIsAuthenticated(true);
      setAuthError(null);
    } catch (error) {
      console.error('User auth check failed:', error);
      if (isAuthError(error)) {
        try {
          appClient.auth.completeAuthCallback?.();
          const retriedUser = await appClient.auth.me();
          setUser(retriedUser);
          setIsAuthenticated(true);
          setAuthError(null);
          return;
        } catch (retryError) {
          console.error('Retry auth check failed:', retryError);
          setIsAuthenticated(false);
          setAuthError({ type: 'auth_required', message: 'Authentication required' });
        }
      } else {
        setIsAuthenticated(false);
        setAuthError({ type: 'unknown', message: error?.message || 'Failed to validate session' });
      }
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);

    if (shouldRedirect) {
      appClient.auth.logout(window.location.href);
    } else {
      appClient.auth.logout();
    }
  };

  const navigateToLogin = () => {
    appClient.auth.redirectToLogin(window.location.href);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings,
        authError,
        appPublicSettings,
        logout,
        navigateToLogin,
        checkAppState
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
