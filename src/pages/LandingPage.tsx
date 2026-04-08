import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Zap, BarChart3, Users, MessageSquare, Target, Shield, ArrowRight, Check, Star,
  Building2, TrendingUp, Heart, Clock, CreditCard, Globe,
  UserPlus, Layers, Rocket, Instagram, Linkedin, Facebook, Play, ChevronRight, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import flashLogo from '@/assets/flash-logo.png';

const features = [
  { icon: Target, title: 'Pipeline Visual', desc: 'Arraste e solte leads entre etapas do funil com facilidade.', color: 'from-blue-500 to-cyan-400' },
  { icon: MessageSquare, title: 'WhatsApp Integrado', desc: 'Converse com leads direto pelo CRM sem trocar de app.', color: 'from-emerald-500 to-green-400' },
  { icon: Users, title: 'Gestão de Equipe', desc: 'Distribua leads automaticamente e acompanhe performance.', color: 'from-violet-500 to-purple-400' },
  { icon: BarChart3, title: 'Relatórios Inteligentes', desc: 'Dashboards com métricas de conversão e receita em tempo real.', color: 'from-orange-500 to-amber-400' },
  { icon: Shield, title: 'Segurança Total', desc: 'Dados isolados por empresa com criptografia de ponta.', color: 'from-rose-500 to-pink-400' },
  { icon: Zap, title: 'Automações', desc: 'Automatize follow-ups, notificações e tarefas repetitivas.', color: 'from-yellow-500 to-orange-400' },
];

const plans = [
  {
    name: 'Básico',
    monthly: 99,
    annual: 79,
    features: ['Até 3 usuários', 'Pipeline visual', '500 leads/mês', 'WhatsApp (1 número)', 'Relatórios básicos', 'Suporte por email'],
    popular: false,
  },
  {
    name: 'Pro',
    monthly: 199,
    annual: 159,
    features: ['Até 10 usuários', 'Pipeline ilimitado', 'Leads ilimitados', 'WhatsApp (3 números)', 'Relatórios avançados', 'Automações', 'Integração Facebook', 'Suporte prioritário'],
    popular: true,
  },
  {
    name: 'Enterprise',
    monthly: 499,
    annual: 399,
    features: ['Usuários ilimitados', 'Tudo do Pro', 'API completa', 'WhatsApp ilimitado', 'Gerente de conta dedicado', 'SLA garantido', 'Treinamento personalizado', 'Suporte 24/7'],
    popular: false,
  },
];

const comparisonFeatures = [
  { name: 'Usuários', basic: 'Até 3', pro: 'Até 10', enterprise: 'Ilimitados' },
  { name: 'Leads', basic: '500/mês', pro: 'Ilimitados', enterprise: 'Ilimitados' },
  { name: 'WhatsApp', basic: '1 número', pro: '3 números', enterprise: 'Ilimitado' },
  { name: 'Pipeline', basic: '1 pipeline', pro: 'Ilimitados', enterprise: 'Ilimitados' },
  { name: 'Automações', basic: '—', pro: '✓', enterprise: '✓' },
  { name: 'Integração Facebook', basic: '—', pro: '✓', enterprise: '✓' },
  { name: 'API', basic: '—', pro: '—', enterprise: '✓' },
  { name: 'Gerente dedicado', basic: '—', pro: '—', enterprise: '✓' },
  { name: 'SLA', basic: '—', pro: '—', enterprise: '✓' },
];

const testimonials = [
  {
    name: 'Ricardo Mendes',
    company: 'AutoPeças Express',
    text: 'Depois que adotamos o Flash CRMs, nossa equipe de vendas dobrou a taxa de conversão em apenas 3 meses. O pipeline visual mudou completamente a forma como gerenciamos nossos leads.',
    rating: 5,
    initials: 'RM',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    name: 'Carla Souza',
    company: 'Imobiliária Horizonte',
    text: 'A integração com WhatsApp foi um divisor de águas. Respondemos os clientes 5x mais rápido e fechamos 40% mais negócios. Recomendo para qualquer equipe comercial.',
    rating: 5,
    initials: 'CS',
    color: 'from-violet-500 to-purple-500',
  },
  {
    name: 'Fernando Lima',
    company: 'Tech Solutions BR',
    text: 'Migrei de um CRM internacional e economizei 60% no custo mensal. O Flash CRMs tem tudo que precisamos e o suporte em português faz toda a diferença.',
    rating: 5,
    initials: 'FL',
    color: 'from-emerald-500 to-green-500',
  },
];

