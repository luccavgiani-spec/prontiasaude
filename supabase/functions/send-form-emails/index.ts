import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@3.2.0";
import { getCorsHeaders } from '../common/cors.ts';

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = getCorsHeaders();

interface EmpresaFormRequest {
  type: "empresa";
  nome: string;
  empresa: string;
  colaboradores: string;
  cnpj: string;
  telefone: string;
  email: string;
}

interface ONGFormRequest {
  type: "ong";
  nomeOng: string;
  siteRedes: string;
  contato: string;
  descricao: string;
}

interface TrabalheConoscoRequest {
  type: "trabalhe-conosco";
  data: {
    nome: string;
    crm: string;
    contato: string;
    cpfCnpj: string;
  };
  recipients: string[];
}

interface SejaParceiroRequest {
  type: "seja-parceiro";
  data: {
    nome: string;
    empresa?: string;
    contato: string;
    cpfCnpj: string;
    descricao?: string;
  };
  recipients: string[];
}

interface ClubeBenParceiroRequest {
  type: "clubeben-parceiro";
  data: {
    nomeLoja: string;
    responsavel: string;
    contato: string;
    cnpj: string;
    categoria: string;
    descricao: string;
  };
}

interface CompanyCredentialsRequest {
  type: "company-credentials";
  data: {
    email: string;
    cnpj: string;
    razao_social: string;
    password: string;
    login_url: string;
  };
}

interface EmployeeWelcomeRequest {
  type: "employee-welcome";
  data: {
    email: string;
    nome: string;
    empresa: string;
    cpf?: string;
    reset_link: string;
  };
}

interface EmployeeInviteRequest {
  type: "employee-invite";
  data: {
    email: string;
    empresa: string;
    invite_link: string;
  };
}

