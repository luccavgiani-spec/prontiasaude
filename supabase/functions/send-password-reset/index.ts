import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "npm:resend@2.0.0";

// ✅ CORREÇÃO: CORS headers completos para evitar "load failed"
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ✅ CORREÇÃO: URL fixa de PRODUÇÃO (evita confusão com Lovable Cloud)
const ORIGINAL_SUPABASE_URL = "https://ploqujuhpwutpcibedbr.supabase.co";

interface PasswordResetRequest {
  email: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
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

    // ✅ CORREÇÃO: Usar URL de produção + chave de serviço correta
    const supabaseServiceKey = Deno.env.get("ORIGINAL_SUPABASE_SERVICE_ROLE_KEY") 
      || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;

    const supabase = createClient(ORIGINAL_SUPABASE_URL, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Verificar se email existe no auth.users
    const { data: users, error: userError } = await supabase.auth.admin.listUsers();
    
    if (userError) {
      console.error("[send-password-reset] Erro ao buscar usuários:", userError);
      // Não revelar se email existe ou não (segurança)
      return new Response(
        JSON.stringify({ success: true, message: "Se o email existir, você receberá um link de recuperação." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userExists = users.users.some(u => u.email?.toLowerCase() === email.toLowerCase());
    
    if (!userExists) {
      console.log(`[send-password-reset] Email não encontrado: ${email}`);
      // Não revelar se email existe ou não (segurança)
      return new Response(
        JSON.stringify({ success: true, message: "Se o email existir, você receberá um link de recuperação." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Gerar token seguro
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    // Invalidar tokens anteriores para este email
    await supabase
      .from("password_reset_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("email", email.toLowerCase())
      .is("used_at", null);

    // Salvar novo token
    const { error: insertError } = await supabase
      .from("password_reset_tokens")
      .insert({
        email: email.toLowerCase(),
        token,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error("[send-password-reset] Erro ao salvar token:", insertError);
      throw new Error("Erro ao gerar token de recuperação");
    }

    // ✅ CORREÇÃO: URL de redefinição com domínio CORRETO
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