const fakeCompanies = [
  { name: 'NovaTech', icon: Layers },
  { name: 'SolBrasil', icon: TrendingUp },
  { name: 'UrbanFit', icon: Heart },
  { name: 'CloudPay', icon: CreditCard },
  { name: 'AgroMax', icon: Globe },
];

const faqs = [
  { q: 'Preciso de cartão de crédito para começar?', a: 'Não! Você pode começar seu teste gratuito de 3 dias sem informar nenhum dado de pagamento. Só cobramos quando você decidir continuar.' },
  { q: 'Posso migrar meus dados de outro CRM?', a: 'Sim, oferecemos importação via CSV e nossa equipe ajuda gratuitamente na migração dos seus dados para o Flash CRMs.' },
  { q: 'O WhatsApp funciona com meu número atual?', a: 'Sim! Você conecta seu próprio número de WhatsApp via QR Code em menos de 2 minutos, sem precisar trocar de número.' },
  { q: 'Quantos usuários posso adicionar?', a: 'Depende do seu plano. O Básico suporta até 3 usuários, o Pro até 10, e o Enterprise tem usuários ilimitados.' },
  { q: 'Meus dados ficam seguros?', a: 'Absolutamente. Utilizamos criptografia de ponta a ponta e cada empresa tem seus dados completamente isolados. Seguimos as melhores práticas de segurança do mercado.' },
  { q: 'Como funciona a distribuição de leads?', a: 'Você pode distribuir leads automaticamente entre sua equipe usando o modo Round-Robin (rodízio) ou por capacidade de cada vendedor. Também é possível atribuir leads manualmente pelo pipeline.' },
  { q: 'Posso cancelar minha assinatura a qualquer momento?', a: 'Sim, sem multa e sem burocracia. Basta acessar as configurações da conta e cancelar. O acesso continua até o fim do período já pago.' },
  { q: 'Vocês oferecem treinamento para minha equipe?', a: 'Sim! Todos os planos incluem acesso à Central de Ajuda com tutoriais. Clientes Pro recebem onboarding guiado e clientes Enterprise têm treinamento personalizado incluso.' },
  { q: 'É possível integrar com o Facebook Ads?', a: 'Sim, nos planos Pro e Enterprise você pode conectar suas campanhas do Facebook para capturar leads automaticamente e enviar dados de conversão via API.' },
  { q: 'O que acontece após os 3 dias grátis?', a: 'Após o período de teste, você escolhe o plano que melhor se encaixa na sua equipe. Caso não escolha, a conta é pausada (sem perder dados) até que um plano seja ativado.' },
];

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: 'easeOut' as const } },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

