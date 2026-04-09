import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Zap } from 'lucide-react';
import flashLogo from '@/assets/flash-logo.png';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedPlan = searchParams.get('plan') || 'basico';
  const { toast } = useToast();

  const [companyName, setCompanyName] = useState('');
  const [slug, setSlug] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleCompanyNameChange = (value: string) => {
    setCompanyName(value);
    setSlug(generateSlug(value));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName || !fullName || !email || !password || !slug) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }
    if (password.length < 6) {
      toast({ title: 'A senha deve ter pelo menos 6 caracteres', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      // 1. Sign up the user
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: window.location.origin,
        },
      });

      if (signUpError) throw signUpError;
      if (!signUpData.user) throw new Error('Erro ao criar conta');

      // 2. Sign in immediately to get a valid session
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        // If auto-confirm is off, user needs to confirm email first
        toast({
          title: 'Conta criada com sucesso!',
          description: 'Verifique seu email para confirmar o cadastro e depois faça login.',
        });
        navigate('/login');
        return;
      }

      // 3. Create tenant via edge function (uses service role to bypass RLS)
      const { data: result, error: fnError } = await supabase.functions.invoke('register-tenant', {
        body: { companyName, slug, plan: selectedPlan },
      });

      if (fnError) throw new Error(fnError.message || 'Erro ao criar empresa');
      if (result?.error) throw new Error(result.error);

      toast({
        title: 'Conta criada com sucesso!',
        description: 'Bem-vindo ao Flash CRMs!',
      });

      navigate('/dashboard');
    } catch (err: any) {
      console.error(err);
      const msg = err.message?.includes('slug') 
        ? 'Este slug de empresa já está em uso' 
        : err.message || 'Erro ao registrar';
      toast({ title: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const planLabels: Record<string, string> = {
    basico: 'Básico - R$99/mês',
    pro: 'Pro - R$199/mês',
    enterprise: 'Enterprise - R$499/mês',
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src={flashLogo} alt="Flash CRMs" className="h-12 w-12" />
          </div>
          <CardTitle className="text-2xl">Criar sua conta</CardTitle>
          <CardDescription>
            Plano selecionado: <span className="font-medium text-foreground">{planLabels[selectedPlan] || planLabels.basico}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da Empresa</Label>
              <Input
                value={companyName}
                onChange={(e) => handleCompanyNameChange(e.target.value)}
                placeholder="Minha Empresa Ltda"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Identificador (slug)</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="minha-empresa"
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">Será usado para identificar sua empresa no sistema</p>
            </div>
            <div className="space-y-2">
              <Label>Seu Nome Completo</Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="João Silva"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="joao@empresa.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Senha</Label>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
              Criar conta
            </Button>
            <p className="text-sm text-center text-muted-foreground">
              Já tem conta?{' '}
              <button type="button" onClick={() => navigate('/login')} className="text-primary hover:underline">
                Entrar
              </button>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
