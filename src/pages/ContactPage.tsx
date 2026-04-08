import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Mail, Phone, MapPin, Clock, MessageSquare } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { toast } from 'sonner';
import flashLogo from '@/assets/flash-logo.png';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const contactInfo = [
  { icon: Mail, title: 'Email', value: 'contato@flashcrms.com.br', desc: 'Resposta em até 24 horas' },
  { icon: Phone, title: 'Telefone', value: '(11) 4002-8922', desc: 'Seg a Sex, 9h às 18h' },
  { icon: MapPin, title: 'Endereço', value: 'São Paulo, SP - Brasil', desc: 'Atendimento 100% remoto' },
  { icon: Clock, title: 'Horário', value: 'Seg a Sex, 9h às 18h', desc: 'Suporte premium: 24/7' },
];

export default function ContactPage() {
  const navigate = useNavigate();
  const [sending, setSending] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setTimeout(() => {
      setSending(false);
      toast.success('Mensagem enviada com sucesso! Retornaremos em breve.');
    }, 1500);
  };

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
          <h1 className="text-3xl md:text-4xl font-bold mb-4">Fale Conosco</h1>
          <p className="text-lg text-muted-foreground leading-relaxed mb-10">
            Tem alguma dúvida, sugestão ou precisa de ajuda? Nossa equipe está pronta para atender você.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-10">
          <motion.div initial="hidden" animate="visible" variants={fadeUp}>
            <h2 className="text-xl font-bold mb-6">Envie uma mensagem</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Nome</label>
                  <Input placeholder="Seu nome" required />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Email</label>
                  <Input type="email" placeholder="seu@email.com" required />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Telefone</label>
                <Input placeholder="(11) 99999-9999" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Assunto</label>
                <Input placeholder="Como podemos ajudar?" required />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Mensagem</label>
                <Textarea placeholder="Descreva sua dúvida ou solicitação..." rows={5} required />
              </div>
              <Button type="submit" className="w-full h-12 gradient-cta border-0 text-white hover:opacity-90" disabled={sending}>
                {sending ? 'Enviando...' : 'Enviar mensagem'}
                <MessageSquare className="h-4 w-4 ml-2" />
              </Button>
            </form>
          </motion.div>

          <motion.div initial="hidden" animate="visible" variants={fadeUp} className="space-y-5">
            <h2 className="text-xl font-bold mb-6">Informações de contato</h2>
            {contactInfo.map((info) => (
              <div key={info.title} className="bg-card border rounded-2xl p-5 flex items-start gap-4 hover:shadow-md transition-all">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <info.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{info.title}</h3>
                  <p className="text-foreground text-sm">{info.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{info.desc}</p>
                </div>
              </div>
            ))}

            <div className="bg-card border rounded-2xl p-6 mt-6">
              <h3 className="font-bold mb-2">Suporte técnico</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Se você já é cliente, acesse a Central de Ajuda dentro da plataforma para suporte prioritário. Clientes do plano Enterprise contam com gerente de conta dedicado e suporte 24/7.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