export default function LandingPage() {
  const navigate = useNavigate();
  const [annual, setAnnual] = useState(false);
  const [activeTestimonial, setActiveTestimonial] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <img src={flashLogo} alt="Flash CRMs" className="h-8 w-8" />
            <span className="font-bold text-lg">Flash CRMs</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm">
            <a href="#features" className="text-muted-foreground hover:text-foreground transition">Recursos</a>
            <a href="#how-it-works" className="text-muted-foreground hover:text-foreground transition">Como funciona</a>
            <a href="#pricing" className="text-muted-foreground hover:text-foreground transition">Planos</a>
            <a href="#faq" className="text-muted-foreground hover:text-foreground transition">FAQ</a>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>Entrar</Button>
            <Button size="sm" onClick={() => navigate('/registro')} className="gap-1 gradient-cta border-0 text-white hover:opacity-90">
              Começar grátis <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero - Dark bold section */}
      <section className="relative overflow-hidden gradient-hero text-white">
        {/* Animated orbs */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-10 left-[10%] w-80 h-80 bg-blue-500/20 rounded-full blur-[100px] animate-float" />
          <div className="absolute bottom-10 right-[10%] w-96 h-96 bg-violet-500/20 rounded-full blur-[100px] animate-float" style={{ animationDelay: '2s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px]" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28 lg:py-36 relative">
          <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="text-center max-w-4xl mx-auto">
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm text-white/90 px-4 py-1.5 rounded-full text-sm font-medium mb-8 border border-white/10">
              <Sparkles className="h-4 w-4 text-yellow-400" /> Novo: Integração com WhatsApp Business
            </motion.div>
            <motion.h1 variants={fadeUp} className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6 leading-[1.1]">
              O CRM que{' '}
              <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-pink-400 bg-clip-text text-transparent">
                acelera suas vendas
              </span>
            </motion.h1>
            <motion.p variants={fadeUp} className="text-lg md:text-xl text-white/70 mb-10 max-w-2xl mx-auto leading-relaxed">
              Gerencie leads, pipeline, equipe e conversas do WhatsApp em um só lugar. Simples, rápido e poderoso.
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                onClick={() => navigate('/registro')}
                className="text-base gap-2 gradient-cta border-0 text-white hover:opacity-90 h-14 px-8 text-lg animate-glow-pulse"
              >
                Começar grátis por 3 dias <ArrowRight className="h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                className="text-base border-white/20 text-white hover:bg-white/10 h-14 px-8 bg-transparent"
              >
                <Play className="h-4 w-4 mr-2" /> Ver como funciona
              </Button>
            </motion.div>

            {/* Trust badges */}
            <motion.div variants={fadeUp} className="flex flex-wrap justify-center gap-4 mt-10">
              {[
                { icon: Shield, text: 'Garantia de 3 dias grátis' },
                { icon: CreditCard, text: 'Sem cartão de crédito' },
                { icon: MessageSquare, text: 'Suporte em português' },
              ].map((badge) => (
                <div key={badge.text} className="flex items-center gap-2 text-white/60 text-sm">
                  <badge.icon className="h-4 w-4 text-blue-400" />
                  {badge.text}
                </div>
              ))}
            </motion.div>
          </motion.div>

          {/* Floating stat cards */}
          <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {[
              { value: '127', label: 'empresas ativas', icon: Building2, color: 'from-blue-500 to-cyan-400' },
              { value: 'R$ 2.4M', label: 'em vendas gerenciadas', icon: TrendingUp, color: 'from-emerald-500 to-green-400' },
              { value: '98%', label: 'de satisfação', icon: Heart, color: 'from-rose-500 to-pink-400' },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 1 + i * 0.15 }}
                className="glass-card-dark rounded-2xl p-5 text-center hover:scale-105 transition-transform animate-float"
                style={{ animationDelay: `${i * 1.5}s` }}
              >
                <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center mx-auto mb-3`}>
                  <stat.icon className="h-5 w-5 text-white" />
                </div>
                <div className="text-2xl font-bold text-white">{stat.value}</div>
                <div className="text-xs text-white/50 mt-1">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
        {/* Wave divider */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path d="M0 60L60 50C120 40 240 20 360 15C480 10 600 20 720 25C840 30 960 30 1080 25C1200 20 1320 10 1380 5L1440 0V60H0Z" fill="hsl(var(--background))" />
          </svg>
        </div>
      </section>

      {/* Companies */}
      <section className="py-14 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.p
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
            className="text-center text-xs text-muted-foreground mb-8 font-semibold uppercase tracking-[0.2em]"
          >
            Usado por empresas que crescem
          </motion.p>
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={staggerContainer}
            className="flex flex-wrap justify-center items-center gap-8 md:gap-14"
          >
            {fakeCompanies.map((c) => (
              <motion.div key={c.name} variants={fadeUp} className="flex items-center gap-2 text-muted-foreground/40 hover:text-muted-foreground/70 transition">
                <c.icon className="h-5 w-5" />
                <span className="font-bold text-lg tracking-tight">{c.name}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-16">
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/20 hover:bg-primary/10">Recursos</Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Tudo que sua equipe precisa</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Ferramentas poderosas para transformar leads em clientes fiéis.
            </p>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={staggerContainer} className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <motion.div
                key={f.title}
                variants={fadeUp}
                className="bg-card border rounded-2xl p-7 hover:shadow-xl transition-all hover:-translate-y-2 group relative overflow-hidden"
              >
                <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${f.color} opacity-5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:opacity-10 transition-opacity`} />
                <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-5 shadow-lg`}>
                  <f.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="font-bold text-lg mb-2">{f.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-24 bg-muted/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-16">
            <Badge className="mb-4 bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/10">3 Passos</Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Como funciona</h2>
            <p className="text-muted-foreground text-lg">Comece a vender mais em 3 passos simples</p>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={staggerContainer} className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto relative">
            {/* Connection lines (desktop) */}
            <div className="hidden md:block absolute top-[52px] left-[20%] right-[20%] h-0.5 bg-gradient-to-r from-blue-500 via-violet-500 to-emerald-500 opacity-20" />
            {[
              { step: '1', icon: UserPlus, title: 'Crie sua conta em 2 minutos', desc: 'Cadastro rápido sem burocracia. Configure sua empresa e comece a usar imediatamente.', color: 'from-blue-500 to-cyan-400' },
              { step: '2', icon: Users, title: 'Adicione sua equipe e leads', desc: 'Convide membros da equipe e importe seus contatos. Tudo organizado no pipeline.', color: 'from-violet-500 to-purple-400' },
              { step: '3', icon: Rocket, title: 'Venda mais com automações', desc: 'Configure follow-ups automáticos, integre o WhatsApp e veja suas vendas crescerem.', color: 'from-emerald-500 to-green-400' },
            ].map((s) => (
              <motion.div key={s.step} variants={fadeUp} className="text-center relative bg-card border rounded-2xl p-8 hover:shadow-lg transition-all">
                <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br ${s.color} text-white text-2xl font-bold mb-6 shadow-lg`}>
                  {s.step}
                </div>
                <h3 className="font-bold text-lg mb-3">{s.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-14">
            <Badge className="mb-4 bg-yellow-500/10 text-yellow-600 border-yellow-500/20 hover:bg-yellow-500/10">Depoimentos</Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">O que nossos clientes dizem</h2>
            <p className="text-muted-foreground text-lg">Empresas reais, resultados reais</p>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {testimonials.map((t, i) => (
                <motion.div
                  key={t.name}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15, duration: 0.5 }}
                  className={`bg-card border rounded-2xl p-7 relative transition-all hover:shadow-xl hover:-translate-y-1 ${i === activeTestimonial ? 'ring-2 ring-primary/30 shadow-lg' : ''}`}
                >
                  <div className="flex gap-1 mb-4">
                    {Array.from({ length: t.rating }).map((_, j) => (
                      <Star key={j} className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                    ))}
                  </div>
                  <p className="text-sm text-foreground mb-6 leading-relaxed">
                    "{t.text}"
                  </p>
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-full bg-gradient-to-br ${t.color} flex items-center justify-center text-white text-sm font-bold`}>
                      {t.initials}
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{t.name}</div>
                      <div className="text-xs text-muted-foreground">{t.company}</div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 bg-muted/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-10">
            <Badge className="mb-4 bg-violet-500/10 text-violet-600 border-violet-500/20 hover:bg-violet-500/10">Planos</Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Planos para cada tamanho de equipe</h2>
            <p className="text-muted-foreground text-lg mb-8">Comece grátis, escale quando precisar.</p>
            {/* Toggle */}
            <div className="inline-flex items-center gap-1 bg-card border rounded-full p-1.5 shadow-sm">
              <button
                onClick={() => setAnnual(false)}
                className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all ${!annual ? 'gradient-primary text-white shadow-md' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Mensal
              </button>
              <button
                onClick={() => setAnnual(true)}
                className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all flex items-center gap-2 ${annual ? 'gradient-primary text-white shadow-md' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Anual <span className="bg-emerald-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">-20%</span>
              </button>
            </div>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={staggerContainer} className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-16">
            {plans.map((plan) => {
              const price = annual ? plan.annual : plan.monthly;
              return (
                <motion.div
                  key={plan.name}
                  variants={fadeUp}
                  className={`relative bg-card rounded-2xl p-8 flex flex-col transition-all hover:shadow-xl ${
                    plan.popular
                      ? 'border-2 border-primary shadow-xl shadow-primary/10 scale-[1.03]'
                      : 'border hover:border-primary/30'
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 gradient-cta text-white text-xs font-bold px-5 py-1.5 rounded-full flex items-center gap-1 shadow-lg">
                      <Star className="h-3 w-3" /> MAIS POPULAR
                    </div>
                  )}
                  <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    {plan.name === 'Básico' && 'Para equipes pequenas'}
                    {plan.name === 'Pro' && 'Para equipes em crescimento'}
                    {plan.name === 'Enterprise' && 'Para grandes operações'}
                  </p>
                  <div className="mb-6">
                    <span className="text-5xl font-extrabold">R${price}</span>
                    <span className="text-muted-foreground text-sm">/mês</span>
                    {annual && (
                      <div className="text-xs text-emerald-500 font-semibold mt-1.5">
                        Economia de R${(plan.monthly - plan.annual) * 12}/ano
                      </div>
                    )}
                  </div>
                  <ul className="space-y-3.5 mb-8 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm">
                        <div className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${plan.popular ? 'bg-primary/10' : 'bg-muted'}`}>
                          <Check className={`h-3 w-3 ${plan.popular ? 'text-primary' : 'text-muted-foreground'}`} />
                        </div>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className={`w-full h-12 text-base font-semibold ${
                      plan.popular
                        ? 'gradient-cta border-0 text-white hover:opacity-90 shadow-lg shadow-primary/20'
                        : ''
                    }`}
                    variant={plan.popular ? 'default' : 'outline'}
                    onClick={() => navigate('/registro?plan=' + plan.name.toLowerCase())}
                  >
                    Começar agora <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Comparison table */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="max-w-4xl mx-auto">
            <h3 className="text-xl font-bold text-center mb-6">Comparação detalhada</h3>
            <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-4 font-semibold">Recurso</th>
                      <th className="text-center p-4 font-semibold">Básico</th>
                      <th className="text-center p-4 font-semibold text-primary">Pro ⭐</th>
                      <th className="text-center p-4 font-semibold">Enterprise</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonFeatures.map((f, i) => (
                      <tr key={f.name} className={`${i < comparisonFeatures.length - 1 ? 'border-b' : ''} hover:bg-muted/30 transition`}>
                        <td className="p-4 font-medium">{f.name}</td>
                        <td className="p-4 text-center text-muted-foreground">{f.basic}</td>
                        <td className="p-4 text-center font-semibold text-primary">{f.pro}</td>
                        <td className="p-4 text-center text-muted-foreground">{f.enterprise}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-14">
            <Badge className="mb-4 bg-orange-500/10 text-orange-600 border-orange-500/20 hover:bg-orange-500/10">FAQ</Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Perguntas frequentes</h2>
            <p className="text-muted-foreground text-lg">Tire suas dúvidas sobre o Flash CRMs</p>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
            <Accordion type="single" collapsible className="space-y-3">
              {faqs.map((faq, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="bg-card border rounded-2xl px-6 data-[state=open]:shadow-lg transition-all data-[state=open]:border-primary/20">
                  <AccordionTrigger className="text-left font-semibold hover:no-underline py-5">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground leading-relaxed pb-5">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 gradient-hero" />
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-10 left-[20%] w-60 h-60 bg-blue-500/15 rounded-full blur-[80px] animate-float" />
          <div className="absolute bottom-10 right-[20%] w-72 h-72 bg-violet-500/15 rounded-full blur-[80px] animate-float" style={{ animationDelay: '3s' }} />
        </div>
        <div className="max-w-3xl mx-auto px-4 text-center relative">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={staggerContainer}>
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm text-white/90 px-4 py-1.5 rounded-full text-sm font-medium mb-8 border border-white/10">
              <Clock className="h-4 w-4 text-yellow-400" /> Oferta por tempo limitado
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-bold mb-5 text-white">
              Comece hoje e veja resultados em 7 dias
            </motion.h2>
            <motion.p variants={fadeUp} className="text-white/60 text-lg mb-10 max-w-xl mx-auto">
              Junte-se a centenas de empresas que já usam o Flash CRMs para fechar mais negócios. Teste grátis por 3 dias.
            </motion.p>
            <motion.div variants={fadeUp}>
              <Button
                size="lg"
                onClick={() => navigate('/registro')}
                className="text-lg gap-2 gradient-cta border-0 text-white hover:opacity-90 h-14 px-10 animate-glow-pulse"
              >
                Criar conta grátis <ArrowRight className="h-5 w-5" />
              </Button>
            </motion.div>
            <motion.div variants={fadeUp} className="flex flex-wrap justify-center gap-6 mt-8 text-sm text-white/50">
              <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-emerald-400" /> 3 dias grátis</span>
              <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-emerald-400" /> Sem cartão</span>
              <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-emerald-400" /> Cancele quando quiser</span>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <img src={flashLogo} alt="Flash CRMs" className="h-8 w-8" />
                <span className="font-bold text-lg">Flash CRMs</span>
              </div>
              <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
                O CRM brasileiro que acelera suas vendas. Gerencie leads, pipeline e WhatsApp em um só lugar.
              </p>
              <div className="flex gap-3 mt-5">
                {[Instagram, Linkedin, Facebook].map((Icon, i) => (
                  <a key={i} href="#" className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-primary/10 hover:text-primary transition-all">
                    <Icon className="h-4 w-4" />
                  </a>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-bold mb-4 text-sm">Produto</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground transition">Recursos</a></li>
                <li><a href="#pricing" className="hover:text-foreground transition">Planos</a></li>
                <li><a href="#faq" className="hover:text-foreground transition">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4 text-sm">Legal</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li><a href="/sobre" className="hover:text-foreground transition">Sobre</a></li>
                <li><a href="/contato" className="hover:text-foreground transition">Contato</a></li>
                <li><a href="/privacidade" className="hover:text-foreground transition">Privacidade</a></li>
                <li><a href="/termos" className="hover:text-foreground transition">Termos de uso</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t mt-10 pt-8 text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} Flash CRMs. Todos os direitos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}
