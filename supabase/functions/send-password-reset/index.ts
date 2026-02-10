import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// URLs dos dois ambientes
const CLOUD_URL = Deno.env.get("SUPABASE_URL")!;
const PRODUCTION_URL = "https://ploqujuhpwutpcibedbr.supabase.co";

interface PasswordResetRequest {
  email: string;
}

/**
 * ✅ CORRIGIDO: Busca usuário por email via REST API direta do GoTrue
 * Usa perPage: 50 (valor que o GoTrue respeita) com paginação manual
 */
async function findUserByEmail(supabaseUrl: string, serviceKey: string, email: string, label: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();
  console.log(`[send-password-reset] Buscando ${email} em ${label}...`);
  
  let page = 1;
  const perPage = 50;
  const maxPages = 50;
  
  while (page <= maxPages) {
    const url = `${supabaseUrl}/auth/v1/admin/users?page=${page}&per_page=${perPage}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      console.error(`[send-password-reset] ${label}: REST API error ${response.status}`);
      return false;
    }
    
    const data = await response.json();
    const users = data.users || data || [];
    
    if (!Array.isArray(users) || users.length === 0) {
      console.log(`[send-password-reset] Usuário NÃO encontrado em ${label} (página ${page}, lista vazia)`);
      return false;
    }
    
    const found = users.find((u: any) => u.email?.toLowerCase() === normalizedEmail);
    if (found) {
      console.log(`[send-password-reset] Usuário encontrado em ${label}: ${found.id}`);
      return true;
    }
    
    if (users.length < perPage) {
      console.log(`[send-password-reset] Usuário NÃO encontrado em ${label} (fim da lista, ${page} páginas)`);
      return false;
    }
    
    page++;
  }
  
  console.log(`[send-password-reset] Usuário NÃO encontrado em ${label} (limite de páginas)`);
  return false;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email }: PasswordResetRequest = await req.json();
    
    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[send-password-reset] Solicitação para: ${email}`);

    // Criar clientes para ambos os ambientes
    const cloudServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const prodServiceKey = Deno.env.get("ORIGINAL_SUPABASE_SERVICE_ROLE_KEY") || cloudServiceKey;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;

    // ✅ CORRIGIDO: Buscar via REST API direta (sem createClient para busca)
    const [existsInCloud, existsInProd] = await Promise.all([
      findUserByEmail(CLOUD_URL, cloudServiceKey, email, 'Cloud'),
      findUserByEmail(PRODUCTION_URL, prodServiceKey, email, 'Produção'),
    ]);

    // Cliente Cloud ainda necessário para salvar token
    const cloudClient = createClient(CLOUD_URL, cloudServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    console.log(`[send-password-reset] Resultado: Cloud=${existsInCloud}, Prod=${existsInProd}`);

    // Determinar ambiente
    let environment: 'cloud' | 'production' | null = null;
    if (existsInCloud) {
      environment = 'cloud';
    } else if (existsInProd) {
      environment = 'production';
    }
    
    if (!environment) {
      console.log(`[send-password-reset] Email não encontrado em nenhum ambiente: ${email}`);
      // Não revelar se email existe ou não (segurança)
      return new Response(
        JSON.stringify({ success: true, message: "Se o email existir, você receberá um link de recuperação." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[send-password-reset] Ambiente determinado: ${environment}`);

    // Gerar token seguro
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    // Salvar token na tabela (sempre no Cloud, pois é onde as edge functions rodam)
    // Invalidar tokens anteriores para este email
    await cloudClient
      .from("password_reset_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("email", email.toLowerCase())
      .is("used_at", null);

    // Salvar novo token COM o ambiente
    const { error: insertError } = await cloudClient
      .from("password_reset_tokens")
      .insert({
        email: email.toLowerCase(),
        token,
        expires_at: expiresAt.toISOString(),
        environment, // ✅ NOVO: Salvar qual ambiente usar
      });

    if (insertError) {
      console.error("[send-password-reset] Erro ao salvar token:", insertError);
      throw new Error("Erro ao gerar token de recuperação");
    }

    // URL de redefinição
    const resetUrl = `https://prontiasaude.com.br/nova-senha?token=${token}`;

    // Enviar email via Resend
    const resend = new Resend(resendApiKey);

    const emailHtml = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Redefinição de Senha - Prontia Saúde</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 20px 0;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #00766a; padding: 24px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">
                Redefinição de Senha
              </h1>
            </td>
          </tr>
          <!-- Yellow accent line -->
          <tr>
            <td style="background-color: #fbaa03; height: 4px;"></td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px 32px;">
              <!-- Logo -->
              <div style="text-align: center; margin-bottom: 32px;">
                <img src="https://prontiasaude.com.br/assets/prontia-logo-vertical-misto.png" alt="Prontia Saúde" style="max-width: 180px; height: auto;">
              </div>
              
              <p style="margin: 0 0 16px; color: #333333; font-size: 16px; line-height: 1.6;">
                Olá!
              </p>
              
              <p style="margin: 0 0 24px; color: #333333; font-size: 16px; line-height: 1.6;">
                Recebemos uma solicitação para redefinir a senha da sua conta na <strong>Prontia Saúde</strong>.
              </p>
              
              <p style="margin: 0 0 32px; color: #333333; font-size: 16px; line-height: 1.6;">
                Clique no botão abaixo para criar uma nova senha:
              </p>
              
              <!-- Button -->
              <div style="text-align: center; margin-bottom: 32px;">
                <a href="${resetUrl}" 
                   style="display: inline-block; background-color: #00766a; color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; transition: background-color 0.3s;">
                  Redefinir minha senha
                </a>
              </div>
              
              <p style="margin: 0 0 16px; color: #666666; font-size: 14px; line-height: 1.6; text-align: center;">
                ⏰ Este link expira em <strong>1 hora</strong>.
              </p>
              
              <p style="margin: 0 0 24px; color: #666666; font-size: 14px; line-height: 1.6;">
                Se você não solicitou esta redefinição, ignore este email. Sua senha permanecerá inalterada.
              </p>
              
              <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 24px 0;">
              
              <p style="margin: 0; color: #999999; font-size: 12px; line-height: 1.6;">
                Se o botão não funcionar, copie e cole o link abaixo no seu navegador:
              </p>
              <p style="margin: 8px 0 0; word-break: break-all;">
                <a href="${resetUrl}" style="color: #00766a; font-size: 12px;">${resetUrl}</a>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f8f8; padding: 24px 32px; border-top: 1px solid #e0e0e0;">
              <p style="margin: 0 0 8px; color: #666666; font-size: 14px; text-align: center;">
                © 2025 Prontia Saúde - Telemedicina Acessível
              </p>
              <p style="margin: 0; color: #999999; font-size: 12px; text-align: center;">
                <a href="mailto:suporte@prontiasaude.com.br" style="color: #00766a; text-decoration: none;">suporte@prontiasaude.com.br</a>
                &nbsp;|&nbsp;
                <a href="https://wa.me/5511913138040" style="color: #00766a; text-decoration: none;">(11) 91313-8040</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const emailResponse = await resend.emails.send({
      from: "Prontia Saúde <noreply@prontiasaude.com.br>",
      to: [email],
      subject: "Redefinição de Senha - Prontia Saúde",
      html: emailHtml,
    });

    console.log(`[send-password-reset] Email enviado:`, emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Se o email existir, você receberá um link de recuperação." 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[send-password-reset] Erro:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
