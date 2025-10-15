import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const Termos = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center">
              Termos de Uso
            </CardTitle>
            <p className="text-muted-foreground text-center mt-2">
              Última atualização: 02 de outubro de 2025
            </p>
          </CardHeader>
          <CardContent className="space-y-8 text-foreground">
            <section>
              <h2 className="text-xl font-semibold mb-3">1. Aceitação dos Termos</h2>
              <p className="text-muted-foreground leading-relaxed">
                Ao acessar e utilizar a plataforma Prontia Saúde, você concorda com estes Termos de Uso e com nossa Política de Privacidade. Se você não concordar com algum dos termos, não utilize nossos serviços.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">2. Sobre o Serviço</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                A Prontia Saúde é uma plataforma digital que conecta pacientes a profissionais de saúde qualificados através de consultas médicas online (telemedicina). Nossos serviços incluem:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>Consultas médicas por videochamada</li>
                <li>Atendimento psicológico online</li>
                <li>Consultas com nutricionistas</li>
                <li>Serviços de fisioterapia remota</li>
                <li>Emissão de receitas e atestados digitais</li>
                <li>Acompanhamento de saúde mental</li>
              </ul>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">3. Cadastro e Conta de Usuário</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                Para utilizar nossos serviços, você deve:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>Ser maior de 18 anos ou ter autorização dos responsáveis legais</li>
                <li>Fornecer informações verdadeiras, precisas e atualizadas</li>
                <li>Manter a confidencialidade de suas credenciais de acesso</li>
                <li>Notificar imediatamente sobre qualquer uso não autorizado de sua conta</li>
                <li>Atualizar seus dados cadastrais sempre que necessário</li>
              </ul>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">4. Uso da Plataforma</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                Ao utilizar a Prontia Saúde, você se compromete a:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>Utilizar os serviços apenas para fins legítimos</li>
                <li>Não compartilhar sua conta com terceiros</li>
                <li>Respeitar os profissionais de saúde e outros usuários</li>
                <li>Não utilizar a plataforma para emergências médicas (ligue 192)</li>
                <li>Fornecer informações médicas precisas e completas</li>
                <li>Comparecer às consultas agendadas ou cancelar com antecedência mínima</li>
              </ul>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">5. Responsabilidades Médicas</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                É importante compreender que:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>A Prontia Saúde é uma plataforma intermediária entre pacientes e profissionais</li>
                <li>Os profissionais de saúde são responsáveis por seus atos e diagnósticos</li>
                <li>A telemedicina possui limitações e nem todos os casos podem ser atendidos remotamente</li>
                <li>Casos de emergência devem ser direcionados aos serviços de urgência (SAMU 192)</li>
                <li>O paciente deve seguir as orientações médicas e realizar exames presenciais quando solicitado</li>
              </ul>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">6. Pagamentos e Cancelamentos</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                Sobre as transações financeiras:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>Os pagamentos são processados de forma segura através de gateway criptografado</li>
                <li>Os valores são cobrados no momento da confirmação do agendamento</li>
                <li>Cancelamentos com até 24h de antecedência garantem reembolso integral</li>
                <li>Cancelamentos com menos de 24h podem ter taxas aplicadas</li>
                <li>Não comparecimento à consulta não garante direito a reembolso</li>
                <li>Planos de assinatura possuem regras específicas de cancelamento</li>
              </ul>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">7. Propriedade Intelectual</h2>
              <p className="text-muted-foreground leading-relaxed">
                Todo o conteúdo da plataforma Prontia Saúde, incluindo textos, imagens, logotipos, design e código-fonte, são protegidos por direitos autorais e propriedade intelectual. É proibida a reprodução, distribuição ou uso comercial sem autorização prévia e por escrito.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">8. Limitação de Responsabilidade</h2>
              <p className="text-muted-foreground leading-relaxed">
                A Prontia Saúde não se responsabiliza por: falhas de conexão de internet, incompatibilidade de dispositivos, diagnósticos ou tratamentos realizados pelos profissionais de saúde, ou danos indiretos decorrentes do uso da plataforma. Nossa responsabilidade se limita ao valor pago pelo serviço contratado.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">9. Modificações dos Termos</h2>
              <p className="text-muted-foreground leading-relaxed">
                Reservamo-nos o direito de modificar estes Termos de Uso a qualquer momento. As alterações entrarão em vigor imediatamente após sua publicação na plataforma. O uso continuado após as modificações constitui aceitação dos novos termos.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">10. Legislação e Foro</h2>
              <p className="text-muted-foreground leading-relaxed">
                Estes Termos de Uso são regidos pelas leis brasileiras, incluindo o Código de Defesa do Consumidor, a Lei Geral de Proteção de Dados (LGPD) e as resoluções do Conselho Federal de Medicina sobre telemedicina. Fica eleito o foro da comarca de São Paulo/SP para dirimir quaisquer controvérsias.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">11. Contato</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                Para dúvidas, sugestões ou solicitações relacionadas a estes Termos de Uso, entre em contato:
              </p>
              <ul className="list-none space-y-2 text-muted-foreground ml-4">
                <li><strong>E-mail:</strong> suporte@prontiasaude.com.br</li>
                <li><strong>WhatsApp:</strong> +55 11 93335-9187</li>
                <li><strong>Endereço:</strong> São Paulo, SP - Brasil</li>
              </ul>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Termos;