type FormRequest = EmpresaFormRequest | ONGFormRequest | TrabalheConoscoRequest | SejaParceiroRequest | ClubeBenParceiroRequest | CompanyCredentialsRequest | EmployeeWelcomeRequest | EmployeeInviteRequest;

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData: FormRequest = await req.json();
    console.log("Received form submission:", { type: formData.type });

    const recipients = ["sandra_toledo@prontiasaude.com.br", "victoria_toledo@prontiasaude.com.br", "suporte@prontiasaude.com.br"];

    if (formData.type === "empresa") {
      // Handle empresa form
      const emailResponse = await resend.emails.send({
        from: "Formulários <suporte@prontiasaude.com.br>",
        reply_to: "suporte@prontiasaude.com.br",
        to: recipients,
        subject: "Nova Solicitação de Proposta Empresarial - Prontia Saúde",
        html: `
          <h1>Nova Solicitação de Proposta Empresarial</h1>
          <p>Recebemos uma nova solicitação de proposta através do formulário do site.</p>
          
          <h2>Dados da Empresa:</h2>
          <ul>
            <li><strong>Nome do contato:</strong> ${formData.nome}</li>
            <li><strong>Empresa:</strong> ${formData.empresa}</li>
            <li><strong>Número de colaboradores:</strong> ${formData.colaboradores}</li>
            <li><strong>CNPJ:</strong> ${formData.cnpj}</li>
            <li><strong>Telefone:</strong> ${formData.telefone}</li>
            <li><strong>Email:</strong> ${formData.email}</li>
          </ul>
          
          <p>Entre em contato com o cliente o mais breve possível para apresentar nossa proposta personalizada.</p>
          
          <hr>
          <p style="color: #666; font-size: 12px;">
            Este email foi enviado automaticamente pelo sistema de formulários da Prontia Saúde.
          </p>
        `,
      });

      console.log("Empresa email sent:", emailResponse);
      return new Response(JSON.stringify({ success: true, type: "empresa" }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });

    } else if (formData.type === "ong") {
      // Handle ONG form
      const emailResponse = await resend.emails.send({
        from: "Formulários <suporte@prontiasaude.com.br>",
        reply_to: "suporte@prontiasaude.com.br",
        to: recipients,
        subject: "Nova ONG Cadastrada - Programa Empresas do Bem",
        html: `
          <h1>Nova ONG Cadastrada - Programa Empresas do Bem</h1>
          <p>Recebemos o cadastro de uma nova ONG interessada em participar do programa.</p>
          
          <h2>Dados da ONG:</h2>
          <ul>
            <li><strong>Nome da ONG:</strong> ${formData.nomeOng}</li>
            <li><strong>Site/Redes Sociais:</strong> ${formData.siteRedes}</li>
            <li><strong>Contato:</strong> ${formData.contato}</li>
            <li><strong>Descrição:</strong> ${formData.descricao || "Não informado"}</li>
          </ul>
          
          <p>Avaliem a organização e considerem incluí-la no programa de apoio social da Prontia Saúde.</p>
          
          <hr>
          <p style="color: #666; font-size: 12px;">
            Este email foi enviado automaticamente pelo sistema de formulários da Prontia Saúde.
          </p>
        `,
      });

      console.log("ONG email sent:", emailResponse);
      return new Response(JSON.stringify({ success: true, type: "ong" }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });

    } else if (formData.type === "trabalhe-conosco") {
      const emailResponse = await resend.emails.send({
        from: "Formulários <suporte@prontiasaude.com.br>",
        reply_to: "suporte@prontiasaude.com.br",
        to: formData.recipients,
        subject: `Nova candidatura: ${formData.data.nome}`,
        html: `
          <h1>Nova Candidatura Recebida</h1>
          <h2>Trabalhe Conosco</h2>
          
          <p><strong>Nome:</strong> ${formData.data.nome}</p>
          <p><strong>CRM:</strong> ${formData.data.crm}</p>
          <p><strong>Contato:</strong> ${formData.data.contato}</p>
          <p><strong>CPF/CNPJ:</strong> ${formData.data.cpfCnpj}</p>
          
          <hr>
          <p><em>Candidatura recebida em ${new Date().toLocaleString('pt-BR')}</em></p>
        `,
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });

    } else if (formData.type === "seja-parceiro") {
      const emailResponse = await resend.emails.send({
        from: "Formulários <suporte@prontiasaude.com.br>",
        reply_to: "suporte@prontiasaude.com.br",
        to: formData.recipients,
        subject: `Nova proposta de parceria: ${formData.data.nome}`,
        html: `
          <h1>Nova Proposta de Parceria</h1>
          
          <p><strong>Responsável:</strong> ${formData.data.nome}</p>
          <p><strong>Empresa:</strong> ${formData.data.empresa || 'Não informado'}</p>
          <p><strong>Contato:</strong> ${formData.data.contato}</p>
          <p><strong>CPF/CNPJ:</strong> ${formData.data.cpfCnpj}</p>
          
          ${formData.data.descricao ? `
          <h3>Descrição da Proposta:</h3>
          <p>${formData.data.descricao}</p>
          ` : ''}
          
          <hr>
          <p><em>Proposta recebida em ${new Date().toLocaleString('pt-BR')}</em></p>
        `,
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });

    } else if (formData.type === "clubeben-parceiro") {
      const emailResponse = await resend.emails.send({
        from: "Formulários <suporte@prontiasaude.com.br>",
        reply_to: "suporte@prontiasaude.com.br",
        to: recipients,
        subject: `Nova loja parceira ClubeBen: ${formData.data.nomeLoja}`,
        html: `
          <h1>Nova Loja Parceira - Clube de Benefícios</h1>
          <p>Uma nova loja/empresa deseja se tornar parceira e oferecer benefícios aos nossos assinantes.</p>
          
          <h2>Dados da Loja:</h2>
          <ul>
            <li><strong>Nome da Loja/Empresa:</strong> ${formData.data.nomeLoja}</li>
            <li><strong>Responsável:</strong> ${formData.data.responsavel}</li>
            <li><strong>Contato:</strong> ${formData.data.contato}</li>
            <li><strong>CNPJ:</strong> ${formData.data.cnpj}</li>
            <li><strong>Categoria:</strong> ${formData.data.categoria}</li>
          </ul>
          
          <h3>Descrição dos Benefícios Oferecidos:</h3>
          <p>${formData.data.descricao}</p>
          
          <hr>
          <p><em>Cadastro recebido em ${new Date().toLocaleString('pt-BR')}</em></p>
          <p style="color: #666; font-size: 12px;">
            Este email foi enviado automaticamente pelo sistema de formulários da Prontia Saúde.
          </p>
        `,
      });

      console.log("ClubeBen parceiro email sent:", emailResponse);
      return new Response(JSON.stringify({ success: true, type: "clubeben-parceiro" }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
      
    } else if (formData.type === "company-credentials") {
      const emailResponse = await resend.emails.send({
        from: "Prontia Saúde <suporte@prontiasaude.com.br>",
        reply_to: "suporte@prontiasaude.com.br",
        to: [formData.data.email],
        subject: "🔑 Credenciais de Acesso - Prontia Saúde Empresas",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0;">Bem-vindo à Prontia Saúde!</h1>
            </div>
            
            <div style="padding: 30px; background: #f9f9f9;">
              <h2 style="color: #333;">Olá, ${formData.data.razao_social}!</h2>
              <p style="color: #666; line-height: 1.6;">
                Sua empresa foi cadastrada com sucesso na plataforma Prontia Saúde Empresas. 
                Abaixo estão suas credenciais de acesso:
              </p>
              
              <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
                <h3 style="margin-top: 0; color: #667eea;">Dados de Acesso</h3>
                <p style="margin: 10px 0;"><strong>CNPJ:</strong> ${formData.data.cnpj}</p>
                <p style="margin: 10px 0;"><strong>Senha temporária:</strong> 
                  <code style="background: #f0f0f0; padding: 5px 10px; border-radius: 4px; font-size: 16px;">${formData.data.password}</code>
                </p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${formData.data.login_url}" 
                   style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                  Acessar Painel da Empresa
                </a>
              </div>
              
              <div style="background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p style="margin: 0; color: #856404;">
                  ⚠️ <strong>Importante:</strong> Por segurança, você deverá alterar sua senha no primeiro acesso.
                </p>
              </div>
              
              <p style="color: #666; line-height: 1.6; margin-top: 30px;">
                Se tiver alguma dúvida, nossa equipe está à disposição para ajudar.
              </p>
              
              <p style="color: #666;">
                Atenciosamente,<br>
                <strong>Equipe Prontia Saúde</strong>
              </p>
            </div>
            
            <div style="background: #333; color: #999; padding: 20px; text-align: center; font-size: 12px;">
              <p>Este é um email automático. Por favor, não responda.</p>
              <p>© ${new Date().getFullYear()} Prontia Saúde - Todos os direitos reservados</p>
            </div>
          </div>
        `,
      });

      console.log("Company credentials email sent:", emailResponse);
      return new Response(JSON.stringify({ success: true, type: "company-credentials" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
      
    } else if (formData.type === "employee-welcome") {
      const emailResponse = await resend.emails.send({
        from: "Prontia Saúde <suporte@prontiasaude.com.br>",
        reply_to: "suporte@prontiasaude.com.br",
        to: [formData.data.email],
        subject: "🎉 Bem-vindo à Prontia Saúde - Seu plano foi ativado!",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0;">Bem-vindo à Prontia Saúde!</h1>
            </div>
            
            <div style="padding: 30px; background: #f9f9f9;">
              <h2 style="color: #333;">Olá, ${formData.data.nome}!</h2>
              <p style="color: #666; line-height: 1.6;">
                Você foi cadastrado(a) pela empresa <strong>${formData.data.empresa}</strong> e seu plano já está ativo!
              </p>
              
              <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
                <h3 style="margin-top: 0; color: #28a745;">✅ Seu Plano Está Ativo</h3>
                <p style="color: #666;">Você já pode começar a usar todos os nossos serviços de saúde.</p>
              </div>
              
              <div style="background: #e7f3ff; border: 1px solid #0066cc; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p style="margin: 0; color: #004085;">
                  🔐 <strong>Defina sua senha de acesso:</strong><br>
                  Para acessar sua área do paciente e agendar consultas, você precisa criar uma senha.
                </p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${formData.data.reset_link}" 
                   style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                  Criar Minha Senha
                </a>
              </div>
              
              <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h4 style="color: #667eea; margin-top: 0;">O que você pode fazer:</h4>
                <ul style="color: #666; line-height: 1.8;">
                  <li>✅ Agendar consultas médicas online</li>
                  <li>✅ Acessar especialistas</li>
                  <li>✅ Renovar receitas</li>
                  <li>✅ Solicitar exames</li>
                  <li>✅ Acessar o Clube de Benefícios</li>
                </ul>
              </div>
              
              <p style="color: #666; line-height: 1.6; margin-top: 30px;">
                Qualquer dúvida, estamos aqui para ajudar!
              </p>
              
              <p style="color: #666;">
                Atenciosamente,<br>
                <strong>Equipe Prontia Saúde</strong>
              </p>
            </div>
            
            <div style="background: #333; color: #999; padding: 20px; text-align: center; font-size: 12px;">
              <p>Este é um email automático. Por favor, não responda.</p>
              <p>© ${new Date().getFullYear()} Prontia Saúde - Todos os direitos reservados</p>
            </div>
          </div>
        `,
      });

      console.log("Employee welcome email sent:", emailResponse);
      return new Response(JSON.stringify({ success: true, type: "employee-welcome" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
      
    } else if (formData.type === "employee-invite") {
      const emailResponse = await resend.emails.send({
        from: "Prontia Saúde <suporte@prontiasaude.com.br>",
        reply_to: "suporte@prontiasaude.com.br",
        to: [formData.data.email],
        subject: "🎉 Você foi convidado para o Plano de Saúde Empresarial!",
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Bem-vindo à Prontìa Saúde</title>
</head>
<body style="margin:0; padding:0; background-color:#efe3d5;">
  <div style="font-family:'Poppins', Arial, sans-serif; background-color:#efe3d5; padding:40px 0;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0"
            style="background:#ffffff; border-radius:12px; box-shadow:0 4px 12px rgba(0,0,0,0.06); overflow:hidden;">

            <!-- HEADER -->
            <tr>
              <td style="background-color:#00766a; padding:24px 40px; text-align:center;">
                <h1 style="color:#ffffff; margin:0; font-size:24px;">
                  🎉 Bem-vindo à Prontìa Saúde!
                </h1>
              </td>
            </tr>

            <!-- YELLOW LINE -->
            <tr>
              <td style="background-color:#fbaa03; height:4px;"></td>
            </tr>

            <!-- LOGO LEFT -->
            <tr>
              <td style="padding:20px 40px 0 40px;">
                <img src="https://ploqujuhpwutpcibedbr.supabase.co/storage/v1/object/public/email-assets/prontia-favicon.png"
                     alt="Prontìa Saúde"
                     style="width:120px; height:auto;">
              </td>
            </tr>

            <!-- CONTENT -->
            <tr>
              <td style="padding:20px 40px 40px 40px; color:#333333;">
                <p style="font-size:16px; line-height:1.7; margin:0 0 12px 0;">
                  Olá!
                </p>

                <p style="font-size:16px; line-height:1.7; margin:0 0 16px 0;">
                  A empresa <strong>${formData.data.companyName}</strong> convidou você para fazer parte do plano de saúde empresarial da Prontia Saúde!
                </p>

                <h3 style="font-size:18px; line-height:1.6; margin:20px 0 12px 0;">
                  🏥 Seus benefícios incluem:
                </h3>

                <ul style="font-size:15px; line-height:1.7; padding-left:20px; margin:0 0 20px 0;">
                  <li style="margin-bottom:8px;">Consultas médicas ilimitadas por telemedicina</li>
                  <li style="margin-bottom:8px;">Atendimento 24h por dia, 7 dias por semana</li>
                  <li style="margin-bottom:8px;">Médicos especialistas disponíveis</li>
                  <li style="margin-bottom:8px;">Receitas digitais e solicitação de exames</li>
                  <li style="margin-bottom:8px;">Sem carência, sem burocracia</li>
                </ul>

                <!-- WARNING BOX -->
                <div style="
                  background-color:#fff8e5;
                  border-left:4px solid #fbaa03;
                  padding:12px 14px;
                  margin:20px 0;
                  font-size:14px;
                  line-height:1.6;
                ">
                  <strong>⚠️ Atenção:</strong>
                  Este convite expira em <strong>7 dias</strong>. Complete seu cadastro o quanto antes!
                </div>

                <p style="font-size:16px; line-height:1.7; margin:16px 0 20px 0;">
                  <strong>Para ativar seu plano, clique no botão abaixo:</strong>
                </p>

                <!-- CTA BUTTON -->
                <p style="text-align:center; margin:0 0 24px 0;">
                  <a href="${formData.data.inviteLink}"
                    style="
                      display:inline-block;
                      background-color:#00766a;
                      color:#ffffff;
                      text-decoration:none;
                      font-weight:600;
                      padding:14px 32px;
                      border-radius:100px;
                      font-size:15px;
                    ">
                    Completar Cadastro
                  </a>
                </p>

                <p style="font-size:12px; line-height:1.7; color:#666666; margin:0 0 20px 0;">
                  Ou copie e cole este link no seu navegador:<br>
                  <span style="word-break:break-all;">${formData.data.inviteLink}</span>
                </p>

                <p style="font-size:15px; line-height:1.7; margin:0 0 12px 0;">
                  Se você tiver dúvidas, entre em contato com o RH da sua empresa ou com nosso suporte.
                </p>

                <p style="font-size:15px; line-height:1.7; margin:0;">
                  Bem-vindo à família Prontìa! 💚
                </p>
              </td>
            </tr>

            <!-- FOOTER -->
            <tr>
              <td style="background-color:#efe3d5; padding:16px 24px; text-align:center; color:#555555; font-size:12px; line-height:1.6;">
                Prontìa Saúde - Cuidando de você, onde você estiver.<br>
                Este é um email automático, por favor não responda.
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>
        `,
      });

      console.log('[employee-invite] Email sent:', {
        to: formData.data.email,
        from: 'suporte@prontiasaude.com.br',
        response: emailResponse,
        success: emailResponse.data !== null,
        resendId: emailResponse.data?.id,
        error: emailResponse.error
      });

      if (emailResponse.error) {
        throw new Error(`Resend API error: ${emailResponse.error.message}`);
      }
      return new Response(JSON.stringify({ success: true, type: "employee-invite" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    throw new Error("Tipo de formulário não reconhecido");

  } catch (error: any) {
    console.error("Error in send-form-emails function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);