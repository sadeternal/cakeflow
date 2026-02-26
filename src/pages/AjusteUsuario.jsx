import React, { useEffect, useState } from 'react';
import { appClient } from '@/api/appClient';
import { useAuth } from '@/lib/AuthContext';
import { Mail, Lock, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';

export default function AjusteUsuario() {
  const { user, checkAppState } = useAuth();
  const { toast } = useToast();
  const [fullName, setFullName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [email, setEmail] = useState('');
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    setFullName(user?.full_name || '');
    setEmail(user?.email || '');
  }, [user?.full_name, user?.email]);

  if (!user) return null;

  const handleSaveName = async (event) => {
    event.preventDefault();
    const normalizedName = fullName.trim();

    if (!normalizedName) {
      toast({
        title: 'Nome inválido',
        description: 'Preencha o nome para continuar.',
        variant: 'destructive'
      });
      return;
    }

    if (normalizedName === (user.full_name || '').trim()) {
      toast({
        title: 'Nenhuma alteração',
        description: 'O nome informado já é o nome atual da sua conta.'
      });
      return;
    }

    setIsSavingName(true);
    try {
      await appClient.auth.updateMe({ full_name: normalizedName });
      setFullName(normalizedName);
      await checkAppState();
      toast({
        title: 'Nome atualizado',
        description: 'Seu nome foi atualizado com sucesso.'
      });
    } catch (error) {
      toast({
        title: 'Erro ao atualizar nome',
        description: error?.message || 'Não foi possível atualizar o nome.',
        variant: 'destructive'
      });
    } finally {
      setIsSavingName(false);
    }
  };

  const handleSaveEmail = async (event) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      toast({
        title: 'E-mail inválido',
        description: 'Preencha um e-mail válido para continuar.',
        variant: 'destructive'
      });
      return;
    }

    if (normalizedEmail === (user.email || '').toLowerCase()) {
      toast({
        title: 'Nenhuma alteração',
        description: 'O e-mail informado já é o e-mail atual da sua conta.'
      });
      return;
    }

    setIsSavingEmail(true);
    try {
      await appClient.auth.updateAccount({ email: normalizedEmail });
      setEmail(normalizedEmail);
      toast({
        title: 'E-mail atualizado',
        description: 'A alteração do e-mail foi solicitada com sucesso. Se necessário, confirme no seu e-mail.'
      });
    } catch (error) {
      toast({
        title: 'Erro ao atualizar e-mail',
        description: error?.message || 'Não foi possível atualizar o e-mail.',
        variant: 'destructive'
      });
    } finally {
      setIsSavingEmail(false);
    }
  };

  const handleSavePassword = async (event) => {
    event.preventDefault();

    if (!passwordForm.newPassword || !passwordForm.confirmPassword) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha a nova senha e a confirmação.',
        variant: 'destructive'
      });
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast({
        title: 'Senha muito curta',
        description: 'Use pelo menos 6 caracteres na nova senha.',
        variant: 'destructive'
      });
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({
        title: 'As senhas não conferem',
        description: 'Digite a mesma senha nos dois campos.',
        variant: 'destructive'
      });
      return;
    }

    setIsSavingPassword(true);
    try {
      await appClient.auth.updateAccount({ password: passwordForm.newPassword });
      setPasswordForm({ newPassword: '', confirmPassword: '' });
      toast({
        title: 'Senha atualizada',
        description: 'Sua senha foi alterada com sucesso.'
      });
    } catch (error) {
      toast({
        title: 'Erro ao atualizar senha',
        description: error?.message || 'Não foi possível atualizar a senha.',
        variant: 'destructive'
      });
    } finally {
      setIsSavingPassword(false);
    }
  };

  const canDeleteAccount = deleteConfirmText.trim().toUpperCase() === 'EXCLUIR';

  const handleDeleteAccount = async () => {
    if (!canDeleteAccount || isDeletingAccount) return;

    setIsDeletingAccount(true);
    try {
      await appClient.functions.invoke('deleteAccount', {});
      toast({
        title: 'Conta excluída',
        description: 'Sua conta e todos os dados vinculados foram removidos com sucesso.'
      });
      await appClient.auth.logout(`${window.location.origin}/auth?mode=login`);
    } catch (error) {
      toast({
        title: 'Erro ao excluir conta',
        description:
          error?.message ||
          'Não foi possível excluir a conta agora. Tente novamente em instantes.',
        variant: 'destructive'
      });
    } finally {
      setIsDeletingAccount(false);
      setIsDeleteDialogOpen(false);
      setDeleteConfirmText('');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Card className="border-rose-100 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900">
            <User className="w-5 h-5 text-rose-500" />
            Ajuste de Usuário
          </CardTitle>
          <CardDescription>
            Gerencie os dados da sua conta, como e-mail e senha de acesso.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border-rose-100 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-900">
              <User className="w-5 h-5 text-rose-500" />
              Nome do usuário
            </CardTitle>
            <CardDescription>
              Este nome será exibido no sistema para identificar sua conta.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveName} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="account-name">Nome</Label>
                <Input
                  id="account-name"
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Digite seu nome"
                  disabled={isSavingName}
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={isSavingName}>
                  {isSavingName ? 'Salvando...' : 'Salvar nome'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="border-rose-100 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-900">
              <Mail className="w-5 h-5 text-rose-500" />
              E-mail da conta
            </CardTitle>
            <CardDescription>
              Use um e-mail válido para receber notificações e acessar o sistema.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveEmail} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="account-email">E-mail</Label>
                <Input
                  id="account-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="seuemail@dominio.com"
                  disabled={isSavingEmail}
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={isSavingEmail}>
                  {isSavingEmail ? 'Salvando...' : 'Salvar e-mail'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="border-rose-100 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-900">
              <Lock className="w-5 h-5 text-rose-500" />
              Alteração de senha
            </CardTitle>
            <CardDescription>
              Defina uma nova senha para manter sua conta segura.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSavePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">Nova senha</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={passwordForm.newPassword}
                  onChange={(event) =>
                    setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))
                  }
                  placeholder="Digite sua nova senha"
                  disabled={isSavingPassword}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar nova senha</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={passwordForm.confirmPassword}
                  onChange={(event) =>
                    setPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))
                  }
                  placeholder="Repita sua nova senha"
                  disabled={isSavingPassword}
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={isSavingPassword}>
                  {isSavingPassword ? 'Atualizando...' : 'Atualizar senha'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="border-red-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-red-700">Excluir conta</CardTitle>
            <CardDescription>
              Esta ação remove permanentemente sua conta, confeitaria, pedidos, clientes, produtos e
              demais dados vinculados.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-end">
            <Button
              type="button"
              variant="destructive"
              onClick={() => setIsDeleteDialogOpen(true)}
              disabled={isDeletingAccount}
            >
              {isDeletingAccount ? 'Excluindo...' : 'Excluir conta'}
            </Button>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão permanente</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. Para confirmar, digite <strong>EXCLUIR</strong> abaixo.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <Label htmlFor="delete-account-confirm">Confirmação</Label>
            <Input
              id="delete-account-confirm"
              value={deleteConfirmText}
              onChange={(event) => setDeleteConfirmText(event.target.value)}
              placeholder="Digite EXCLUIR"
              disabled={isDeletingAccount}
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingAccount}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleDeleteAccount();
              }}
              className="bg-red-600 hover:bg-red-700"
              disabled={!canDeleteAccount || isDeletingAccount}
            >
              {isDeletingAccount ? 'Excluindo...' : 'Confirmar exclusão'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
