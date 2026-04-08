import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import flashLogo from '@/assets/flash-logo.png';

export default function PrivacyPage() {
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
        <h1 className="text-3xl md:text-4xl font-bold mb-2">Política de Privacidade</h1>
        <p className="text-muted-foreground mb-10">Última atualização: 08 de abril de 2026</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-bold mb-3">1. Introdução</h2>
            <p className="text-muted-foreground leading-relaxed">
              A Flash CRMs está comprometida com a proteção da privacidade dos seus usuários. Esta Política de Privacidade descreve como coletamos, utilizamos, armazenamos e protegemos suas informações pessoais em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018) e demais legislações aplicáveis.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3">2. Dados que Coletamos</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">Coletamos os seguintes tipos de dados:</p>
            <ul className="list-disc list-inside text-muted-foreground leading-relaxed space-y-2 ml-4">
              <li><strong>Dados de cadastro:</strong> nome completo, email, telefone, nome da empresa e cargo.</li>
              <li><strong>Dados de uso:</strong> informações sobre como você interage com a plataforma, páginas visitadas, funcionalidades utilizadas e horários de acesso.</li>
              <li><strong>Dados de leads e clientes:</strong> informações que você insere na plataforma sobre seus contatos comerciais.</li>
              <li><strong>Dados de comunicação:</strong> mensagens trocadas via integração WhatsApp, que ficam armazenadas de forma segura.</li>
              <li><strong>Dados técnicos:</strong> endereço IP, tipo de navegador, sistema operacional e informações do dispositivo.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3">3. Como Utilizamos seus Dados</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">Utilizamos seus dados para:</p>
            <ul className="list-disc list-inside text-muted-foreground leading-relaxed space-y-2 ml-4">
              <li>Fornecer, manter e melhorar nossos serviços.</li>
              <li>Processar pagamentos e gerenciar assinaturas.</li>
              <li>Enviar comunicações sobre o serviço, atualizações e novidades.</li>
              <li>Fornecer suporte técnico e atendimento ao cliente.</li>
              <li>Gerar relatórios e análises agregadas para melhoria da plataforma.</li>
              <li>Cumprir obrigações legais e regulatórias.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3">4. Compartilhamento de Dados</h2>
            <p className="text-muted-foreground leading-relaxed">
              Não vendemos, alugamos ou compartilhamos seus dados pessoais com terceiros para fins de marketing. Podemos compartilhar dados apenas com: (a) prestadores de serviços essenciais para operação da plataforma (hospedagem, processamento de pagamentos); (b) autoridades competentes quando exigido por lei; (c) em caso de fusão, aquisição ou venda de ativos, com notificação prévia aos usuários.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3">5. Armazenamento e Segurança</h2>
            <p className="text-muted-foreground leading-relaxed">
              Seus dados são armazenados em servidores seguros com criptografia em trânsito (TLS/SSL) e em repouso (AES-256). Implementamos medidas técnicas e organizacionais adequadas para proteger contra acesso não autorizado, alteração, divulgação ou destruição de dados. Cada empresa (tenant) possui isolamento completo de dados, garantindo que nenhuma organização acesse informações de outra.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3">6. Seus Direitos (LGPD)</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">De acordo com a LGPD, você tem direito a:</p>
            <ul className="list-disc list-inside text-muted-foreground leading-relaxed space-y-2 ml-4">
              <li><strong>Acesso:</strong> solicitar cópia dos seus dados pessoais armazenados.</li>
              <li><strong>Correção:</strong> solicitar a correção de dados incompletos ou desatualizados.</li>
              <li><strong>Exclusão:</strong> solicitar a eliminação dos seus dados pessoais.</li>
              <li><strong>Portabilidade:</strong> solicitar a transferência dos seus dados para outro fornecedor.</li>
              <li><strong>Revogação do consentimento:</strong> retirar seu consentimento a qualquer momento.</li>
              <li><strong>Oposição:</strong> opor-se ao tratamento de dados em determinadas circunstâncias.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3">7. Cookies e Tecnologias de Rastreamento</h2>
            <p className="text-muted-foreground leading-relaxed">
              Utilizamos cookies essenciais para o funcionamento da plataforma (autenticação e preferências de sessão) e cookies analíticos para entender como os usuários interagem com nosso serviço. Você pode gerenciar suas preferências de cookies nas configurações do navegador. Cookies essenciais não podem ser desabilitados, pois são necessários para o funcionamento básico do serviço.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3">8. Retenção de Dados</h2>
            <p className="text-muted-foreground leading-relaxed">
              Mantemos seus dados enquanto sua conta estiver ativa ou conforme necessário para fornecer nossos serviços. Após o cancelamento da conta, seus dados serão mantidos por 90 dias para permitir reativação e, em seguida, serão excluídos de forma segura. Dados necessários para cumprimento de obrigações legais poderão ser retidos por período adicional conforme exigido pela legislação.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3">9. Encarregado de Proteção de Dados (DPO)</h2>
            <p className="text-muted-foreground leading-relaxed">
              Para exercer qualquer um dos seus direitos ou para esclarecimentos sobre esta política, entre em contato com nosso Encarregado de Proteção de Dados pelo email: privacidade@flashcrms.com.br
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3">10. Alterações nesta Política</h2>
            <p className="text-muted-foreground leading-relaxed">
              Esta Política de Privacidade pode ser atualizada periodicamente. Notificaremos sobre alterações significativas por email ou por aviso na plataforma. Recomendamos revisar esta página regularmente para se manter informado sobre nossas práticas de privacidade.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
