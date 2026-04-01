import { Separator } from "@/components/ui/separator";
import { Shield, Lock, Eye, UserCheck, Database, Bell } from "lucide-react";

const PrivacidadeContent = () => {
  return (
    <div className="space-y-8 text-foreground">
      <section>
        <p className="text-muted-foreground leading-relaxed mb-3">
          A Prontìa Saúde está comprometida com a proteção da privacidade e dos dados pessoais de seus usuários. Esta Política de Privacidade descreve de forma clara e transparente como coletamos, utilizamos, armazenamos e protegemos informações pessoais e dados sensíveis de saúde no contexto da prestação de serviços de teleconsulta e atendimento digital.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          Nosso tratamento de dados observa rigorosamente a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018), o Marco Civil da Internet (Lei nº 12.965/2014), normas do Conselho Federal de Medicina e demais legislações aplicáveis ao setor de saúde.
        </p>
      </section>

      <Separator />

      <section>
        <h2 className="text-xl font-semibold mb-3">1. Princípios e Bases Legais Aplicáveis</h2>
        <p className="text-muted-foreground leading-relaxed mb-3">
          O tratamento de dados pessoais pela Prontìa Saúde segue os princípios da LGPD, incluindo finalidade, necessidade, minimização, adequação, transparência, prevenção, segurança, não discriminação e responsabilização.
        </p>
        <p className="text-muted-foreground leading-relaxed mb-3">A depender da finalidade, utilizamos as seguintes bases legais:</p>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
          <li><strong>Execução de contrato:</strong> para viabilizar o agendamento e a realização das teleconsultas.</li>
          <li><strong>Consentimento:</strong> para comunicações de marketing e uso de cookies opcionais.</li>
          <li><strong>Obrigação legal e regulatória:</strong> para cumprimento de normas médicas e sanitárias, guarda de prontuários e registros.</li>
          <li><strong>Legítimo interesse:</strong> para aperfeiçoamento da plataforma e segurança do ambiente digital.</li>
          <li><strong>Proteção da vida:</strong> em situações de risco, urgência ou emergência médica.</li>
        </ul>
      </section>

      <Separator />

      <section>
        <div className="flex items-center gap-3 mb-3">
          <Database className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-semibold">2. Dados Pessoais que Coletamos</h2>
        </div>

        <h3 className="font-semibold mt-4 mb-2">2.1. Dados de Cadastro</h3>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
          <li>Nome completo</li>
          <li>CPF</li>
          <li>Data de nascimento</li>
          <li>E-mail</li>
          <li>Telefone/WhatsApp</li>
          <li>Endereço completo</li>
        </ul>

        <h3 className="font-semibold mt-4 mb-2">2.2. Dados de Saúde (coletados exclusivamente para fins assistenciais)</h3>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
          <li>Informações clínicas fornecidas pelo paciente</li>
          <li>Sintomas relatados</li>
          <li>Alergias, medicamentos em uso e histórico de condições</li>
          <li>Registros de teleconsultas e atendimentos</li>
          <li>Atestados, prescrições e documentos médicos emitidos</li>
        </ul>

        <h3 className="font-semibold mt-4 mb-2">2.3. Dados de Navegação e Logs</h3>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
          <li>Endereço IP</li>
          <li>Dados de dispositivo e navegador</li>
          <li>Registros de acesso exigidos pelo Marco Civil da Internet</li>
          <li>Páginas acessadas, tempo de navegação e cookies essenciais</li>
        </ul>

        <h3 className="font-semibold mt-4 mb-2">2.4. Dados de Pagamento (tratados por processadores certificados)</h3>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
          <li>Identificação da transação</li>
          <li>Histórico de pagamentos e faturas</li>
        </ul>
        <p className="text-muted-foreground leading-relaxed mt-2">
          A Prontìa Saúde não armazena dados completos de cartão de crédito.
        </p>
      </section>

      <Separator />

      <section>
        <div className="flex items-center gap-3 mb-3">
          <Eye className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-semibold">3. Como Utilizamos os Dados</h2>
        </div>
        <p className="text-muted-foreground leading-relaxed mb-3">Utilizamos os dados pessoais para:</p>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
          <li>Criar, autenticar e administrar contas de usuários</li>
          <li>Agendar e realizar teleconsultas</li>
          <li>Permitir a comunicação entre pacientes e profissionais de saúde</li>
          <li>Emitir documentos médicos e registrar informações em prontuário eletrônico</li>
          <li>Processar pagamentos e emitir comprovantes</li>
          <li>Enviar notificações sobre atendimentos, prescrições e atualizações na plataforma</li>
          <li>Atender solicitações de suporte e pós-atendimento</li>
          <li>Cumprir obrigações legais e regulatórias</li>
          <li>Garantir segurança, prevenção a fraudes e integridade da plataforma</li>
          <li>Customizar e melhorar a experiência do usuário</li>
        </ul>
        <p className="text-muted-foreground leading-relaxed mt-3">
          Não utilizamos dados para fins discriminatórios, perfis indevidos ou qualquer finalidade incompatível com a atividade médica.
        </p>
      </section>

      <Separator />

      <section>
        <div className="flex items-center gap-3 mb-3">
          <UserCheck className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-semibold">4. Compartilhamento de Dados</h2>
        </div>
        <p className="text-muted-foreground leading-relaxed mb-3">O compartilhamento ocorre somente quando necessário e nos limites da LGPD:</p>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
          <li>Profissionais de saúde envolvidos diretamente no atendimento</li>
          <li>Plataformas e sistemas homologados para teleconsulta e prontuários</li>
          <li>Intermediadores de pagamento para processar transações</li>
          <li>Fornecedores de tecnologia que fornecem infraestrutura segura</li>
          <li>Autoridades públicas mediante determinação legal ou regulatória</li>
        </ul>
        <p className="text-muted-foreground leading-relaxed mt-3">
          A Prontìa Saúde não vende, não aluga e não comercializa dados pessoais para fins de marketing.
        </p>
      </section>

      <Separator />

      <section>
        <div className="flex items-center gap-3 mb-3">
          <Lock className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-semibold">5. Como Protegemos seus Dados</h2>
        </div>
        <p className="text-muted-foreground leading-relaxed mb-3">
          Adotamos medidas técnicas e administrativas compatíveis com a natureza sensível das informações:
        </p>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
          <li>Criptografia SSL/TLS</li>
          <li>Armazenamento seguro em servidores com padrões internacionais (ex. Supabase)</li>
          <li>Controle de acesso baseado em credenciais e registro de operações</li>
          <li>Monitoramento contínuo de segurança</li>
          <li>Backups rotineiros e plano de contingência</li>
          <li>Treinamento periódico da equipe</li>
          <li>Auditorias internas e externas</li>
        </ul>
        <p className="text-muted-foreground leading-relaxed mt-3">
          Se houver incidente com potencial risco ao titular, comunicaremos o usuário conforme a LGPD.
        </p>
      </section>

      <Separator />

      <section>
        <div className="flex items-center gap-3 mb-3">
          <Bell className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-semibold">6. Direitos do Titular de Dados</h2>
        </div>
        <p className="text-muted-foreground leading-relaxed mb-3">Você pode, a qualquer momento, solicitar:</p>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
          <li>Confirmação de tratamento</li>
          <li>Acesso aos dados pessoais e de saúde</li>
          <li>Correção de dados incorretos ou desatualizados</li>
          <li>Anonimização, bloqueio ou eliminação de dados desnecessários</li>
          <li>Portabilidade, quando aplicável</li>
          <li>Informação sobre compartilhamento</li>
          <li>Revogação do consentimento</li>
          <li>Oposição a tratamentos específicos</li>
        </ul>
        <p className="text-muted-foreground leading-relaxed mt-3">
          Para exercer seus direitos, envie uma solicitação ao nosso Encarregado (DPO).
        </p>
      </section>

      <Separator />

      <section>
        <h2 className="text-xl font-semibold mb-3">7. Retenção e Armazenamento de Dados</h2>
        <p className="text-muted-foreground leading-relaxed mb-3">Os prazos de guarda seguem a legislação e normas do setor de saúde:</p>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
          <li>Prontuário médico: mínimo de 20 anos, conforme Resolução CFM nº 1.821/2007</li>
          <li>Registros de acesso: 6 meses, conforme Marco Civil da Internet</li>
          <li>Demais dados: pelo tempo necessário ao cumprimento das finalidades</li>
        </ul>
        <p className="text-muted-foreground leading-relaxed mt-3">
          Após o período, os dados poderão ser anonimizados ou eliminados, salvo obrigação legal de preservação.
        </p>
      </section>

      <Separator />

      <section>
        <h2 className="text-xl font-semibold mb-3">8. Cookies e Tecnologias Semelhantes</h2>
        <p className="text-muted-foreground leading-relaxed mb-3">
          Utilizamos cookies para: garantir o funcionamento da plataforma, autenticar sessões, melhorar performance, e analisar tráfego (quando consentido). Cookies analíticos e de personalização são utilizados somente mediante autorização do usuário. O navegador permite desativar cookies, mas algumas funcionalidades podem ser prejudicadas.
        </p>
      </section>

      <Separator />

      <section>
        <h2 className="text-xl font-semibold mb-3">9. Reclamações e Contato com a Autoridade Nacional</h2>
        <p className="text-muted-foreground leading-relaxed">
          Caso entenda que seus direitos não foram atendidos, você pode registrar reclamação à Autoridade Nacional de Proteção de Dados (ANPD).
        </p>
      </section>

      <Separator />

      <section>
        <div className="flex items-center gap-3 mb-3">
          <Shield className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-semibold">10. Alterações desta Política</h2>
        </div>
        <p className="text-muted-foreground leading-relaxed mb-3">
          Esta Política poderá ser atualizada para refletir:
        </p>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
          <li>Mudanças legais ou regulatórias</li>
          <li>Adequações internas de governança e segurança</li>
          <li>Inclusão de novas funcionalidades na plataforma</li>
        </ul>
        <p className="text-muted-foreground leading-relaxed mt-3">
          Notificaremos alterações relevantes por meio do site ou dos nossos canais oficiais.
        </p>
      </section>
    </div>
  );
};

export default PrivacidadeContent;
