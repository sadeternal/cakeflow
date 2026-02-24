import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AuthPage from '@/pages/Auth';
import { appClient } from '@/api/appClient';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;
const CatalogoPage = Pages.Catalogo;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthCallbackPage = () => {
  const location = useLocation();

  useEffect(() => {
    appClient.auth.completeAuthCallback?.();

    const redirectParam = new URLSearchParams(location.search).get('redirect');
    const safeRedirect = redirectParam && redirectParam.startsWith(window.location.origin)
      ? redirectParam
      : `${window.location.origin}/`;

    window.location.replace(safeRedirect);
  }, [location.search]);

  return (
    <div className="fixed inset-0 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
    </div>
  );
};

const AuthenticatedApp = () => {
  const {
    isLoadingAuth,
    isLoadingPublicSettings,
    authError,
    isAuthenticated,
    navigateToLogin,
    checkAppState
  } = useAuth();
  const location = useLocation();
  const attemptedSessionRecoveryRef = useRef(false);
  const pathname = location.pathname.toLowerCase();
  const isPublicRoute =
    pathname.startsWith('/catalogo/') ||
    pathname.startsWith('/catalaogo/') ||
    pathname === '/produtos' ||
    pathname === '/suporte';

  useEffect(() => {
    if (isAuthenticated) {
      attemptedSessionRecoveryRef.current = false;
    }
  }, [isAuthenticated]);

  // Show loading spinner while checking app public settings or auth
  if (!isPublicRoute && (isLoadingPublicSettings || isLoadingAuth)) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (!isPublicRoute && authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      const isAuthRoute =
        location.pathname.startsWith('/auth/callback') || location.pathname.startsWith('/auth');
      const hasLocalToken =
        typeof window !== 'undefined' &&
        !!window.localStorage.getItem('supabase_access_token');

      // Avoid login loop in auth and callback routes.
      // Also avoid redirecting when auth state is already authenticated.
      if (!isAuthRoute && !isAuthenticated) {
        if (hasLocalToken && !attemptedSessionRecoveryRef.current) {
          attemptedSessionRecoveryRef.current = true;
          checkAppState();
          return (
            <div className="fixed inset-0 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
            </div>
          );
        }
        if (!hasLocalToken) {
          navigateToLogin();
          return null;
        }
      }
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/catalogo/:slug" element={CatalogoPage ? <CatalogoPage /> : <PageNotFound />} />
      <Route path="/catalaogo/:slug" element={CatalogoPage ? <CatalogoPage /> : <PageNotFound />} />
      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
          }
        />
      ))}
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NavigationTracker />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
