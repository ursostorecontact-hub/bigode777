import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import flashLogo from '@/assets/flash-logo.png';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const { signIn } = useAuth();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await signIn(email, password);
      toast({ title: 'Login realizado com sucesso!' });
    } catch (err) {
      console.error('Erro no login:', err);
      const message = err instanceof Error ? err.message : 'Verifique suas credenciais.';
      toast({ title: 'Erro ao fazer login', description: message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast({ title: 'E-mail enviado!', description: 'Verifique sua caixa de entrada para redefinir a senha.' });
      setIsRecovery(false);
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível enviar o e-mail de recuperação.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="flex flex-col items-center mb-8">
          <div className="h-24 w-24 rounded-2xl bg-background flex items-center justify-center mb-4">
            <img src={flashLogo} alt="Flash CRMs" width={80} height={80} />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Flash CRMs</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie seus leads e vendas</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{isRecovery ? 'Recuperar Senha' : 'Entrar'}</CardTitle>
            <CardDescription>
              {isRecovery ? 'Informe seu e-mail para receber o link de recuperação' : 'Faça login para acessar o sistema'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={isRecovery ? handleRecovery : handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              {!isRecovery && (
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <PasswordInput id="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
              )}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isRecovery ? 'Enviar Link' : 'Entrar'}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => setIsRecovery(!isRecovery)}>
                {isRecovery ? 'Voltar ao login' : 'Esqueceu a senha?'}
              </Button>
              <p className="text-sm text-center text-muted-foreground">
                Não tem conta?{' '}
                <a href="/registro" className="text-primary hover:underline">Criar conta</a>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
