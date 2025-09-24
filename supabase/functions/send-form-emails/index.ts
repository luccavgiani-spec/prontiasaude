import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@3.2.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

type FormRequest = EmpresaFormRequest | ONGFormRequest;

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
        from: "Formulários <onboarding@resend.dev>",
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
        from: "Formulários <onboarding@resend.dev>",
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