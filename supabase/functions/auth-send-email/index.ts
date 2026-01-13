import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@4.0.0";
import { createHmac, timingSafeEqual } from "https://deno.land/std@0.190.0/crypto/mod.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const hookSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET");

// Cores e estilos Prontia
const PRONTIA_GREEN = "#00695c";
const PRONTIA_YELLOW = "#ffd54f";
const PRONTIA_BG = "#efe3d5";
const LOGO_URL = "https://prontiasaude.com.br/assets/prontia-logo-vertical-misto.png";

interface EmailPayload {
  user: {
    email: string;
    user_metadata?: {
      first_name?: string;
      given_name?: string;
      name?: string;
    };
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
    site_url: string;
  };
}

function getUserName(user: EmailPayload["user"]): string {
  const metadata = user.user_metadata || {};
  return metadata.first_name || metadata.given_name || metadata.name?.split(" ")[0] || "Paciente";
}

function getBaseStyles(): string {
  return `
    font-family: 'Poppins', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background-color: ${PRONTIA_BG};
    padding: 40px 0;
  `;
}

function getButtonStyles(): string {
  return `
    display: inline-block;
    background-color: ${PRONTIA_GREEN};
    color: #ffffff !important;
    text-decoration: none;
    padding: 16px 40px;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    margin: 24px 0;
  `;
}

function getHeaderHtml(): string {
  return `
    <div style="background-color: ${PRONTIA_GREEN}; height: 8px; border-radius: 8px 8px 0 0;"></div>
    <div style="background-color: ${PRONTIA_YELLOW}; height: 4px;"></div>
  `;
}

function getLogoHtml(): string {
  return `
    <div style="text-align: center; padding: 32px 0 24px 0;">
      <img src="${LOGO_URL}" alt="Prontia Saúde" style="height: 80px; max-width: 200px;" />
    </div>
  `;
}

function getFooterHtml(): string {
  return `
    <div style="text-align: center; padding: 24px 0; border-top: 1px solid #e0d5c8; margin-top: 32px;">
      <p style="color: #666666; font-size: 12px; margin: 0;">
        Se você não solicitou esta ação, ignore este e-mail.
      </p>
      <p style="color: #888888; font-size: 11px; margin-top: 16px;">
        © ${new Date().getFullYear()} Prontia Saúde. Todos os direitos reservados.
      </p>
    </div>
  `;
}

function buildRecoveryEmail(userName: string, actionUrl: string): { subject: string; html: string } {
  return {
    subject: "Redefinição de senha - Prontia Saúde",
    html: `
      <div style="${getBaseStyles()}">
        <table cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto;">
          <tr>
            <td>
              <div style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                ${getHeaderHtml()}
                ${getLogoHtml()}
                
                <div style="padding: 0 40px 40px 40px; text-align: center;">
                  <h1 style="color: ${PRONTIA_GREEN}; font-size: 24px; margin-bottom: 16px;">
                    Redefinição de Senha
                  </h1>
                  
                  <p style="color: #333333; font-size: 16px; line-height: 1.6;">
                    Olá, <strong>${userName}</strong>!
                  </p>
                  
                  <p style="color: #555555; font-size: 15px; line-height: 1.6;">
                    Recebemos uma solicitação para redefinir a senha da sua conta na Prontia Saúde.
                  </p>
                  
                  <a href="${actionUrl}" style="${getButtonStyles()}">
                    Redefinir minha senha
                  </a>
                  
                  <p style="color: #888888; font-size: 13px; line-height: 1.5;">
                    Este link expira em <strong>1 hora</strong>.<br>
                    Se você não solicitou essa alteração, pode ignorar este e-mail.
                  </p>
                </div>
                
                ${getFooterHtml()}
              </div>
            </td>
          </tr>
        </table>
      </div>
    `
  };
}

function buildConfirmationEmail(userName: string, actionUrl: string): { subject: string; html: string } {
  return {
    subject: "Confirme seu e-mail - Prontia Saúde",
    html: `
      <div style="${getBaseStyles()}">
        <table cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto;">
          <tr>
            <td>
              <div style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                ${getHeaderHtml()}
                ${getLogoHtml()}
                
                <div style="padding: 0 40px 40px 40px; text-align: center;">
                  <h1 style="color: ${PRONTIA_GREEN}; font-size: 24px; margin-bottom: 16px;">
                    Bem-vindo à Prontia Saúde!
                  </h1>
                  
                  <p style="color: #333333; font-size: 16px; line-height: 1.6;">
                    Olá, <strong>${userName}</strong>!
                  </p>
                  
                  <p style="color: #555555; font-size: 15px; line-height: 1.6;">
                    Estamos muito felizes em ter você conosco! Para ativar sua conta e começar a cuidar da sua saúde, confirme seu e-mail clicando no botão abaixo:
                  </p>
                  
                  <a href="${actionUrl}" style="${getButtonStyles()}">
                    Confirmar meu e-mail
                  </a>
                  
                  <p style="color: #888888; font-size: 13px; line-height: 1.5;">
                    Se você não criou uma conta na Prontia, pode ignorar este e-mail.
                  </p>
                </div>
                
                ${getFooterHtml()}
              </div>
            </td>
          </tr>
        </table>
      </div>
    `
  };
}

