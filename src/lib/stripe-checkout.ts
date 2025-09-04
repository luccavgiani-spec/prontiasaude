// Stripe Checkout via Apps Script
import { getEmailAtual, getPhone } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

// ==== CONFIG ====
const APPS_SCRIPT_ENDPOINT = 'https://script.google.com/macros/s/AKfycbzrbxFWk0fVpza0ZgFLWvS4cUghpGpCOyWb_VQAmvEtKSDbrptVg5K_M3QJ-m5rZ_ZRrw/exec?route=checkout';

// Catálogo usando os dados reais do sistema
export const CATALOG = {
  consulta: { priceId: 'price_1S0SpxENBHjf6SQJYKfzA6xs', sku: 'CONSULTA_CLINICA' },
  renovacao: { priceId: 'price_1S0T9pENBHjf6SQJIQjyGiaG', sku: 'RENOVACAO_RECEITA' },
  psicologa: { priceId: 'price_1S0TAbENBHjf6SQJXFN80i1D', sku: 'PSICOLOGA' },
  psiquiatria: { priceId: 'price_1S0TAzENBHjf6SQJRC8ZpnT5', sku: 'PSIQUIATRIA' },
  laudo_bariatrica: { priceId: 'price_1S0TCsENBHjf6SQJpeAo8Nvr', sku: 'LAUDO_BARIATRICA' },
  laudo_laq_vas: { priceId: 'price_1S0TCNENBHjf6SQJIRlNoofO', sku: 'LAUDO_LAQ_VAS' },
};

export type ProductKey = keyof typeof CATALOG;

// ==== HELPERS ====
function _resolveProductInput_(args: any) {
  // 1) Diretamente por override (se passado)
  if (args?.override?.priceId && args?.override?.productSku) {
    return { priceId: args.override.priceId, sku: args.override.productSku, qty: Number(args.quantity || 1) };
  }
  // 2) Por productKey via CATALOG
  if (args?.productKey && CATALOG[args.productKey]) {
    const c = CATALOG[args.productKey];
    return { priceId: c.priceId, sku: c.sku, qty: Number(args.quantity || 1) };
  }
  // 3) Por argumentos diretos
  if (args?.priceId && args?.productSku) {
    return { priceId: args.priceId, sku: args.productSku, qty: Number(args.quantity || 1) };
  }
  // 4) Por data-attributes do botão/elemento (se veio um Event)
  if (args?.event && args.event.currentTarget) {
    const el = args.event.currentTarget;
    const priceId = el.getAttribute('data-price-id') || '';
    const sku = el.getAttribute('data-sku') || '';
    const qty = Number(el.getAttribute('data-qty') || 1);
    if (priceId && sku) return { priceId, sku, qty };
  }
  // 5) Nada suficiente
  return null;
}

async function _currentUserEmail_() {
  try {
    return await getEmailAtual() || '';
  } catch (_) { return ''; }
}

async function _currentUserPhone_() {
  try {
    return await getPhone() || '';
  } catch (_) { return ''; }
}

// ==== API PRINCIPAL ====
export async function startCheckout(args: any = {}) {
  // Verificar se o usuário está logado (OBRIGATÓRIO)
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.user) {
    // Se não estiver logado, redirecionar para área do paciente
    window.location.href = '/area-do-paciente';
    return;
  }

  // Usuário logado: usar dados do perfil
  let email = session.user.email || '';
  let phoneE164 = (args.phoneE164 || await _currentUserPhone_() || '').trim();

  if (!email) {
    alert('Erro: email do usuário não encontrado. Faça login novamente.');
    return;
  }

  // Resolver produto (catálogo, args diretos ou data-attrs)
  const item = _resolveProductInput_(args);
  if (!item) {
    console.error('Config de produto ausente. Informe { productKey } ou { priceId, productSku } ou data-price-id/data-sku.');
    alert('Erro: configuração do produto ausente.');
    return;
  }

  const payload = {
    mode: 'payment',
    email,
    price_id: item.priceId,
    quantity: item.qty || 1,
    product_sku: item.sku,
    phone_e164: phoneE164 || '' // opcional; checkout coleta também
  };

  try { document.body.classList.add('is-loading'); } catch(_) {}

  try {
    const res = await fetch(APPS_SCRIPT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    const json = await res.json().catch(() => ({}));

    try { document.body.classList.remove('is-loading'); } catch(_) {}

    if (!json?.ok || !json?.url) {
      console.error('Falha ao criar checkout:', json);
      alert('Não foi possível iniciar o pagamento. Tente novamente.');
      return;
    }
    window.location.href = json.url;
  } catch (error) {
    try { document.body.classList.remove('is-loading'); } catch(_) {}
    console.error('Erro ao criar checkout:', error);
    alert('Não foi possível iniciar o pagamento. Tente novamente.');
  }
}

// Função auxiliar para mapear slugs de serviços para chaves do catálogo
export function getProductKeyFromSlug(slug: string): ProductKey | null {
  // Mapeia diretamente os slugs do CATALOGO_SERVICOS para as chaves do CATALOG
  const mapping: Record<string, ProductKey> = {
    'consulta': 'consulta',
    'renovacao': 'renovacao', 
    'psicologa': 'psicologa',
    'psiquiatria': 'psiquiatria',
    'laudo_bariatrica': 'laudo_bariatrica',
    'laudo_laq_vas': 'laudo_laq_vas',
  };

  return mapping[slug] || null;
}

// Função para obter informações do produto
export function getProductInfo(productKey: ProductKey) {
  return CATALOG[productKey];
}