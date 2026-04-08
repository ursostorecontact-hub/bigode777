import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, BarChart3, Users, MessageSquare, Target, Shield, ArrowRight, Check, Star,
  ChevronDown, Building2, TrendingUp, Heart, Clock, CreditCard, Globe,
  UserPlus, Layers, Rocket, HelpCircle, Mail, Instagram, Linkedin, Facebook
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
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
  },
  {
    name: 'Carla Souza',
    company: 'Imobiliária Horizonte',
    text: 'A integração com WhatsApp foi um divisor de águas. Respondemos os clientes 5x mais rápido e fechamos 40% mais negócios. Recomendo para qualquer equipe comercial.',
    rating: 5,
    initials: 'CS',
  },
  {
    name: 'Fernando Lima',
    company: 'Tech Solutions BR',
    text: 'Migrei de um CRM internacional e economizei 60% no custo mensal. O Flash CRMs tem tudo que precisamos e o suporte em português faz toda a diferença.',
    rating: 5,
    initials: 'FL',
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
  { q: 'Preciso de cartão de crédito para começar?', a: 'Não! Você pode começar seu teste gratuito de 14 dias sem informar nenhum dado de pagamento. Só cobramos quando você decidir continuar.' },
  { q: 'Posso migrar meus dados de outro CRM?', a: 'Sim, oferecemos importação via CSV e nossa equipe ajuda gratuitamente na migração dos seus dados para o Flash CRMs.' },
  { q: 'O WhatsApp funciona com meu número atual?', a: 'Sim! Você conecta seu próprio número de WhatsApp via QR Code em menos de 2 minutos, sem precisar trocar de número.' },
  { q: 'Quantos usuários posso adicionar?', a: 'Depende do seu plano. O Básico suporta até 3 usuários, o Pro até 10, e o Enterprise tem usuários ilimitados.' },
  { q: 'Meus dados ficam seguros?', a: 'Absolutamente. Utilizamos criptografia de ponta a ponta e cada empresa tem seus dados completamente isolados. Seguimos as melhores práticas de segurança do mercado.' },
];

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] } },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