function buildMagicLinkEmail(userName: string, actionUrl: string): { subject: string; html: string } {
  return {
    subject: "Acesse sua conta - Prontia Saúde",
    html: `
      <div style="${getBaseStyles()}">
        <table cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto;">
          <tr>
            <td>
              <div style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                ${getHeaderHtml()}
                ${getLogoHtml()}
                
                <div style="padding: 0 40px 40px 40px; text-align: center;">
                  <h1 style="color: ${PRONTIA_GREEN}; font-size: 24px; margin-bottom: 16px;">
                    Acesso Rápido
                  </h1>
                  
                  <p style="color: #333333; font-size: 16px; line-height: 1.6;">
                    Olá, <strong>${userName}</strong>!
                  </p>
                  
                  <p style="color: #555555; font-size: 15px; line-height: 1.6;">
                    Use o botão abaixo para acessar sua conta sem precisar digitar senha:
                  </p>
                  
                  <a href="${actionUrl}" style="${getButtonStyles()}">
                    Acessar minha conta
                  </a>
                  
                  <p style="color: #888888; font-size: 13px; line-height: 1.5;">
                    Este link expira em <strong>1 hora</strong> e só pode ser usado uma vez.<br>
                    Se você não solicitou este acesso, pode ignorar este e-mail.
                  </p>
                </div>
                
                ${getFooterHtml()}
              </div>
            </td>
          </tr>
        </table>
      </div>
    `
  };
}

function buildEmailChangeEmail(userName: string, actionUrl: string): { subject: string; html: string } {
  return {
    subject: "Confirme seu novo e-mail - Prontia Saúde",
    html: `
      <div style="${getBaseStyles()}">
        <table cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto;">
          <tr>
            <td>
              <div style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                ${getHeaderHtml()}
                ${getLogoHtml()}
                
                <div style="padding: 0 40px 40px 40px; text-align: center;">
                  <h1 style="color: ${PRONTIA_GREEN}; font-size: 24px; margin-bottom: 16px;">
                    Confirme seu Novo E-mail
                  </h1>
                  
                  <p style="color: #333333; font-size: 16px; line-height: 1.6;">
                    Olá, <strong>${userName}</strong>!
                  </p>
                  
                  <p style="color: #555555; font-size: 15px; line-height: 1.6;">
                    Recebemos uma solicitação para alterar o e-mail da sua conta. Para confirmar esta alteração, clique no botão abaixo:
                  </p>
                  
                  <a href="${actionUrl}" style="${getButtonStyles()}">
                    Confirmar novo e-mail
                  </a>
                  
                  <p style="color: #888888; font-size: 13px; line-height: 1.5;">
                    Se você não solicitou esta alteração, entre em contato conosco imediatamente.
                  </p>
                </div>
                
                ${getFooterHtml()}
              </div>
            </td>
          </tr>
        </table>
      </div>
    `
  };
}

function buildEmailContent(
  emailType: string,
  userName: string,
  actionUrl: string
): { subject: string; html: string } {
  switch (emailType) {
    case "recovery":
      return buildRecoveryEmail(userName, actionUrl);
    case "signup":
    case "confirmation":
      return buildConfirmationEmail(userName, actionUrl);
    case "magiclink":
    case "magic_link":
      return buildMagicLinkEmail(userName, actionUrl);
    case "email_change":
      return buildEmailChangeEmail(userName, actionUrl);
    default:
      console.log(`Unknown email type: ${emailType}, using recovery template`);
      return buildRecoveryEmail(userName, actionUrl);
  }
}

async function verifyWebhookSignature(payload: string, signature: string): Promise<boolean> {
  if (!hookSecret) {
    console.warn("SEND_EMAIL_HOOK_SECRET not configured, skipping signature verification");
    return true;
  }

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(hookSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    
    const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
    
    return signature === expectedSignature || signature === `sha256=${expectedSignature}`;
  } catch (error) {
    console.error("Signature verification failed:", error);
    return false;
  }
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { 
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const payload = await req.text();
    const signature = req.headers.get("x-supabase-signature") || req.headers.get("x-webhook-signature") || "";

    // Verify webhook signature if secret is configured
    if (hookSecret && signature) {
      const isValid = await verifyWebhookSignature(payload, signature);
      if (!isValid) {
        console.error("Invalid webhook signature");
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 401,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    const data: EmailPayload = JSON.parse(payload);
    const { user, email_data } = data;

    console.log("Received email request:", {
      email: user.email,
      type: email_data.email_action_type,
      redirect_to: email_data.redirect_to
    });

    const userName = getUserName(user);
    
    // Build action URL
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const actionUrl = `${supabaseUrl}/auth/v1/verify?token=${email_data.token_hash}&type=${email_data.email_action_type}&redirect_to=${encodeURIComponent(email_data.redirect_to)}`;

    // Get email content based on type
    const { subject, html } = buildEmailContent(
      email_data.email_action_type,
      userName,
      actionUrl
    );

    // Send email via Resend
    const emailResponse = await resend.emails.send({
      from: "Prontia Saúde <suporte@prontiasaude.com.br>",
      to: [user.email],
      subject,
      html
    });

    console.log("Email sent successfully:", {
      to: user.email,
      type: email_data.email_action_type,
      response: emailResponse
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("Error in auth-send-email function:", error);
    return new Response(
      JSON.stringify({ 
        error: {
          http_code: error.code || 500,
          message: error.message || "Internal server error"
        }
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
});
