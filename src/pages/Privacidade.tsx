import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Shield, Lock, Eye, UserCheck, Database, Bell } from "lucide-react";

const Privacidade = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <Card>
          <CardHeader>
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-primary/10 rounded-full">
                <Shield className="h-12 w-12 text-primary" />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold text-center">
              Política de Privacidade
            </CardTitle>
            <p className="text-muted-foreground text-center mt-2">
              Última atualização: 02 de outubro de 2025
            </p>
          </CardHeader>
          <CardContent className="space-y-8 text-foreground">
            <section>
              <h2 className="text-xl font-semibold mb-3">Nosso Compromisso com sua Privacidade</h2>
              <p className="text-muted-foreground leading-relaxed">
                A Prontia Saúde está comprometida em proteger sua privacidade e dados pessoais. Esta Política de Privacidade explica como coletamos, usamos, armazenamos e protegemos suas informações, em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018) e demais legislações aplicáveis.
              </p>
            </section>

            <Separator />

            <section>
              <div className="flex items-center gap-3 mb-3">
                <Database className="h-6 w-6 text-primary" />
                <h2 className="text-xl font-semibold">1. Dados que Coletamos</h2>
              </div>
              
              <h3 className="font-semibold mt-4 mb-2">1.1 Dados de Cadastro</h3>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>Nome completo</li>
                <li>CPF</li>
                <li>Data de nascimento</li>
                <li>E-mail</li>
                <li>Telefone/WhatsApp</li>
                <li>Endereço completo</li>
              </ul>

              <h3 className="font-semibold mt-4 mb-2">1.2 Dados de Saúde</h3>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>Histórico médico e antecedentes</li>
                <li>Sintomas relatados</li>
                <li>Medicamentos em uso</li>
                <li>Alergias e condições pré-existentes</li>
                <li>Registros de consultas e atendimentos</li>
                <li>Receitas e atestados médicos</li>
              </ul>

              <h3 className="font-semibold mt-4 mb-2">1.3 Dados de Navegação</h3>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>Endereço IP</li>
                <li>Tipo de dispositivo e navegador</li>
                <li>Páginas visitadas e tempo de navegação</li>
                <li>Cookies e tecnologias similares</li>
              </ul>

              <h3 className="font-semibold mt-4 mb-2">1.4 Dados de Pagamento</h3>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>Informações de transações financeiras (processadas via InfinitePay)</li>
                <li>Histórico de pagamentos e faturas</li>
              </ul>
            </section>

            <Separator />

            <section>
              <div className="flex items-center gap-3 mb-3">
                <Eye className="h-6 w-6 text-primary" />
                <h2 className="text-xl font-semibold">2. Como Utilizamos seus Dados</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed mb-3">
                Utilizamos suas informações para:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>Criar e gerenciar sua conta na plataforma</li>
                <li>Agendar e realizar consultas médicas online</li>
                <li>Facilitar a comunicação entre você e os profissionais de saúde</li>
                <li>Processar pagamentos e emitir recibos</li>
                <li>Enviar notificações sobre consultas, resultados e atualizações</li>
                <li>Melhorar nossos serviços e experiência do usuário</li>
                <li>Cumprir obrigações legais e regulatórias</li>
                <li>Prevenir fraudes e garantir a segurança da plataforma</li>
                <li>Enviar comunicações de marketing (com seu consentimento)</li>
              </ul>
            </section>

            <Separator />

            <section>
              <div className="flex items-center gap-3 mb-3">
                <Lock className="h-6 w-6 text-primary" />
                <h2 className="text-xl font-semibold">3. Base Legal para Tratamento de Dados</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed mb-3">
                Tratamos seus dados pessoais com base nas seguintes hipóteses legais:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li><strong>Execução de contrato:</strong> Para fornecer os serviços contratados</li>
                <li><strong>Consentimento:</strong> Para ações específicas como marketing</li>
                <li><strong>Obrigação legal:</strong> Para cumprir exigências regulatórias</li>
                <li><strong>Legítimo interesse:</strong> Para melhorias e segurança da plataforma</li>
                <li><strong>Proteção da vida:</strong> Em situações de emergência médica</li>
              </ul>
            </section>

            <Separator />

            <section>
              <div className="flex items-center gap-3 mb-3">
                <UserCheck className="h-6 w-6 text-primary" />
                <h2 className="text-xl font-semibold">4. Compartilhamento de Dados</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed mb-3">
                Seus dados podem ser compartilhados com:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li><strong>Profissionais de saúde:</strong> Médicos, psicólogos e outros profissionais que realizam seu atendimento</li>
                <li><strong>Processadores de pagamento:</strong> InfinitePay para processamento seguro de transações</li>
                <li><strong>Provedores de serviços:</strong> Empresas que nos auxiliam com infraestrutura e tecnologia</li>
                <li><strong>Autoridades competentes:</strong> Quando exigido por lei ou ordem judicial</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-3">
                <strong>Importante:</strong> Não vendemos, alugamos ou comercializamos seus dados pessoais com terceiros para fins de marketing.
              </p>
            </section>

            <Separator />

            <section>
              <div className="flex items-center gap-3 mb-3">
                <Shield className="h-6 w-6 text-primary" />
                <h2 className="text-xl font-semibold">5. Segurança dos Dados</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed mb-3">
                Implementamos medidas técnicas e organizacionais para proteger seus dados:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>Criptografia SSL/TLS para transmissão de dados</li>
                <li>Armazenamento em servidores seguros (Supabase)</li>
                <li>Controles de acesso restrito</li>
                <li>Monitoramento contínuo de segurança</li>
                <li>Treinamento regular da equipe</li>
                <li>Backups regulares e plano de recuperação</li>
              </ul>
            </section>

            <Separator />

            <section>
              <div className="flex items-center gap-3 mb-3">
                <Bell className="h-6 w-6 text-primary" />
                <h2 className="text-xl font-semibold">6. Seus Direitos como Titular</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed mb-3">
                De acordo com a LGPD, você tem direito a:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li><strong>Confirmação e acesso:</strong> Saber se tratamos seus dados e acessá-los</li>
                <li><strong>Correção:</strong> Atualizar dados incompletos ou incorretos</li>
                <li><strong>Anonimização ou exclusão:</strong> Solicitar remoção de dados desnecessários</li>
                <li><strong>Portabilidade:</strong> Receber seus dados em formato estruturado</li>
                <li><strong>Eliminação:</strong> Deletar dados tratados com consentimento</li>
                <li><strong>Revogação do consentimento:</strong> Retirar autorização a qualquer momento</li>
                <li><strong>Oposição:</strong> Se opor a tratamentos específicos</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-3">
                Para exercer seus direitos, entre em contato através do e-mail: <strong>suporte@prontiasaude.com.br</strong>
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">7. Retenção de Dados</h2>
              <p className="text-muted-foreground leading-relaxed">
                Mantemos seus dados pelo tempo necessário para cumprir as finalidades descritas nesta política, respeitando prazos legais e regulatórios. Dados de saúde são mantidos pelo prazo mínimo de 20 anos, conforme resolução CFM nº 1.821/2007.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">8. Cookies e Tecnologias Similares</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                Utilizamos cookies para:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>Manter você conectado na plataforma</li>
                <li>Analisar o tráfego e comportamento dos usuários</li>
                <li>Personalizar sua experiência</li>
                <li>Melhorar a performance do site</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-3">
                Você pode gerenciar suas preferências de cookies nas configurações do navegador.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">9. Alterações nesta Política</h2>
              <p className="text-muted-foreground leading-relaxed">
                Podemos atualizar esta Política de Privacidade periodicamente. Notificaremos sobre mudanças significativas através de e-mail ou avisos na plataforma. Recomendamos revisar esta página regularmente.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">10. Encarregado de Proteção de Dados (DPO)</h2>
              <p className="text-muted-foreground leading-relaxed">
                Para questões relacionadas à proteção de dados pessoais, entre em contato com nosso Encarregado através do e-mail: <strong>dpo@prontiasaude.com.br</strong>
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">11. Contato</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                Para dúvidas, solicitações ou exercício de seus direitos:
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

export default Privacidade;
