import { useEffect, useMemo, useState } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { appClient } from '@/api/appClient';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Lock, Mail } from 'lucide-react';
import { createPageUrl } from '@/utils';
import googleIcon from '@/assets/google.svg';
import CakeflowLogoIcon from '@/components/CakeflowLogoIcon';

const readRedirect = (search) => {
  const value = new URLSearchParams(search).get('redirect');
  if (value && value.startsWith('/')) return `${window.location.origin}${value}`;
  if (value && value.startsWith(window.location.origin)) return value;
  return `${window.location.origin}/`;
};

const toRelativePath = (absoluteUrl) => {
  const parsed = new URL(absoluteUrl);
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
};

const CakeflowWordmark = () => (
  <div className="flex items-center justify-center gap-2.5">
    <CakeflowLogoIcon className="h-7 w-7" />
    <h1 className="text-[46px] leading-none font-semibold tracking-[-0.03em] text-[#2d2d32] sm:text-[48px]">
      Cakeflow
    </h1>
  </div>
);

export default function AuthPage() {
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState('login');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [signupData, setSignupData] = useState({
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);

  const redirectTo = useMemo(() => readRedirect(location.search), [location.search]);
  const forceAuth = useMemo(() => new URLSearchParams(location.search).get('force') === '1', [location.search]);

  useEffect(() => {
    setMode('login');
    document.title = 'Cakeflow | Login';
  }, [location.pathname, location.search]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const oauthError = params.get('oauth_error');
    if (!oauthError) return;

    toast({
      title: 'Falha no login com Google',
      description: oauthError,
      variant: 'destructive'
    });

    params.delete('oauth_error');
    const nextSearch = params.toString();
    const nextUrl = `${location.pathname}${nextSearch ? `?${nextSearch}` : ''}`;
    window.history.replaceState({}, document.title, nextUrl);
  }, [location.pathname, location.search, toast]);

  const getAuthErrorMessage = (error) => {
    const code = error?.payload?.error_code || error?.payload?.details?.error_code;
    if (code === 'user_already_exists') {
      return 'Este e-mail já está cadastrado. Use a tela de login.';
    }
    if (code === 'email_address_invalid') {
      return 'E-mail inválido. Verifique o endereço informado.';
    }
    if (code === 'over_email_send_rate_limit') {
      return 'Muitas tentativas de cadastro. Aguarde alguns minutos e tente novamente.';
    }
    if (code === 'weak_password') {
      return 'Senha fraca. Use pelo menos 8 caracteres com letras e números.';
    }
    return error?.message || 'Não foi possível concluir a operação.';
  };

  if (isAuthenticated && !forceAuth) {
    return <Navigate to={toRelativePath(redirectTo)} replace />;
  }

  const handleLogin = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await appClient.auth.signInWithPassword({
        email: loginData.email.trim(),
        password: loginData.password
      });
      window.location.replace(redirectTo);
    } catch (error) {
      toast({
        title: 'Falha no login',
        description: getAuthErrorMessage(error),
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignup = async (event) => {
    event.preventDefault();
    if (signupData.password !== signupData.confirmPassword) {
      toast({
        title: 'Senhas diferentes',
        description: 'A senha e a confirmação precisam ser iguais.',
        variant: 'destructive'
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = await appClient.auth.signUpWithPassword({
        email: signupData.email.trim(),
        password: signupData.password
      });

      if (!payload?.access_token) {
        toast({
          title: 'Cadastro criado',
          description: 'Verifique seu e-mail para confirmar a conta e depois faça login.'
        });
        setMode('login');
        return;
      }

      toast({
        title: 'Conta criada',
        description: 'Cadastro concluído. Vamos configurar sua confeitaria.'
      });
      window.location.replace(createPageUrl('Onboarding'));
    } catch (error) {
      const errorCode = error?.payload?.error_code || error?.payload?.details?.error_code;

      if (errorCode === 'over_email_send_rate_limit') {
        try {
          await appClient.auth.signInWithPassword({
            email: signupData.email.trim(),
            password: signupData.password
          });

          toast({
            title: 'Conta já existente',
            description: 'Você já tem acesso. Redirecionando para o onboarding.'
          });
          window.location.replace(createPageUrl('Onboarding'));
          return;
        } catch {
          setMode('login');
          setLoginData((prev) => ({ ...prev, email: signupData.email.trim() }));
        }
      }

      toast({
        title: 'Falha no cadastro',
        description: getAuthErrorMessage(error),
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = () => {
    appClient.auth.signInWithGoogle(redirectTo);
  };

  const handleForgotPassword = async (event) => {
    event.preventDefault();
    setIsSendingReset(true);
    try {
      await appClient.auth.resetPassword(forgotEmail);
      toast({
        title: 'E-mail enviado',
        description: 'Verifique sua caixa de entrada para redefinir sua senha.'
      });
      setForgotPasswordOpen(false);
      setForgotEmail('');
    } catch {
      toast({
        title: 'Erro ao enviar e-mail',
        description: 'Não foi possível enviar o link de recuperação. Tente novamente.',
        variant: 'destructive'
      });
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f2f0f3] px-4 py-8 sm:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[520px] flex-col items-center justify-center gap-7 sm:min-h-[calc(100vh-5rem)]">
        <CakeflowWordmark />

        <Card className="w-full max-w-[430px] rounded-[28px] border border-[#ececef] bg-[#f7f7f8] px-4 py-5 shadow-[0_20px_60px_rgba(0,0,0,0.10)] sm:px-6 sm:py-6">
          <CardContent className="p-0">
            {isAuthenticated && forceAuth && (
              <Button
                type="button"
                variant="destructive"
                className="mb-4 h-10 w-full rounded-xl"
                onClick={() => appClient.auth.logout()}
              >
                Sair da conta atual
              </Button>
            )}

            {mode === 'cadastro' ? (
              <form onSubmit={handleSignup} className="space-y-3.5">
                <div className="space-y-1.5">
                  <Label htmlFor="signup-email" className="text-[15px] font-medium text-[#3b3b40]">
                    E-mail
                  </Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9498a3]" />
                    <Input
                      id="signup-email"
                      className="h-11 rounded-xl border-[#e2e5ea] bg-[#e9edf1] pl-10 text-[15px] placeholder:text-[#9fa4ac]"
                      type="email"
                      autoComplete="email"
                      required
                      value={signupData.email}
                      onChange={(event) => setSignupData((prev) => ({ ...prev, email: event.target.value }))}
                      placeholder="exemplo@email.com"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="signup-password" className="text-[15px] font-medium text-[#3b3b40]">
                    Senha
                  </Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9498a3]" />
                    <Input
                      id="signup-password"
                      className="h-11 rounded-xl border-[#e2e5ea] bg-[#e9edf1] pl-10 text-[15px] placeholder:text-[#9fa4ac]"
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      required
                      value={signupData.password}
                      onChange={(event) => setSignupData((prev) => ({ ...prev, password: event.target.value }))}
                      placeholder="No mínimo 8 caracteres"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="signup-confirm-password" className="text-[15px] font-medium text-[#3b3b40]">
                    Confirmar senha
                  </Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9498a3]" />
                    <Input
                      id="signup-confirm-password"
                      className="h-11 rounded-xl border-[#e2e5ea] bg-[#e9edf1] pl-10 text-[15px] placeholder:text-[#9fa4ac]"
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      required
                      value={signupData.confirmPassword}
                      onChange={(event) =>
                        setSignupData((prev) => ({ ...prev, confirmPassword: event.target.value }))
                      }
                      placeholder="Repita sua senha"
                    />
                  </div>
                </div>

                <Button
                  disabled={isSubmitting}
                  type="submit"
                  className="mt-3 h-11 w-full rounded-xl bg-[#ef2b63] text-[15px] font-semibold text-white hover:bg-[#dc2458]"
                >
                  Criar Conta
                </Button>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="space-y-3.5">
                <div className="space-y-1.5">
                  <Label htmlFor="login-email" className="text-[15px] font-medium text-[#3b3b40]">
                    E-mail
                  </Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9498a3]" />
                    <Input
                      id="login-email"
                      className="h-11 rounded-xl border-[#e2e5ea] bg-[#e9edf1] pl-10 text-[15px] placeholder:text-[#9fa4ac]"
                      type="email"
                      autoComplete="email"
                      required
                      value={loginData.email}
                      onChange={(event) => setLoginData((prev) => ({ ...prev, email: event.target.value }))}
                      placeholder="exemplo@mail.com"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="login-password" className="text-[15px] font-medium text-[#3b3b40]">
                    Senha
                  </Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9498a3]" />
                    <Input
                      id="login-password"
                      className="h-11 rounded-xl border-[#e2e5ea] bg-[#e9edf1] pl-10 text-[15px] placeholder:text-[#9fa4ac]"
                      type="password"
                      autoComplete="current-password"
                      required
                      value={loginData.password}
                      onChange={(event) => setLoginData((prev) => ({ ...prev, password: event.target.value }))}
                      placeholder="sua senha"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-0.5">
                  <button
                    type="button"
                    className="text-xs font-medium text-[#ef2b63] hover:text-[#d92358]"
                    onClick={() => {
                      setForgotEmail(loginData.email);
                      setForgotPasswordOpen(true);
                    }}
                  >
                    Esqueci minha senha
                  </button>
                </div>

                <Button
                  disabled={isSubmitting}
                  type="submit"
                  className="mt-1 h-11 w-full rounded-xl bg-[#ef2b63] text-[15px] font-semibold text-white hover:bg-[#dc2458]"
                >
                  Entrar
                </Button>
              </form>
            )}

            <Button
              type="button"
              variant="outline"
              className="mt-3.5 h-11 w-full rounded-xl border-[#d6d8dd] bg-white text-[15px] font-semibold text-[#3c3d42] hover:bg-slate-50"
              onClick={handleGoogleLogin}
            >
              <img src={googleIcon} alt="" className="mr-2 h-4 w-4" aria-hidden="true" />
              Continuar com Google
            </Button>

            <p className="mt-7 text-center text-[15px] text-[#5a5d65]">
              {mode === 'cadastro' ? 'Já tem uma conta?' : 'Ainda não tem uma conta?'}{' '}
              <button
                type="button"
                className="font-semibold text-[#ef2b63] hover:text-[#d92358]"
                onClick={() => setMode(mode === 'cadastro' ? 'login' : 'cadastro')}
              >
                {mode === 'cadastro' ? 'Fazer login' : 'Criar conta'}
              </button>
            </p>
          </CardContent>
        </Card>
      </div>

      <Dialog open={forgotPasswordOpen} onOpenChange={setForgotPasswordOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-[18px] font-semibold text-[#2d2d32]">
              Recuperar senha
            </DialogTitle>
            <DialogDescription className="text-[14px] text-[#5a5d65]">
              Informe seu e-mail e enviaremos um link para redefinir sua senha.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleForgotPassword} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="forgot-email" className="text-[14px] font-medium text-[#3b3b40]">
                E-mail
              </Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9498a3]" />
                <Input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  required
                  className="h-11 rounded-xl border-[#e2e5ea] bg-[#e9edf1] pl-10 text-[15px] placeholder:text-[#9fa4ac]"
                  placeholder="exemplo@mail.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                />
              </div>
            </div>
            <Button
              type="submit"
              disabled={isSendingReset}
              className="h-11 w-full rounded-xl bg-[#ef2b63] text-[15px] font-semibold text-white hover:bg-[#dc2458]"
            >
              {isSendingReset ? 'Enviando...' : 'Enviar link de recuperação'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