export default function LandingPage() {
  const navigate = useNavigate();
  const [annual, setAnnual] = useState(false);
  const [activeTestimonial, setActiveTestimonial] = useState(0);

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
            <Button size="sm" onClick={() => navigate('/registro')} className="gap-1">
              Começar grátis <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/5 to-[hsl(250,83%,60%)]/15 animate-[pulse_8s_ease-in-out_infinite]" />
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-[pulse_6s_ease-in-out_infinite]" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-[hsl(250,83%,60%)]/10 rounded-full blur-3xl animate-[pulse_8s_ease-in-out_infinite_2s]" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32 relative">
          <motion.div initial="hidden" animate="visible" variants={fadeUp} className="text-center max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-medium mb-6 border border-primary/20"
            >
              <Zap className="h-4 w-4" /> Novo: Integração com WhatsApp Business
            </motion.div>
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6">
              O CRM que acelera{' '}
              <span className="bg-gradient-to-r from-primary to-[hsl(250,83%,60%)] bg-clip-text text-transparent">
                suas vendas
              </span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Gerencie leads, pipeline, equipe e conversas do WhatsApp em um só lugar. Simples, rápido e poderoso.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                onClick={() => navigate('/registro')}
                className="text-base gap-2 animate-[pulse_3s_ease-in-out_infinite] shadow-lg shadow-primary/25"
              >
                Começar grátis por 14 dias <ArrowRight className="h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                className="text-base"
              >
                Ver recursos
              </Button>
            </div>

            {/* Trust badges */}
            <div className="flex flex-wrap justify-center gap-3 mt-8">
              <Badge variant="secondary" className="px-4 py-2 text-sm gap-2 bg-card border">
                <Shield className="h-4 w-4 text-primary" /> Garantia de 14 dias grátis
              </Badge>
              <Badge variant="secondary" className="px-4 py-2 text-sm gap-2 bg-card border">
                <CreditCard className="h-4 w-4 text-primary" /> Sem cartão de crédito
              </Badge>
              <Badge variant="secondary" className="px-4 py-2 text-sm gap-2 bg-card border">
                <MessageSquare className="h-4 w-4 text-primary" /> Suporte em português
              </Badge>
            </div>
          </motion.div>

          {/* Floating stat cards */}
          <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
            {[
              { value: '127', label: 'empresas ativas', icon: Building2 },
              { value: 'R$ 2.4M', label: 'em vendas gerenciadas', icon: TrendingUp },
              { value: '98%', label: 'de satisfação', icon: Heart },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.8 + i * 0.15 }}
                className="glass-card rounded-xl p-4 text-center hover:shadow-lg transition-all hover:-translate-y-1"
              >
                <stat.icon className="h-5 w-5 text-primary mx-auto mb-2" />
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Companies */}
      <section className="py-16 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.p
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
            className="text-center text-sm text-muted-foreground mb-8 font-medium uppercase tracking-wider"
          >
            Usado por empresas que crescem
          </motion.p>
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={staggerContainer}
            className="flex flex-wrap justify-center items-center gap-8 md:gap-16"
          >
            {fakeCompanies.map((c) => (
              <motion.div key={c.name} variants={fadeUp} className="flex items-center gap-2 text-muted-foreground/60 hover:text-muted-foreground transition">
                <c.icon className="h-6 w-6" />
                <span className="font-semibold text-lg">{c.name}</span>
              </motion.div>
            ))}
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
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={staggerContainer} className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <motion.div
                key={f.title}
                variants={fadeUp}
                className="bg-card border rounded-xl p-6 hover:shadow-lg transition-all hover:-translate-y-1 group"
              >
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition">
                  <f.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                <p className="text-muted-foreground text-sm">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Como funciona</h2>
            <p className="text-muted-foreground text-lg">Comece a vender mais em 3 passos simples</p>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={staggerContainer} className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { step: '1', icon: UserPlus, title: 'Crie sua conta em 2 minutos', desc: 'Cadastro rápido sem burocracia. Configure sua empresa e comece a usar imediatamente.' },
              { step: '2', icon: Users, title: 'Adicione sua equipe e leads', desc: 'Convide membros da equipe e importe seus contatos. Tudo organizado no pipeline.' },
              { step: '3', icon: Rocket, title: 'Venda mais com automações', desc: 'Configure follow-ups automáticos, integre o WhatsApp e veja suas vendas crescerem.' },
            ].map((s) => (
              <motion.div key={s.step} variants={fadeUp} className="text-center relative">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full gradient-primary text-primary-foreground text-2xl font-bold mb-6 shadow-lg shadow-primary/25">
                  {s.step}
                </div>
                <h3 className="font-semibold text-lg mb-2">{s.title}</h3>
                <p className="text-muted-foreground text-sm">{s.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">O que nossos clientes dizem</h2>
            <p className="text-muted-foreground text-lg">Empresas reais, resultados reais</p>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="max-w-3xl mx-auto">
            <div className="bg-card border rounded-2xl p-8 md:p-10 text-center relative">
              <div className="flex justify-center mb-4">
                {Array.from({ length: testimonials[activeTestimonial].rating }).map((_, i) => (
                  <Star key={i} className="h-5 w-5 text-warning fill-warning" />
                ))}
              </div>
              <p className="text-lg md:text-xl text-foreground mb-6 italic leading-relaxed">
                "{testimonials[activeTestimonial].text}"
              </p>
              <div className="flex items-center justify-center gap-3">
                <div className="h-12 w-12 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold">
                  {testimonials[activeTestimonial].initials}
                </div>
                <div className="text-left">
                  <div className="font-semibold">{testimonials[activeTestimonial].name}</div>
                  <div className="text-sm text-muted-foreground">{testimonials[activeTestimonial].company}</div>
                </div>
              </div>
              <div className="flex justify-center gap-2 mt-6">
                {testimonials.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveTestimonial(i)}
                    className={`w-2.5 h-2.5 rounded-full transition-all ${i === activeTestimonial ? 'bg-primary w-6' : 'bg-muted-foreground/30'}`}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Planos para cada tamanho de equipe</h2>
            <p className="text-muted-foreground text-lg mb-6">Comece grátis, escale quando precisar.</p>
            {/* Toggle */}
            <div className="inline-flex items-center gap-3 bg-muted rounded-full p-1">
              <button
                onClick={() => setAnnual(false)}
                className={`px-5 py-2 rounded-full text-sm font-medium transition ${!annual ? 'bg-card shadow text-foreground' : 'text-muted-foreground'}`}
              >
                Mensal
              </button>
              <button
                onClick={() => setAnnual(true)}
                className={`px-5 py-2 rounded-full text-sm font-medium transition flex items-center gap-2 ${annual ? 'bg-card shadow text-foreground' : 'text-muted-foreground'}`}
              >
                Anual <Badge className="text-xs bg-success text-success-foreground border-0">-20%</Badge>
              </button>
            </div>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={staggerContainer} className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-16">
            {plans.map((plan) => {
              const price = annual ? plan.annual : plan.monthly;
              return (
                <motion.div
                  key={plan.name}
                  variants={fadeUp}
                  className={`relative bg-card border rounded-2xl p-8 flex flex-col transition-all hover:shadow-lg ${plan.popular ? 'border-primary shadow-xl ring-2 ring-primary/20 scale-[1.02]' : ''}`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 gradient-primary text-primary-foreground text-xs font-bold px-4 py-1 rounded-full flex items-center gap-1 shadow-lg">
                      <Star className="h-3 w-3" /> MAIS POPULAR
                    </div>
                  )}
                  <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                  <div className="mb-6">
                    <span className="text-4xl font-extrabold">R${price}</span>
                    <span className="text-muted-foreground">/mês</span>
                    {annual && (
                      <div className="text-xs text-success font-medium mt-1">Economia de R${(plan.monthly - plan.annual) * 12}/ano</div>
                    )}
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
                    className={`w-full ${plan.popular ? 'shadow-lg shadow-primary/25' : ''}`}
                    onClick={() => navigate('/registro?plan=' + plan.name.toLowerCase())}
                  >
                    Começar agora
                  </Button>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Comparison table */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="max-w-4xl mx-auto">
            <h3 className="text-xl font-bold text-center mb-6">Comparação detalhada</h3>
            <div className="bg-card border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-4 font-semibold">Recurso</th>
                      <th className="text-center p-4 font-semibold">Básico</th>
                      <th className="text-center p-4 font-semibold text-primary">Pro</th>
                      <th className="text-center p-4 font-semibold">Enterprise</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonFeatures.map((f, i) => (
                      <tr key={f.name} className={i < comparisonFeatures.length - 1 ? 'border-b' : ''}>
                        <td className="p-4 font-medium">{f.name}</td>
                        <td className="p-4 text-center text-muted-foreground">{f.basic}</td>
                        <td className="p-4 text-center font-medium">{f.pro}</td>
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
      <section id="faq" className="py-20 bg-muted/30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Perguntas frequentes</h2>
            <p className="text-muted-foreground text-lg">Tire suas dúvidas sobre o Flash CRMs</p>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
            <Accordion type="single" collapsible className="space-y-3">
              {faqs.map((faq, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="bg-card border rounded-xl px-6 data-[state=open]:shadow-md transition-shadow">
                  <AccordionTrigger className="text-left font-medium hover:no-underline">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 gradient-primary opacity-[0.07]" />
        <div className="max-w-3xl mx-auto px-4 text-center relative">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-medium mb-6 border border-primary/20">
              <Clock className="h-4 w-4" /> Oferta por tempo limitado
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Comece hoje e veja resultados em 7 dias</h2>
            <p className="text-muted-foreground text-lg mb-8">
              Junte-se a centenas de empresas que já usam o Flash CRMs para fechar mais negócios. Teste grátis por 14 dias.
            </p>
            <Button
              size="lg"
              onClick={() => navigate('/registro')}
              className="text-base gap-2 shadow-lg shadow-primary/25 animate-[pulse_3s_ease-in-out_infinite]"
            >
              Criar conta grátis <ArrowRight className="h-5 w-5" />
            </Button>
            <div className="flex flex-wrap justify-center gap-4 mt-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><Check className="h-4 w-4 text-primary" /> 14 dias grátis</span>
              <span className="flex items-center gap-1"><Check className="h-4 w-4 text-primary" /> Sem cartão</span>
              <span className="flex items-center gap-1"><Check className="h-4 w-4 text-primary" /> Cancele quando quiser</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <img src={flashLogo} alt="Flash CRMs" className="h-8 w-8" />
                <span className="font-bold text-lg">Flash CRMs</span>
              </div>
              <p className="text-sm text-muted-foreground max-w-sm">
                O CRM brasileiro que acelera suas vendas. Gerencie leads, pipeline e WhatsApp em um só lugar.
              </p>
              <div className="flex gap-3 mt-4">
                <a href="#" className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition">
                  <Instagram className="h-4 w-4" />
                </a>
                <a href="#" className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition">
                  <Linkedin className="h-4 w-4" />
                </a>
                <a href="#" className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition">
                  <Facebook className="h-4 w-4" />
                </a>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-sm">Produto</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground transition">Recursos</a></li>
                <li><a href="#pricing" className="hover:text-foreground transition">Planos</a></li>
                <li><a href="#faq" className="hover:text-foreground transition">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-sm">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition">Sobre</a></li>
                <li><a href="#" className="hover:text-foreground transition">Contato</a></li>
                <li><a href="#" className="hover:text-foreground transition">Privacidade</a></li>
                <li><a href="#" className="hover:text-foreground transition">Termos de uso</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t mt-8 pt-8 text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} Flash CRMs. Todos os direitos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}
