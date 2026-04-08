import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import flashLogo from '@/assets/flash-logo.png';

export default function TermsPage() {
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
        <h1 className="text-3xl md:text-4xl font-bold mb-2">Termos de Uso</h1>
        <p className="text-muted-foreground mb-10">Última atualização: 08 de abril de 2026</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-bold mb-3">1. Aceitação dos Termos</h2>
            <p className="text-muted-foreground leading-relaxed">
              Ao acessar e utilizar a plataforma Flash CRMs, você concorda integralmente com estes Termos de Uso. Caso não concorde com algum dos termos apresentados, solicitamos que não utilize nossos serviços. O uso continuado da plataforma constitui aceitação vinculante de todas as condições aqui descritas.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3">2. Descrição do Serviço</h2>
            <p className="text-muted-foreground leading-relaxed">
              O Flash CRMs é uma plataforma de gestão de relacionamento com clientes (CRM) que oferece funcionalidades de gerenciamento de leads, pipeline de vendas, automação de mensagens, integração com WhatsApp, relatórios e gestão de equipes comerciais. O serviço é fornecido em modelo SaaS (Software as a Service) mediante assinatura mensal ou anual.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3">3. Cadastro e Conta do Usuário</h2>
            <p className="text-muted-foreground leading-relaxed">
              Para utilizar o Flash CRMs, é necessário criar uma conta fornecendo informações verdadeiras, completas e atualizadas. Você é responsável por manter a confidencialidade de suas credenciais de acesso e por todas as atividades realizadas em sua conta. Notifique-nos imediatamente caso suspeite de uso não autorizado.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3">4. Planos e Pagamentos</h2>
            <p className="text-muted-foreground leading-relaxed">
              Oferecemos diferentes planos de assinatura (Básico, Pro e Enterprise) com funcionalidades e limites específicos. Os preços estão sujeitos a alterações mediante aviso prévio de 30 dias. O período de teste gratuito de 3 dias não requer dados de pagamento. Após o período de teste, será necessário escolher um plano pago para continuar utilizando o serviço. Pagamentos são processados mensalmente ou anualmente, conforme o ciclo escolhido.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3">5. Uso Aceitável</h2>
            <p className="text-muted-foreground leading-relaxed">
              Ao utilizar o Flash CRMs, você concorda em: (a) não utilizar o serviço para envio de spam ou mensagens não solicitadas em massa; (b) não violar leis aplicáveis, incluindo a LGPD; (c) não tentar acessar dados de outros usuários ou empresas; (d) não realizar engenharia reversa ou tentar extrair o código-fonte da plataforma; (e) não utilizar o serviço para atividades fraudulentas ou ilegais.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3">6. Propriedade Intelectual</h2>
            <p className="text-muted-foreground leading-relaxed">
              Todo o conteúdo, design, código, marcas e materiais do Flash CRMs são de propriedade exclusiva da empresa. Os dados inseridos pelo usuário na plataforma permanecem de propriedade do usuário. Concedemos uma licença limitada, não exclusiva e não transferível para uso da plataforma durante a vigência da assinatura.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3">7. Cancelamento e Reembolso</h2>
            <p className="text-muted-foreground leading-relaxed">
              Você pode cancelar sua assinatura a qualquer momento através das configurações da conta. O cancelamento será efetivado ao final do período de faturamento vigente. Não oferecemos reembolsos proporcionais para períodos parciais, exceto nos primeiros 7 dias após a contratação de um plano pago, onde garantimos reembolso integral.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3">8. Limitação de Responsabilidade</h2>
            <p className="text-muted-foreground leading-relaxed">
              O Flash CRMs é fornecido "como está". Não garantimos disponibilidade ininterrupta do serviço, embora nos esforcemos para manter 99,9% de uptime. Em nenhuma hipótese seremos responsáveis por danos indiretos, incidentais, especiais ou consequenciais decorrentes do uso ou impossibilidade de uso da plataforma. Nossa responsabilidade total está limitada ao valor pago pelo usuário nos últimos 12 meses.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3">9. Modificações nos Termos</h2>
            <p className="text-muted-foreground leading-relaxed">
              Reservamo-nos o direito de alterar estes Termos de Uso a qualquer momento. Notificaremos os usuários sobre mudanças significativas por email ou através da plataforma com antecedência mínima de 15 dias. O uso continuado após as alterações constitui aceitação dos novos termos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3">10. Legislação Aplicável</h2>
            <p className="text-muted-foreground leading-relaxed">
              Estes Termos de Uso são regidos pela legislação brasileira. Qualquer disputa será submetida ao foro da comarca de São Paulo, SP, com exclusão de qualquer outro, por mais privilegiado que seja. Em caso de dúvidas, entre em contato pelo email: juridico@flashcrms.com.br
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
