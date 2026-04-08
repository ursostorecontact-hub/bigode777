import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, BarChart3, Users, MessageSquare, Target, Shield, ArrowRight, Check, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import flashLogo from '@/assets/flash-logo.png';

const features = [
  { icon: Target, title: 'Pipeline Visual', desc: 'Arraste e solte leads entre etapas do funil com facilidade.' },
  { icon: MessageSquare, title: 'WhatsApp Integrado', desc: 'Converse com leads direto pelo CRM sem trocar de app.' },
  { icon: Users, title: 'Gestão de Equipe', desc: 'Distribua leads automaticamente e acompanhe performance.' },
  { icon: BarChart3, title: 'Relatórios Inteligentes', desc: 'Dashboards com métricas de conversão e receita em tempo real.' },
  { icon: Shield, title: 'Segurança Total', desc: 'Dados isolados por empresa com criptografia de ponta.' },
  { icon: Zap, title: 'Automações', desc: 'Automatize follow-ups, notificações e tarefas repetitivas.' },
];

const plans = [
  {
    name: 'Básico',
    price: 99,
    features: ['Até 3 usuários', 'Pipeline visual', '500 leads/mês', 'WhatsApp (1 número)', 'Relatórios básicos', 'Suporte por email'],
    popular: false,
  },
  {
    name: 'Pro',
    price: 199,
    features: ['Até 10 usuários', 'Pipeline ilimitado', 'Leads ilimitados', 'WhatsApp (3 números)', 'Relatórios avançados', 'Automações', 'Integração Facebook', 'Suporte prioritário'],
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 499,
    features: ['Usuários ilimitados', 'Tudo do Pro', 'API completa', 'WhatsApp ilimitado', 'Gerente de conta dedicado', 'SLA garantido', 'Treinamento personalizado', 'Suporte 24/7'],
    popular: false,
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <img src={flashLogo} alt="Flash CRMs" className="h-8 w-8" />
            <span className="font-bold text-lg">Flash CRMs</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm">
            <a href="#features" className="text-muted-foreground hover:text-foreground transition">Recursos</a>
            <a href="#pricing" className="text-muted-foreground hover:text-foreground transition">Planos</a>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>Entrar</Button>
            <Button size="sm" onClick={() => navigate('/registro')} className="gap-1">
              Começar agora <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32 relative">
          <motion.div initial="hidden" animate="visible" variants={fadeUp} className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-medium mb-6">
              <Zap className="h-4 w-4" /> Novo: Integração com WhatsApp Business
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 bg-gradient-to-r from-foreground via-foreground to-primary bg-clip-text">
              Flash CRMs — O CRM que acelera suas vendas
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Gerencie leads, pipeline, equipe e conversas do WhatsApp em um só lugar. Simples, rápido e poderoso.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" onClick={() => navigate('/registro')} className="text-base gap-2">
                Começar grátis por 14 dias <ArrowRight className="h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })} className="text-base">
                Ver recursos
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-4">Sem cartão de crédito • Setup em 2 minutos</p>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Tudo que sua equipe precisa</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Ferramentas poderosas para transformar leads em clientes fiéis.
            </p>
          </motion.div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={{ ...fadeUp, visible: { ...fadeUp.visible, transition: { duration: 0.6, delay: i * 0.1 } } }}
                className="bg-card border rounded-xl p-6 hover:shadow-lg transition-shadow"
              >
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <f.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                <p className="text-muted-foreground text-sm">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Planos para cada tamanho de equipe</h2>
            <p className="text-muted-foreground text-lg">Comece grátis, escale quando precisar.</p>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan, i) => (
              <motion.div
                key={plan.name}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={{ ...fadeUp, visible: { ...fadeUp.visible, transition: { duration: 0.6, delay: i * 0.15 } } }}
                className={`relative bg-card border rounded-2xl p-8 flex flex-col ${plan.popular ? 'border-primary shadow-xl scale-105' : ''}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-4 py-1 rounded-full flex items-center gap-1">
                    <Star className="h-3 w-3" /> MAIS POPULAR
                  </div>
                )}
                <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                <div className="mb-6">
                  <span className="text-4xl font-extrabold">R${plan.price}</span>
                  <span className="text-muted-foreground">/mês</span>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  variant={plan.popular ? 'default' : 'outline'}
                  className="w-full"
                  onClick={() => navigate('/registro?plan=' + plan.name.toLowerCase())}
                >
                  Começar agora
                </Button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-primary/5">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Pronto para acelerar suas vendas?</h2>
            <p className="text-muted-foreground text-lg mb-8">
              Junte-se a centenas de empresas que já usam o Flash CRMs para fechar mais negócios.
            </p>
            <Button size="lg" onClick={() => navigate('/registro')} className="text-base gap-2">
              Criar conta grátis <ArrowRight className="h-5 w-5" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src={flashLogo} alt="Flash CRMs" className="h-6 w-6" />
            <span className="font-semibold">Flash CRMs</span>
          </div>
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Flash CRMs. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
