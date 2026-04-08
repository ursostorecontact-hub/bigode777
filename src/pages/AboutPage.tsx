import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Target, Users, Zap, Heart, Globe, Shield } from 'lucide-react';
import { motion } from 'framer-motion';
import flashLogo from '@/assets/flash-logo.png';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const values = [
  { icon: Zap, title: 'Simplicidade', desc: 'Acreditamos que tecnologia deve ser fácil de usar. Criamos ferramentas intuitivas que qualquer equipe domina em minutos.' },
  { icon: Shield, title: 'Segurança', desc: 'Seus dados são sagrados. Investimos em criptografia de ponta e isolamento total entre empresas para garantir máxima proteção.' },
  { icon: Heart, title: 'Atendimento Humano', desc: 'Por trás da tecnologia, temos pessoas reais prontas para ajudar. Suporte em português com respostas rápidas.' },
  { icon: Globe, title: 'Inovação Local', desc: 'Desenvolvido no Brasil, para o mercado brasileiro. Entendemos as necessidades e desafios das equipes comerciais daqui.' },
];

export default function AboutPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-lg">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
            <img src={flashLogo} alt="Flash CRMs" className="h-8 w-8" />
            <span className="font-bold text-lg">Flash CRMs</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="gap-1">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <motion.div initial="hidden" animate="visible" variants={fadeUp}>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">Sobre o Flash CRMs</h1>
          <p className="text-lg text-muted-foreground leading-relaxed mb-10 max-w-3xl">
            Nascemos da frustração de equipes comerciais brasileiras que precisavam de um CRM simples, acessível e poderoso. Nosso objetivo é democratizar a gestão de vendas, oferecendo tecnologia de ponta sem a complexidade dos CRMs internacionais.
          </p>
        </motion.div>

        <motion.section initial="hidden" animate="visible" variants={fadeUp} className="mb-16">
          <h2 className="text-2xl font-bold mb-4">Nossa Missão</h2>
          <div className="bg-card border rounded-2xl p-8">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center shrink-0">
                <Target className="h-6 w-6 text-white" />
              </div>
              <p className="text-muted-foreground leading-relaxed text-lg">
                Ajudar empresas brasileiras a venderem mais e melhor, oferecendo uma plataforma completa de CRM com WhatsApp integrado, automações inteligentes e relatórios em tempo real. Acreditamos que toda equipe comercial merece ferramentas profissionais, independente do tamanho.
              </p>
            </div>
          </div>
        </motion.section>

        <motion.section initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="mb-16">
          <h2 className="text-2xl font-bold mb-6">Nossos Valores</h2>
          <div className="grid sm:grid-cols-2 gap-5">
            {values.map((v) => (
              <div key={v.title} className="bg-card border rounded-2xl p-6 hover:shadow-lg transition-all">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <v.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-bold mb-2">{v.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="mb-16">
          <h2 className="text-2xl font-bold mb-4">Nossa História</h2>
          <div className="space-y-4 text-muted-foreground leading-relaxed">
            <p>
              O Flash CRMs nasceu em 2024, quando um grupo de profissionais de tecnologia e vendas percebeu que os CRMs disponíveis no mercado brasileiro eram ou muito caros, ou muito complexos, ou simplesmente não atendiam às necessidades reais das equipes comerciais locais.
            </p>
            <p>
              Começamos ouvindo dezenas de gestores comerciais, vendedores e empreendedores para entender suas dores. A principal descoberta: eles precisavam de uma ferramenta que unisse gestão de leads, comunicação via WhatsApp e automação em um único lugar, sem precisar de treinamento extenso.
            </p>
            <p>
              Hoje, o Flash CRMs é utilizado por mais de 127 empresas em todo o Brasil, gerenciando milhões de reais em vendas e transformando a forma como equipes comerciais trabalham. E estamos apenas começando.
            </p>
          </div>
        </motion.section>

        <motion.section initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
          <h2 className="text-2xl font-bold mb-4">Números que nos orgulham</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { value: '127+', label: 'Empresas ativas' },
              { value: 'R$ 2.4M', label: 'Em vendas gerenciadas' },
              { value: '98%', label: 'Satisfação dos clientes' },
              { value: '24/7', label: 'Suporte disponível' },
            ].map((s) => (
              <div key={s.label} className="bg-card border rounded-2xl p-5 text-center">
                <div className="text-2xl font-bold text-primary">{s.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </motion.section>
      </div>
    </div>
  );
}
