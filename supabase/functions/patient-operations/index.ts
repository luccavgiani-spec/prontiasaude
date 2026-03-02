import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.94.1";

// ============================================================
// ✅ CORS HEADERS INLINE (auto-contido - substitui ../common/cors.ts)
// ============================================================
const ALLOWED_ORIGINS = [
  "https://prontiasaude.com.br",
  "https://www.prontiasaude.com.br",
  "https://prontiasaude.lovable.app",
  "http://localhost:5173",
];

function isLovablePreviewOrigin(origin: string): boolean {
  return /^https:\/\/id-preview--[a-f0-9-]+\.lovable\.app$/.test(origin);
}

function getCorsHeaders(requestOrigin?: string | null): Record<string, string> {
  const origin = requestOrigin || "";
  const isAllowed = ALLOWED_ORIGINS.includes(origin) || isLovablePreviewOrigin(origin);
  const allowedOrigin = isAllowed ? origin : ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  };
}

// ============================================================
// ✅ CPF VALIDATOR INLINE
// ============================================================
function cleanCPF(cpf: string): string {
  return cpf.replace(/\D/g, "");
}

function validateCPFChecksum(cpf: string): boolean {
  if (!cpf) return false;
  const cleanedCPF = cpf.replace(/\D/g, "");
  if (cleanedCPF.length !== 11) return false;
  const invalidPatterns = [
    "00000000000",
    "11111111111",
    "22222222222",
    "33333333333",
    "44444444444",
    "55555555555",
    "66666666666",
    "77777777777",
    "88888888888",
    "99999999999",
  ];
  if (invalidPatterns.includes(cleanedCPF)) return false;
  let sum = 0;
  let remainder;
  for (let i = 1; i <= 9; i++) {
    sum += parseInt(cleanedCPF.substring(i - 1, i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanedCPF.substring(9, 10))) return false;
  sum = 0;
  for (let i = 1; i <= 10; i++) {
    sum += parseInt(cleanedCPF.substring(i - 1, i)) * (12 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanedCPF.substring(10, 11))) return false;
  return true;
}

// ============================================================
// ✅ HELPERS CLICKLIFE
// ============================================================
const PLANOS_FAMILIARES_COM_ESPECIALISTAS = ["FAM_COM_ESP_1M", "FAM_COM_ESP_3M", "FAM_COM_ESP_6M", "FAM_COM_ESP_12M"];
const PLANOS_FAMILIARES_SEM_ESPECIALISTAS = [
  "FAM_SEM_ESP_1M",
  "FAM_SEM_ESP_3M",
  "FAM_SEM_ESP_6M",
  "FAM_SEM_ESP_12M",
  "FAMILY",
  "FAM_BASIC",
];

function getClickLifePlanIdForDependente(planCode: string | undefined | null): number {
  if (!planCode) return 1237;
  if (PLANOS_FAMILIARES_COM_ESPECIALISTAS.includes(planCode)) return 1238;
  if (planCode.startsWith("EMPRESA_")) return 1238;
  return 1237;
}

function normalizeGender(gender: string | undefined | null): "M" | "F" {
  if (!gender) return "F";
  const g = gender.trim().toUpperCase();
  if (g === "M" || g === "MALE" || g === "MASCULINO") return "M";
  return "F";
}

function normalizePhone(phone: string | undefined | null): string | null {
  if (!phone) return null;
  let clean = phone.replace(/\D/g, "");
  if (clean.startsWith("55") && clean.length >= 12) {
    clean = clean.substring(2);
  }
  if (clean === "11999999999" || clean === "5511999999999") {
    return null;
  }
  if (clean.length < 10) {
    return null;
  }
  return clean;
}

interface ClickLifeSyncResult {
  success: boolean;
  status: "ok" | "failed" | "partial";
  error_message?: string;
  details?: Record<string, any>;
}

async function syncDependenteClickLife(
  dependente: {
    cpf: string;
    nome: string;
    email: string;
    telefone: string | undefined | null;
    sexo: string | undefined | null;
    birthDate?: string | null;
    cep?: string | null;
    logradouro?: string | null;
    numero?: string | null;
    cidade?: string | null;
    estado?: string | null;
  },
  titularCpf: string,
  planoid: number,
): Promise<ClickLifeSyncResult> {
  const CLICKLIFE_API = Deno.env.get("CLICKLIFE_API_BASE");
  const INTEGRATOR_TOKEN = Deno.env.get("CLICKLIFE_AUTH_TOKEN");
  const PATIENT_PASSWORD = Deno.env.get("CLICKLIFE_PATIENT_DEFAULT_PASSWORD");
  if (!CLICKLIFE_API || !INTEGRATOR_TOKEN) {
    return { success: false, status: "failed", error_message: "ClickLife credentials not configured" };
  }
  const cpfLimpo = dependente.cpf.replace(/\D/g, "");
  const titularCpfLimpo = titularCpf.replace(/\D/g, "");
  const details: Record<string, any> = {};
  try {
    const checkUserRes = await fetch(`${CLICKLIFE_API}/usuarios/obter`, {
      method: "POST",
      headers: { "Content-Type": "application/json", authtoken: INTEGRATOR_TOKEN },
      body: JSON.stringify({ authtoken: INTEGRATOR_TOKEN, cpfpaciente: cpfLimpo }),
    });
    const checkUserData = await checkUserRes.json();
    details.user_check = checkUserData;
    const userExists =
      checkUserRes.ok &&
      (checkUserData?.cpf ||
        checkUserData?.data?.cpf ||
        checkUserData?.usuario?.cpf ||
        (checkUserData?.sucesso === true && (checkUserData?.mensagem || "").toLowerCase().includes("encontrado")));
    if (!userExists) {
      const telefoneLimpo = normalizePhone(dependente.telefone);
      const numero = telefoneLimpo ? telefoneLimpo.substring(2) : "999999999";
      let birthDateFormatted = "01-01-1990";
      if (dependente.birthDate) {
        const bd = dependente.birthDate;
        if (bd.includes("-")) {
          const parts = bd.split("-");
          if (parts.length === 3 && parts[0].length === 4) {
            birthDateFormatted = `${parts[2]}-${parts[1]}-${parts[0]}`;
          } else if (parts.length === 3) {
            birthDateFormatted = bd;
          }
        }
      }
      const sexoNormalizado = normalizeGender(dependente.sexo);
      const registerPayload = {
        nome: dependente.nome,
        cpf: cpfLimpo,
        email: dependente.email,
        senha: PATIENT_PASSWORD || "Pronto@2024",
        datanascimento: birthDateFormatted,
        sexo: sexoNormalizado,
        telefone: numero,
        logradouro: dependente.logradouro || "Rua Exemplo",
        numero: dependente.numero || "123",
        bairro: "Centro",
        cep: (dependente.cep || "01000000").replace(/\D/g, ""),
        cidade: dependente.cidade || "São Paulo",
        estado: dependente.estado || "SP",
        empresaid: 9083,
        planoid: planoid,
      };
      const registerRes = await fetch(`${CLICKLIFE_API}/usuarios/usuarios`, {
        method: "POST",
        headers: { "Content-Type": "application/json", authtoken: INTEGRATOR_TOKEN },
        body: JSON.stringify(registerPayload),
      });
      const registerData = await registerRes.json();
      details.user_register = registerData;
      const msgLower = (registerData.mensagem || "").toLowerCase();
      if (!registerRes.ok && !msgLower.includes("já cadastrado") && !msgLower.includes("ja cadastrado")) {
        return {
          success: false,
          status: "failed",
          error_message: registerData.mensagem || "Erro ao cadastrar dependente",
          details,
        };
      }
    }
    const checkDepsRes = await fetch(`${CLICKLIFE_API}/usuarios/obter-dependentes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", authtoken: INTEGRATOR_TOKEN },
      body: JSON.stringify({ authtoken: INTEGRATOR_TOKEN, cpftitular: titularCpfLimpo }),
    });
    const checkDepsData = await checkDepsRes.json();
    details.dependente_check = checkDepsData;
    const dependentes = checkDepsData?.dependentes || checkDepsData?.data || [];
    const jaVinculado =
      Array.isArray(dependentes) && dependentes.some((d: any) => (d.cpf || "").replace(/\D/g, "") === cpfLimpo);
    if (!jaVinculado) {
      const linkPayload = {
        authtoken: INTEGRATOR_TOKEN,
        cpftitular: titularCpfLimpo,
        cpfdependente: cpfLimpo,
        nomedependente: dependente.nome,
      };
      const linkRes = await fetch(`${CLICKLIFE_API}/usuarios/cadastrar-dependente`, {
        method: "POST",
        headers: { "Content-Type": "application/json", authtoken: INTEGRATOR_TOKEN },
        body: JSON.stringify(linkPayload),
      });
      const linkData = await linkRes.json();
      details.dependente_link = linkData;
    }
    const activatePayload = {
      authtoken: INTEGRATOR_TOKEN,
      cpf: cpfLimpo,
      empresaid: 9083,
      planoid: planoid,
      proposito: "Ativar",
    };
    const activateRes = await fetch(`${CLICKLIFE_API}/usuarios/ativacao`, {
      method: "POST",
      headers: { "Content-Type": "application/json", authtoken: INTEGRATOR_TOKEN },
      body: JSON.stringify(activatePayload),
    });
    const activateData = await activateRes.json();
    details.activation = activateData;
    const msgLower = (activateData.mensagem || "").toLowerCase();
    if (!activateRes.ok && !msgLower.includes("já ativo") && !msgLower.includes("ja ativo")) {
      return {
        success: false,
        status: "partial",
        error_message: activateData.mensagem || "Erro ao ativar dependente",
        details,
      };
    }
    return { success: true, status: "ok", details };
  } catch (error) {
    return {
      success: false,
      status: "failed",
      error_message: error instanceof Error ? error.message : "Exception during sync",
      details: { ...details, exception: String(error) },
    };
  }
}

// ============================================================
// ✅ VALIDATION HELPERS
// ============================================================
const TEMP_EMAIL_DOMAINS = [
  "10minutemail.com",
  "guerrillamail.com",
  "mailinator.com",
  "tempmail.com",
  "throwaway.email",
  "maildrop.cc",
  "temp-mail.org",
  "getnada.com",
  "yopmail.com",
  "mailnesia.com",
  "trashmail.com",
  "sharklasers.com",
];
const VALID_DDDS = [
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48,
  49, 51, 53, 54, 55, 61, 62, 64, 63, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77, 79, 81, 87, 82, 83, 84, 85, 88, 86, 89,
  91, 93, 94, 92, 97, 95, 96, 98, 99,
];

const validateEmail = (email: string): boolean => {
  if (!email || email.length > 255) return false;
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) return false;
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;
  if (TEMP_EMAIL_DOMAINS.some((temp) => domain.includes(temp))) return false;
  if (/^(test|fake|exemplo|asdf|qwerty|admin|noreply)@/.test(email.toLowerCase())) return false;
  return true;
};

const validatePhone = (phone: string): boolean => {
  if (!phone) return false;
  if (!/^\+55\d{10,11}$/.test(phone)) return false;
  const cleanPhone = phone.replace(/\D/g, "");
  const ddd = parseInt(cleanPhone.substring(2, 4));
  const number = cleanPhone.substring(4);
  if (!VALID_DDDS.includes(ddd)) return false;
  if (/^(\d)\1+$/.test(number)) return false;
  if (/^(0123456789|9876543210)/.test(number)) return false;
  if (number.length === 9) return number[0] === "9";
  if (number.length === 8) return number[0] !== "9";
  return false;
};

const validateCPF = (cpf: string): boolean => {
  if (!cpf) return false;
  const cleaned = cleanCPF(cpf);
  if (cleaned.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cleaned)) return false;
  return validateCPFChecksum(cleaned);
};

const validateString = (str: string, maxLength: number): boolean => {
  return typeof str === "string" && str.length > 0 && str.length <= maxLength;
};

function normalizeDateToISO(value: any): string | null {
  if (!value) return null;
  const str = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  if (/^\d{4}-\d{2}-\d{2}T/.test(str)) return str.substring(0, 10);
  const brMatch = str.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  return null;
}

const validateDate = (dateStr: string): boolean => {
  const normalized = normalizeDateToISO(dateStr);
  if (!normalized) return false;
  const [year, month, day] = normalized.split("-").map(Number);
  if (year < 1900 || year > new Date().getFullYear()) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  return true;
};

// ============================================================
// ✅ INTERFACES
// ============================================================
interface UpsertPatientRequest {
  operation: "upsert_patient";
  name: string;
  email: string;
  phone_e164: string;
}
interface CompleteProfileRequest {
  operation: "complete_profile";
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  cpf: string;
  birth_date: string;
  gender?: string;
  cep?: string;
  address_number?: string;
  complement?: string;
  city?: string;
  state?: string;
  plano: boolean;
}
interface ScheduleAppointmentRequest {
  operation: "schedule_appointment";
  user_id: string;
  email: string;
  nome: string;
  especialidade: string;
  horario_iso: string;
  plano_ativo: boolean;
  servico: string;
  cpf?: string;
  adicional?: string;
  cupom?: string;
  fotos_base64?: string[];
}
interface SyncAppointmentRequest {
  operation: "sync_appointment";
  appointment_id: string;
  status: string;
  meeting_link?: string;
  provider?: string;
  external_appointment_id?: string;
}
interface ScheduleRedirectRequest {
  operation: "schedule_redirect";
  user_id: string;
  sku: string;
}
interface DisablePlanRequest {
  operation: "disable_plan";
  email: string;
}
interface ChangePlanRequest {
  operation: "change_plan";
  plan_id: string;
  new_plan_code: string;
  new_expires_at?: string;
}
interface ActivatePlanManualRequest {
  operation: "activate_plan_manual";
  patient_email: string;
  patient_id?: string;
  plan_code: string;
  duration_days: number;
  send_email?: boolean;
}
interface InviteFamiliarRequest {
  operation: "invite-familiar";
  plan_id: string;
  email: string;
}
interface ResendFamilyInviteRequest {
  operation: "resend-family-invite";
  invite_id: string;
}

serve(async (req) => {
  const requestOrigin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(requestOrigin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const ORIGINAL_SUPABASE_URL = "https://ploqujuhpwutpcibedbr.supabase.co";
    const supabaseServiceRoleKey =
      Deno.env.get("ORIGINAL_SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const gasBase = Deno.env.get("GAS_BASE");

    if (!supabaseServiceRoleKey) throw new Error("Missing required environment variables");

    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(ORIGINAL_SUPABASE_URL, supabaseServiceRoleKey);

    let operationName = "unknown";
    const body = await req.json();
    operationName = body.operation || "unknown";

    const AUTH_BYPASS_OPERATIONS = [
      "upsert_patient",
      "activate_plan_manual",
      "ensure_patient",
      "admin_update_patient",
      "change_plan",
      "disable_plan",
      "complete_profile",
      "invite-familiar",
      "resend-family-invite",
      "activate-family-member",
      "deactivate_plan_manual",
      "schedule_appointment",
      "schedule_redirect",
    ];

    if (!AUTH_BYPASS_OPERATIONS.includes(body.operation)) {
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Autenticação necessária" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const token = authHeader.replace("Bearer ", "");
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Token inválido" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    switch (body.operation) {
      case "upsert_patient": {
        const { name, email, phone_e164 } = body as UpsertPatientRequest;
        if (!validateString(name, 255))
          return new Response(JSON.stringify({ error: "Nome inválido" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        if (!validateEmail(email))
          return new Response(JSON.stringify({ error: "Email inválido" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        if (!validatePhone(phone_e164))
          return new Response(JSON.stringify({ error: "Telefone inválido (formato E.164 esperado)" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });

        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: {
            first_name: name.split(" ")[0] || "",
            last_name: name.split(" ").slice(1).join(" ") || "",
            phone_e164,
          },
        });
        if (authError && !authError.message.includes("already")) throw authError;
        const userId = authData?.user?.id || null;

        if (authData?.user) {
          try {
            await supabase
              .from("metrics")
              .insert({
                metric_type: "registration",
                patient_email: email,
                platform: "site",
                status: "completed",
                metadata: { user_id: userId, phone: phone_e164 },
              });
          } catch (e) {}
        }

        let finalUserId = userId;
        if (!finalUserId) {
          const { data: patientByEmail } = await supabase
            .from("patients")
            .select("user_id")
            .eq("email", email.toLowerCase())
            .maybeSingle();
          if (patientByEmail?.user_id) {
            finalUserId = patientByEmail.user_id;
          } else {
            let page = 1;
            const perPage = 100;
            while (!finalUserId) {
              const { data: usersPage } = await supabase.auth.admin.listUsers({ page, perPage });
              if (!usersPage?.users?.length) break;
              const found = usersPage.users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
              if (found) {
                finalUserId = found.id;
                break;
              }
              if (usersPage.users.length < perPage) break;
              page++;
            }
          }
        }

        if (finalUserId) {
          const patientData: Record<string, any> = {
            user_id: finalUserId,
            email: email.toLowerCase(),
            first_name: name.split(" ")[0] || "",
            last_name: name.split(" ").slice(1).join(" ") || "",
            phone_e164,
          };
          if (body.cpf) patientData.cpf = body.cpf;
          if (body.birth_date) {
            const nd = normalizeDateToISO(body.birth_date);
            if (nd) patientData.birth_date = nd;
          }
          if (body.gender) patientData.gender = body.gender;
          if (body.cep) patientData.cep = body.cep;
          if (body.address_line) patientData.address_line = body.address_line;
          if (body.address_number) patientData.address_number = body.address_number;
          if (body.complement) patientData.complement = body.complement;
          if (body.city) patientData.city = body.city;
          if (body.state) patientData.state = body.state;
          if (body.source) patientData.source = body.source;
          if (body.terms_accepted) patientData.terms_accepted_at = new Date().toISOString();
          if (body.profile_complete !== undefined) patientData.profile_complete = body.profile_complete;

          const { data: existingPatient } = await supabase
            .from("patients")
            .select("id")
            .eq("user_id", finalUserId)
            .maybeSingle();
          if (existingPatient) {
            const { error: updateErr } = await supabase
              .from("patients")
              .update(patientData)
              .eq("id", existingPatient.id);
            if (updateErr) console.error("[upsert_patient] Update patients error:", updateErr);
          } else {
            const { data: byEmail } = await supabase
              .from("patients")
              .select("id")
              .eq("email", email.toLowerCase())
              .maybeSingle();
            if (byEmail) {
              const { error: updateErr } = await supabase.from("patients").update(patientData).eq("id", byEmail.id);
              if (updateErr) console.error("[upsert_patient] Update by email error:", updateErr);
            } else {
              patientData.id = crypto.randomUUID();
              const { error: insertErr } = await supabase.from("patients").insert(patientData);
              if (insertErr) console.error("[upsert_patient] Insert patients error:", insertErr);
            }
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            user_id: finalUserId || userId,
            status: authData ? "created" : "exists",
            message: "Usuário registrado e perfil salvo.",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      case "complete_profile": {
        // ============================================================
        // ✅ CORREÇÃO: Salvar diretamente no banco via service_role
        // usando EMAIL como chave de lookup, sem depender do user_id
        // do Lovable Cloud (que é diferente do auth.users de produção)
        // ============================================================
        const profileData = body as CompleteProfileRequest;

        // Validações
        if (!validateString(profileData.first_name, 100) || !validateString(profileData.last_name, 100)) {
          return new Response(JSON.stringify({ error: "Nome ou sobrenome inválido" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (!validateEmail(profileData.email)) {
          return new Response(JSON.stringify({ error: "Email inválido" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (!validatePhone(profileData.phone)) {
          return new Response(JSON.stringify({ error: "Telefone inválido" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const cpfClean = cleanCPF(profileData.cpf);
        if (!validateCPF(cpfClean)) {
          return new Response(JSON.stringify({ error: "CPF inválido" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const normalizedBirthDate = normalizeDateToISO(profileData.birth_date);
        if (!normalizedBirthDate) {
          return new Response(
            JSON.stringify({ error: "Data de nascimento inválida. Use o formato DD/MM/AAAA ou AAAA-MM-DD." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        const normalizedEmail = profileData.email.toLowerCase().trim();

        console.log("[complete_profile] 🔍 Buscando registro por email:", normalizedEmail);

        // Verificar CPF duplicado — excluir o próprio registro do usuário (busca por email)
        const { data: cpfConflict } = await supabase
          .from("patients")
          .select("id, email")
          .eq("cpf", cpfClean)
          .neq("email", normalizedEmail)
          .maybeSingle();

        if (cpfConflict) {
          return new Response(JSON.stringify({ error: "CPF já cadastrado" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Montar payload de atualização com todos os campos validados
        const updatePayload: Record<string, any> = {
          first_name: profileData.first_name.substring(0, 100),
          last_name: profileData.last_name.substring(0, 100),
          phone_e164: profileData.phone,
          cpf: cpfClean,
          birth_date: normalizedBirthDate,
          gender: profileData.gender ? profileData.gender.substring(0, 1) : null,
          cep: profileData.cep ? profileData.cep.replace(/\D/g, "").substring(0, 8) : null,
          address_number: profileData.address_number ? profileData.address_number.substring(0, 20) : null,
          complement: profileData.complement ? profileData.complement.substring(0, 100) : null,
          city: profileData.city ? profileData.city.substring(0, 100) : null,
          state: profileData.state ? profileData.state.substring(0, 2) : null,
          profile_complete: true,
          updated_at: new Date().toISOString(),
        };

        // Buscar registro existente pelo email
        const { data: existingByEmail } = await supabase
          .from("patients")
          .select("id, user_id")
          .eq("email", normalizedEmail)
          .maybeSingle();

        let savedPatientId: string | null = null;

        if (existingByEmail) {
          // ✅ Registro encontrado pelo email → UPDATE direto (bypassa RLS via service_role)
          console.log("[complete_profile] ✅ Registro encontrado por email, atualizando id:", existingByEmail.id);
          const { error: updateErr } = await supabase
            .from("patients")
            .update(updatePayload)
            .eq("id", existingByEmail.id);

          if (updateErr) {
            console.error("[complete_profile] ❌ Erro no UPDATE:", updateErr.message);
            return new Response(JSON.stringify({ error: "Erro ao salvar perfil", details: updateErr.message }), {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          savedPatientId = existingByEmail.id;
          console.log("[complete_profile] ✅ UPDATE bem-sucedido");
        } else {
          // ✅ Registro não existe → INSERT com email e dados completos
          console.log("[complete_profile] ⚠️ Registro não encontrado por email, criando novo");
          const newId = crypto.randomUUID();
          const insertPayload = {
            id: newId,
            email: normalizedEmail,
            ...updatePayload,
          };

          // Tentar vincular user_id da produção se o email existir no auth
          const { data: authUser } = await supabase.auth.admin.getUserByEmail(normalizedEmail);
          if (authUser?.user?.id) {
            insertPayload["user_id"] = authUser.user.id;
            console.log("[complete_profile] ✅ user_id da produção encontrado:", authUser.user.id);
          }

          const { error: insertErr } = await supabase.from("patients").insert(insertPayload);
          if (insertErr) {
            console.error("[complete_profile] ❌ Erro no INSERT:", insertErr.message);
            return new Response(JSON.stringify({ error: "Erro ao criar perfil", details: insertErr.message }), {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          savedPatientId = newId;
          console.log("[complete_profile] ✅ INSERT bem-sucedido");
        }

        // Também chamar o GAS se configurado (não-bloqueante, mantém compatibilidade)
        if (gasBase) {
          try {
            const gasPayload = {
              user_id: profileData.user_id,
              first_name: profileData.first_name.substring(0, 100),
              last_name: profileData.last_name.substring(0, 100),
              email: normalizedEmail,
              phone: profileData.phone,
              cpf: cpfClean,
              birth_date: normalizedBirthDate,
              gender: profileData.gender ? profileData.gender.substring(0, 1) : "",
              cep: profileData.cep ? profileData.cep.substring(0, 10) : "",
              address_number: profileData.address_number ? profileData.address_number.substring(0, 20) : "",
              complement: profileData.complement ? profileData.complement.substring(0, 100) : "",
              city: profileData.city ? profileData.city.substring(0, 100) : "",
              state: profileData.state ? profileData.state.substring(0, 2) : "",
              source: "site",
              plano: profileData.plano,
            };
            const gasResponse = await fetch(`${gasBase}?path=site-register`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(gasPayload),
            });
            console.log("[complete_profile] GAS Response status:", gasResponse.status);
          } catch (gasErr) {
            console.warn("[complete_profile] ⚠️ GAS call falhou (não-bloqueante):", gasErr);
          }
        }

        return new Response(
          JSON.stringify({ success: true, patient_id: savedPatientId, message: "Perfil salvo com sucesso." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      case "schedule_appointment": {
        const appointmentData = body as ScheduleAppointmentRequest;
        if (!validateEmail(appointmentData.email))
          return new Response(JSON.stringify({ error: "Email inválido" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        if (!validateString(appointmentData.nome, 255))
          return new Response(JSON.stringify({ error: "Nome inválido" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        const gasPayload = {
          user_id: appointmentData.user_id,
          email: appointmentData.email.substring(0, 255),
          nome: appointmentData.nome.substring(0, 255),
          especialidade: appointmentData.especialidade,
          horario_iso: appointmentData.horario_iso,
          plano_ativo: appointmentData.plano_ativo,
          servico: appointmentData.servico,
          ...(appointmentData.cpf && validateCPF(appointmentData.cpf) && { cpf: appointmentData.cpf }),
          ...(appointmentData.adicional && { adicional: appointmentData.adicional.substring(0, 1000) }),
          ...(appointmentData.cupom && { cupom: appointmentData.cupom.substring(0, 50) }),
          ...(appointmentData.fotos_base64 && { fotos_base64: appointmentData.fotos_base64 }),
        };
        const gasResponse = await fetch(`${gasBase}?path=site-schedule`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(gasPayload),
        });
        const gasResult = await gasResponse.text();
        return new Response(JSON.stringify({ success: true, gas: gasResult }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "sync_appointment": {
        const { appointment_id, status, meeting_link, provider, external_appointment_id } =
          body as SyncAppointmentRequest;
        if (!validateString(appointment_id, 255) || !validateString(status, 50))
          return new Response(JSON.stringify({ error: "Dados inválidos" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        return new Response(
          JSON.stringify({
            success: true,
            message: "Appointment synced",
            appointment_id,
            status,
            meeting_link,
            provider,
            external_appointment_id,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      case "schedule_redirect": {
        const { user_id, sku } = body as ScheduleRedirectRequest;
        if (!validateString(sku, 50))
          return new Response(JSON.stringify({ error: "SKU inválido" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        const { data: patient, error: patientError } = await supabase
          .from("patients")
          .select("*")
          .eq("id", user_id)
          .single();
        if (patientError || !patient)
          return new Response(JSON.stringify({ error: "Paciente não encontrado" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        if (!patient.profile_complete)
          return new Response(JSON.stringify({ error: "Cadastro incompleto" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.admin.getUserById(user_id);
        if (userError || !user?.email)
          return new Response(JSON.stringify({ error: "Email do usuário não encontrado" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        const formatDateBR = (dateStr: string) => {
          if (!dateStr) return "";
          const [year, month, day] = dateStr.split("-");
          return `${day}-${month}-${year}`;
        };
        const gasPayload = {
          data: new Date().toISOString().split("T")[0],
          id_user: patient.id,
          nome: patient.first_name || "",
          sobrenome: patient.last_name || "",
          email: user.email,
          telefone: patient.phone_e164 || "",
          cpf: patient.cpf || "",
          data_nascimento: formatDateBR(patient.birth_date || ""),
          genero: patient.gender || "",
          cep: patient.cep || "",
          endereco_numero: patient.address_number || "",
          complemento: patient.complement || "",
          cidade: patient.city || "",
          uf: patient.state || "",
          fonte: patient.source || "site",
          plano: false,
          sku: sku.substring(0, 50),
        };
        const gasResponse = await fetch(`${gasBase}?path=site-schedule`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(gasPayload),
        });
        const gasResult = await gasResponse.json();
        return new Response(
          JSON.stringify({
            success: true,
            meetingLink: gasResult.meetingLink || null,
            queueURL: gasResult.queueURL || null,
            url: gasResult.url || null,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      case "disable_plan": {
        const { email } = body as DisablePlanRequest;
        if (!validateEmail(email))
          return new Response(JSON.stringify({ error: "Email inválido" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        const token = authHeader?.replace("Bearer ", "") || "";
        const LOVABLE_CLOUD_URL_DP = "https://yrsjluhhnhxogdgnbnya.supabase.co";
        const LOVABLE_CLOUD_ANON_KEY_DP =
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlyc2psdWhobmh4b2dkZ25ibnlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyMjY1NzUsImV4cCI6MjA4MzgwMjU3NX0.fdF2KZage73BDDM0Shs7cMRLnJdFPUef866R5vZBmnY";
        const authClientDP = createClient(LOVABLE_CLOUD_URL_DP, LOVABLE_CLOUD_ANON_KEY_DP, {
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: authDataDP, error: authError } = await authClientDP.auth.getUser(token);
        if (authError || !authDataDP?.user)
          return new Response(JSON.stringify({ error: "Não autorizado" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        const { data: roles } = await authClientDP.from("user_roles").select("role").eq("user_id", authDataDP.user.id);
        const isAdminDP = roles?.some((r: any) => r.role === "admin");
        if (!isAdminDP)
          return new Response(JSON.stringify({ error: "Apenas administradores podem desabilitar planos" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        const { data: updatedPlan, error: updateError } = await supabase
          .from("patient_plans")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("email", email)
          .eq("status", "active")
          .select();
        if (updateError)
          return new Response(JSON.stringify({ error: "Erro ao desabilitar plano" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        if (!updatedPlan || updatedPlan.length === 0)
          return new Response(JSON.stringify({ error: "Nenhum plano ativo encontrado para este email" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        return new Response(
          JSON.stringify({
            success: true,
            message: `${updatedPlan.length} plano(s) desabilitado(s)`,
            plans: updatedPlan,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      case "change_plan": {
        const { plan_id, new_plan_code, new_expires_at } = body as ChangePlanRequest;
        if (!validateString(plan_id, 255) || !validateString(new_plan_code, 50))
          return new Response(JSON.stringify({ error: "Dados inválidos" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        const token = authHeader?.replace("Bearer ", "") || "";
        const LOVABLE_CLOUD_URL_CP = "https://yrsjluhhnhxogdgnbnya.supabase.co";
        const LOVABLE_CLOUD_ANON_KEY_CP =
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlyc2psdWhobmh4b2dkZ25ibnlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyMjY1NzUsImV4cCI6MjA4MzgwMjU3NX0.fdF2KZage73BDDM0Shs7cMRLnJdFPUef866R5vZBmnY";
        const authClientCP = createClient(LOVABLE_CLOUD_URL_CP, LOVABLE_CLOUD_ANON_KEY_CP, {
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: authDataCP, error: authError } = await authClientCP.auth.getUser(token);
        if (authError || !authDataCP?.user)
          return new Response(JSON.stringify({ error: "Não autorizado" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        const { data: roles } = await authClientCP.from("user_roles").select("role").eq("user_id", authDataCP.user.id);
        const isAdminCP = roles?.some((r: any) => r.role === "admin");
        if (!isAdminCP)
          return new Response(JSON.stringify({ error: "Apenas administradores podem alterar planos" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        const updateData: Record<string, any> = { plan_code: new_plan_code, updated_at: new Date().toISOString() };
        if (new_expires_at) updateData.plan_expires_at = new_expires_at;
        const { data: updatedPlan, error: updateError } = await supabase
          .from("patient_plans")
          .update(updateData)
          .eq("id", plan_id)
          .select()
          .single();
        if (updateError)
          return new Response(JSON.stringify({ error: "Erro ao alterar plano" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        if (!updatedPlan)
          return new Response(JSON.stringify({ error: "Plano não encontrado" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        return new Response(
          JSON.stringify({ success: true, message: "Plano alterado com sucesso", plan: updatedPlan }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      case "deactivate_plan_manual": {
        const { patient_email } = body;
        if (!patient_email)
          return new Response(JSON.stringify({ success: false, error: "Missing patient_email" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        const normalizedEmail = patient_email.toLowerCase().trim();
        const { error: updateError } = await supabase
          .from("patient_plans")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("email", normalizedEmail);
        if (updateError)
          return new Response(
            JSON.stringify({ success: false, error: "Failed to deactivate plan", details: updateError.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        return new Response(JSON.stringify({ success: true, message: "Plan deactivated successfully" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "activate_plan_manual": {
        const token = authHeader?.replace("Bearer ", "");
        if (!token)
          return new Response(JSON.stringify({ success: false, step: "admin_auth", error: "No token provided" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        const LOVABLE_CLOUD_URL = "https://yrsjluhhnhxogdgnbnya.supabase.co";
        const LOVABLE_CLOUD_ANON_KEY =
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlyc2psdWhobmh4b2dkZ25ibnlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyMjY1NzUsImV4cCI6MjA4MzgwMjU3NX0.fdF2KZage73BDDM0Shs7cMRLnJdFPUef866R5vZBmnY";
        const authClient = createClient(LOVABLE_CLOUD_URL, LOVABLE_CLOUD_ANON_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: authData, error: authError } = await authClient.auth.getUser(token);
        if (authError || !authData?.user)
          return new Response(
            JSON.stringify({
              success: false,
              step: "admin_auth",
              error: "Token inválido",
              details: authError?.message || "No user data returned",
            }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        const adminUserId = authData.user.id;
        const adminEmail = authData.user.email;
        const { data: roles, error: rolesError } = await authClient
          .from("user_roles")
          .select("role")
          .eq("user_id", adminUserId);
        if (rolesError)
          return new Response(
            JSON.stringify({
              success: false,
              step: "admin_role_check",
              error: "Failed to check admin role",
              details: rolesError.message,
            }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        const isAdmin = roles?.some((r: any) => r.role === "admin");
        if (!isAdmin)
          return new Response(
            JSON.stringify({ success: false, step: "admin_role_check", error: "Forbidden - Admin role required" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        const { patient_email, patient_id, plan_code, duration_days, send_email } = body;
        if (!patient_email || !plan_code || !duration_days)
          return new Response(
            JSON.stringify({ success: false, step: "validation", error: "Missing required fields" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + parseInt(duration_days));
        const expiresAtDate = expiresAt.toISOString().split("T")[0];
        const normalizedPatientEmail = patient_email.toLowerCase().trim();
        let patient: { id: string | null; user_id: string | null } | null = null;
        let patientLookupMethod = "none";
        if (patient_id) {
          const { data: patientById } = await supabase
            .from("patients")
            .select("id, user_id")
            .eq("id", patient_id)
            .maybeSingle();
          if (patientById) {
            patient = patientById;
            patientLookupMethod = "by_patient_id";
          }
        }
        if (!patient) {
          const { data: patientByEmail, error: errByEmail } = await supabase
            .from("patients")
            .select("id, user_id")
            .eq("email", normalizedPatientEmail)
            .maybeSingle();
          if (errByEmail)
            return new Response(
              JSON.stringify({
                success: false,
                step: "patient_lookup",
                error: "Database error",
                details: errByEmail.message,
              }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          if (patientByEmail) {
            patient = patientByEmail;
            patientLookupMethod = "by_email";
          }
        }
        if (!patient) {
          patient = { id: null, user_id: null };
          patientLookupMethod = "email_only_no_patient_record";
        }
        const { data: existingPlan } = await supabase
          .from("patient_plans")
          .select("id")
          .eq("email", normalizedPatientEmail)
          .maybeSingle();
        let planUpsertError = null;
        if (existingPlan) {
          const { error: updateErr } = await supabase
            .from("patient_plans")
            .update({
              plan_code,
              status: "active",
              plan_expires_at: expiresAtDate,
              user_id: patient.user_id || null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingPlan.id);
          planUpsertError = updateErr;
        } else {
          const { error: insertErr } = await supabase
            .from("patient_plans")
            .insert({
              email: normalizedPatientEmail,
              user_id: patient.user_id || null,
              plan_code,
              status: "active",
              plan_expires_at: expiresAtDate,
            });
          planUpsertError = insertErr;
        }
        if (planUpsertError)
          return new Response(
            JSON.stringify({
              success: false,
              step: "plan_upsert",
              error: "Failed to upsert plan",
              details: planUpsertError.message,
            }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        try {
          await supabase
            .from("metrics")
            .insert({
              metric_type: "manual_plan_activation",
              metadata: {
                patient_email,
                plan_code,
                activated_by_admin: adminEmail,
                duration_days,
                expires_at: expiresAtDate,
                timestamp: new Date().toISOString(),
              },
            });
        } catch (e) {}
        const { data: patientFull } = await supabase
          .from("patients")
          .select("cpf, first_name, last_name, phone_e164, gender, birth_date")
          .eq("email", patient_email.toLowerCase().trim())
          .maybeSingle();
        if (patientFull?.cpf) {
          const clickLifePlanoId = plan_code.includes("COM_ESP") ? 864 : plan_code.includes("SEM_ESP") ? 863 : 864;
          try {
            await supabase.functions.invoke("activate-clicklife-manual", {
              body: {
                email: patient_email,
                cpf: patientFull.cpf,
                nome: `${patientFull.first_name || ""} ${patientFull.last_name || ""}`.trim(),
                telefone: patientFull.phone_e164,
                sexo: patientFull.gender,
                datanascimento: patientFull.birth_date,
                planoid: clickLifePlanoId,
              },
            });
          } catch (e) {}
        }
        return new Response(
          JSON.stringify({
            success: true,
            message: "Plano ativado com sucesso",
            patient_email,
            plan_code,
            expires_at: expiresAtDate,
            patient_lookup_method: patientLookupMethod,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      case "invite-familiar": {
        const token = authHeader!.replace("Bearer ", "");
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser(token);
        if (authError || !user)
          return new Response(JSON.stringify({ error: "Não autorizado" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        const { plan_id, email } = body as InviteFamiliarRequest;
        if (!validateEmail(email))
          return new Response(JSON.stringify({ error: "Email inválido" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        const { data: plan, error: planError } = await supabase
          .from("patient_plans")
          .select("*")
          .eq("id", plan_id)
          .eq("user_id", user.id)
          .eq("status", "active")
          .single();
        if (planError || !plan)
          return new Response(JSON.stringify({ error: "Plano não encontrado ou sem permissão" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        if (!plan.plan_code.includes("FAM"))
          return new Response(JSON.stringify({ error: "Este plano não permite adicionar familiares" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        const { data: existingInvite } = await supabase
          .from("pending_family_invites")
          .select("id, status")
          .eq("titular_plan_id", plan_id)
          .eq("email", email.toLowerCase())
          .maybeSingle();
        if (existingInvite?.status === "pending")
          return new Response(JSON.stringify({ error: "Já existe um convite pendente para este email" }), {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        if (existingInvite?.status === "completed")
          return new Response(JSON.stringify({ error: "Este familiar já está cadastrado no plano" }), {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        const { count } = await supabase
          .from("pending_family_invites")
          .select("*", { count: "exact", head: true })
          .eq("titular_plan_id", plan_id)
          .in("status", ["pending", "completed"]);
        if ((count || 0) >= 3)
          return new Response(JSON.stringify({ error: "Limite de 3 familiares atingido" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        const inviteToken = crypto.randomUUID();
        const { data: titularPatient } = await supabase
          .from("patients")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!titularPatient?.id)
          return new Response(JSON.stringify({ error: "Perfil do titular não encontrado" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        const { error: insertError } = await supabase
          .from("pending_family_invites")
          .insert({
            titular_patient_id: titularPatient.id,
            titular_plan_id: plan_id,
            email: email.toLowerCase(),
            token: inviteToken,
            status: "pending",
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          });
        if (insertError)
          return new Response(JSON.stringify({ error: "Erro ao criar convite" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        try {
          const inviteLink = `https://prontiasaude.com.br/completar-perfil?token_familiar=${inviteToken}`;
          const { data: titular } = await supabase
            .from("patients")
            .select("first_name, last_name")
            .eq("id", user.id)
            .single();
          const titularName = titular ? `${titular.first_name || ""} ${titular.last_name || ""}`.trim() : "Um membro";
          await supabase.functions.invoke("send-form-emails", {
            body: { type: "family-invite", data: { email: email.toLowerCase(), titularName, inviteLink } },
          });
        } catch (e) {}
        return new Response(JSON.stringify({ success: true, message: "Convite enviado com sucesso" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "resend-family-invite": {
        const token = authHeader!.replace("Bearer ", "");
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser(token);
        if (authError || !user)
          return new Response(JSON.stringify({ error: "Não autorizado" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        const { invite_id } = body as ResendFamilyInviteRequest;
        const { data: titularPatient } = await supabase
          .from("patients")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!titularPatient?.id)
          return new Response(JSON.stringify({ error: "Perfil do titular não encontrado" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        const { data: invite, error: inviteError } = await supabase
          .from("pending_family_invites")
          .select("*, patient_plans(plan_code)")
          .eq("id", invite_id)
          .eq("titular_patient_id", titularPatient.id)
          .eq("status", "pending")
          .single();
        if (inviteError || !invite)
          return new Response(JSON.stringify({ error: "Convite não encontrado" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        const newToken = crypto.randomUUID();
        const newExpires = new Date();
        newExpires.setDate(newExpires.getDate() + 7);
        await supabase
          .from("pending_family_invites")
          .update({ token: newToken, expires_at: newExpires.toISOString() })
          .eq("id", invite_id);
        try {
          const inviteLink = `https://prontiasaude.com.br/completar-perfil?token_familiar=${newToken}`;
          const { data: titular } = await supabase
            .from("patients")
            .select("first_name, last_name")
            .eq("id", user.id)
            .single();
          const titularName = titular ? `${titular.first_name || ""} ${titular.last_name || ""}`.trim() : "Um membro";
          await supabase.functions.invoke("send-form-emails", {
            body: { type: "family-invite", data: { email: invite.email, titularName, inviteLink } },
          });
        } catch (e) {}
        return new Response(JSON.stringify({ success: true, message: "Convite reenviado" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "activate-family-member": {
        const { invite_token, user_id: passedUserId } = body;
        if (!invite_token)
          return new Response(JSON.stringify({ error: "Token de convite é obrigatório" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        const { data: invite, error: inviteError } = await supabase
          .from("pending_family_invites")
          .select("*, patient_plans(plan_code, plan_expires_at)")
          .eq("token", invite_token)
          .eq("status", "pending")
          .single();
        if (inviteError || !invite)
          return new Response(JSON.stringify({ error: "Convite inválido ou já utilizado" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        if (new Date(invite.expires_at) < new Date())
          return new Response(JSON.stringify({ error: "Convite expirado" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        let memberId = passedUserId;
        if (!memberId) {
          const { data: authUser } = await supabase.auth.admin.getUserByEmail(invite.email);
          memberId = authUser?.user?.id;
        }
        if (memberId) {
          const { error: patientError } = await supabase
            .from("patients")
            .upsert(
              { id: memberId, email: invite.email, profile_complete: false, updated_at: new Date().toISOString() },
              { onConflict: "id", ignoreDuplicates: false },
            );
        }
        const { data: existingPlan } = await supabase
          .from("patient_plans")
          .select("id, plan_code")
          .eq("email", invite.email)
          .eq("status", "active")
          .maybeSingle();
        if (existingPlan) {
          await supabase
            .from("pending_family_invites")
            .update({ status: "completed", accepted_at: new Date().toISOString() })
            .eq("id", invite.id);
          return new Response(
            JSON.stringify({
              success: true,
              plan_code: existingPlan.plan_code,
              message: "Usuário já possui plano ativo",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        const { error: planError } = await supabase
          .from("patient_plans")
          .insert({
            user_id: memberId,
            email: invite.email,
            plan_code: invite.patient_plans?.plan_code || "FAM_BASIC",
            plan_expires_at: invite.patient_plans?.plan_expires_at,
            status: "active",
          });
        if (planError)
          return new Response(JSON.stringify({ error: "Erro ao ativar plano do familiar" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        await supabase
          .from("pending_family_invites")
          .update({ status: "completed", accepted_at: new Date().toISOString() })
          .eq("id", invite.id);
        let clicklife_sync: "ok" | "failed" | "partial" | "skipped" = "skipped";
        let clicklife_error_message: string | undefined;
        let resolvedPlanCode: string | undefined;
        try {
          const { data: dependenteData } = await supabase
            .from("patients")
            .select(
              "cpf, first_name, last_name, phone_e164, gender, birth_date, cep, address_line, address_number, city, state",
            )
            .eq("email", invite.email)
            .maybeSingle();
          const { data: titularData } = await supabase
            .from("patients")
            .select("cpf")
            .eq("id", invite.titular_patient_id)
            .single();
          const { data: titularPlanData } = await supabase
            .from("patient_plans")
            .select("plan_code")
            .eq("id", invite.titular_plan_id)
            .maybeSingle();
          const planCode = titularPlanData?.plan_code || invite.patient_plans?.plan_code || "FAMILY";
          resolvedPlanCode = planCode;
          if (dependenteData?.cpf && titularData?.cpf) {
            const planoid = getClickLifePlanIdForDependente(planCode);
            const syncResult = await syncDependenteClickLife(
              {
                cpf: dependenteData.cpf,
                nome: `${dependenteData.first_name || ""} ${dependenteData.last_name || ""}`.trim() || "Dependente",
                email: invite.email,
                telefone: dependenteData.phone_e164,
                sexo: dependenteData.gender,
                birthDate: dependenteData.birth_date,
                cep: dependenteData.cep,
                logradouro: dependenteData.address_line,
                numero: dependenteData.address_number,
                cidade: dependenteData.city,
                estado: dependenteData.state,
              },
              titularData.cpf,
              planoid,
            );
            clicklife_sync = syncResult.status;
            clicklife_error_message = syncResult.error_message;
            await supabase
              .from("metrics")
              .insert({
                metric_type: "clicklife_family_activation",
                status: syncResult.success ? "success" : "failed",
                patient_email: invite.email,
                plan_code: planCode,
                metadata: { planoid, sync_status: syncResult.status, error: syncResult.error_message },
              });
          } else {
            clicklife_sync = "skipped";
            clicklife_error_message = "Dados insuficientes";
          }
        } catch (e) {
          clicklife_sync = "failed";
          clicklife_error_message = e instanceof Error ? e.message : "Exception";
        }
        return new Response(
          JSON.stringify({
            success: true,
            plan_code: resolvedPlanCode || invite.patient_plans?.plan_code,
            clicklife_sync,
            clicklife_error_message: clicklife_sync !== "ok" ? clicklife_error_message : undefined,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      case "ensure_patient": {
        let { user_id, email } = body;
        if (!user_id && !email)
          return new Response(JSON.stringify({ error: "user_id ou email é obrigatório" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        if (email) {
          const normalizedEmail = email.toLowerCase().trim();
          const { data: prodPatient } = await supabase
            .from("patients")
            .select("id, user_id, profile_complete")
            .eq("email", normalizedEmail)
            .maybeSingle();
          if (prodPatient)
            return new Response(
              JSON.stringify({
                success: true,
                patient_id: prodPatient.id,
                profile_complete: prodPatient.profile_complete,
                already_existed: true,
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          let foundUserId: string | null = null;
          let page = 1;
          const perPage = 50;
          const maxPages = 50;
          while (page <= maxPages) {
            const { data: authPage } = await supabase.auth.admin.listUsers({ page, perPage });
            const users = authPage?.users || [];
            if (users.length === 0) break;
            const found = users.find((u: any) => u.email?.toLowerCase() === normalizedEmail);
            if (found) {
              foundUserId = found.id;
              break;
            }
            if (users.length < perPage) break;
            page++;
          }
          if (foundUserId) user_id = foundUserId;
        }
        if (!user_id)
          return new Response(JSON.stringify({ error: "Não foi possível resolver user_id" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        const { data: existing, error: checkError } = await supabase
          .from("patients")
          .select("id, profile_complete")
          .eq("user_id", user_id)
          .maybeSingle();
        if (checkError)
          return new Response(JSON.stringify({ error: checkError.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        if (existing)
          return new Response(
            JSON.stringify({
              success: true,
              patient_id: existing.id,
              profile_complete: existing.profile_complete,
              already_existed: true,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        const newPatientId = crypto.randomUUID();
        const { data: newPatient, error: insertError } = await supabase
          .from("patients")
          .insert({ id: newPatientId, user_id, email: email || null, profile_complete: false })
          .select("id, profile_complete")
          .single();
        if (insertError) {
          if (insertError.code === "23505") {
            const { data: conflictPatient } = await supabase
              .from("patients")
              .select("id, profile_complete")
              .eq("user_id", user_id)
              .maybeSingle();
            return new Response(
              JSON.stringify({
                success: true,
                patient_id: conflictPatient?.id,
                profile_complete: conflictPatient?.profile_complete,
                already_existed: true,
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }
          return new Response(JSON.stringify({ error: insertError.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(
          JSON.stringify({
            success: true,
            patient_id: newPatient?.id,
            profile_complete: false,
            already_existed: false,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      case "admin_update_patient": {
        const token = authHeader?.replace("Bearer ", "");
        if (!token)
          return new Response(JSON.stringify({ success: false, error: "Token de autenticação não fornecido" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        const LOVABLE_CLOUD_URL = Deno.env.get("CLOUD_SUPABASE_URL") || "https://yrsjluhhnhxogdgnbnya.supabase.co";
        const LOVABLE_CLOUD_SERVICE_KEY = Deno.env.get("CLOUD_SUPABASE_SERVICE_ROLE_KEY");
        const LOVABLE_CLOUD_ANON_KEY =
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlyc2psdWhobmh4b2dkZ25ibnlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyMjY1NzUsImV4cCI6MjA4MzgwMjU3NX0.fdF2KZage73BDDM0Shs7cMRLnJdFPUef866R5vZBmnY";
        const authClient = createClient(LOVABLE_CLOUD_URL, LOVABLE_CLOUD_SERVICE_KEY || LOVABLE_CLOUD_ANON_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: authData, error: authError } = await authClient.auth.getUser(token);
        if (authError || !authData?.user)
          return new Response(
            JSON.stringify({
              success: false,
              error: "Sessão inválida - faça login novamente",
              details: authError?.message,
            }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        const adminUserId = authData.user.id;
        const adminEmail = authData.user.email;
        const { data: roles, error: rolesError } = await authClient
          .from("user_roles")
          .select("role")
          .eq("user_id", adminUserId);
        if (rolesError)
          return new Response(JSON.stringify({ success: false, error: "Falha ao verificar permissões" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        const isAdmin = roles?.some((r: any) => r.role === "admin");
        if (!isAdmin)
          return new Response(JSON.stringify({ success: false, error: "Permissão negada - apenas administradores" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        const { patient_id, email: patientEmail, updates } = body;
        if (!patient_id && !patientEmail)
          return new Response(JSON.stringify({ success: false, error: "patient_id ou email é obrigatório" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        if (!updates || typeof updates !== "object")
          return new Response(JSON.stringify({ success: false, error: "updates é obrigatório" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        const ALLOWED_FIELDS = [
          "first_name",
          "last_name",
          "cpf",
          "phone_e164",
          "birth_date",
          "gender",
          "cep",
          "address_line",
          "address_number",
          "city",
          "state",
          "complement",
          "neighborhood",
        ];
        const sanitizedUpdates: Record<string, any> = {};
        for (const key of Object.keys(updates)) {
          if (ALLOWED_FIELDS.includes(key)) {
            if (key === "birth_date" && updates[key]) {
              const normalized = normalizeDateToISO(updates[key]);
              if (normalized) sanitizedUpdates[key] = normalized;
            } else sanitizedUpdates[key] = updates[key];
          }
        }
        if (Object.keys(sanitizedUpdates).length === 0)
          return new Response(JSON.stringify({ success: false, error: "Nenhum campo válido para atualização" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        sanitizedUpdates.updated_at = new Date().toISOString();
        let updateError = null;
        if (patient_id) {
          const { error } = await supabase.from("patients").update(sanitizedUpdates).eq("id", patient_id);
          updateError = error;
        } else if (patientEmail) {
          const { error } = await supabase
            .from("patients")
            .update(sanitizedUpdates)
            .eq("email", patientEmail.toLowerCase().trim());
          updateError = error;
        }
        if (updateError)
          return new Response(
            JSON.stringify({ success: false, error: "Falha ao atualizar paciente", details: updateError.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        try {
          await supabase
            .from("metrics")
            .insert({
              metric_type: "admin_patient_update",
              metadata: {
                patient_id,
                patient_email: patientEmail,
                fields_updated: Object.keys(sanitizedUpdates),
                updated_by: adminEmail,
                timestamp: new Date().toISOString(),
              },
            });
        } catch (e) {}
        return new Response(
          JSON.stringify({
            success: true,
            message: "Paciente atualizado com sucesso",
            updated_fields: Object.keys(sanitizedUpdates),
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      default:
        return new Response(JSON.stringify({ error: `Operação desconhecida: ${body.operation}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in patient-operations:", errorMessage);
    console.error("Operation:", operationName);
    const errorCorsHeaders = getCorsHeaders(req.headers.get("origin"));
    return new Response(
      JSON.stringify({ success: false, error: "Erro interno do servidor", debug_hint: errorMessage.substring(0, 200) }),
      { headers: { ...errorCorsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
