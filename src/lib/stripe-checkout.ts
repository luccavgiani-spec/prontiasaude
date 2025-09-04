// Stripe Checkout via Apps Script
import { getEmailAtual, getPhone } from "@/lib/utils";

// ==== CONFIG ====
const APPS_SCRIPT_ENDPOINT = 'https://script.google.com/macros/s/AKfycbzrbxFWk0fVpza0ZgFLWvS4cUghpGpCOyWb_VQAmvEtKSDbrptVg5K_M3QJ-m5rZ_ZRrw/exec?route=checkout';

// Catálogo opcional (pode manter vazio se usar data-attrs/override)
export const CATALOG = {
  // Exemplo (trocar price_ids reais se for usar catálogo):
  consulta_clinica: { priceId: 'price_XXXXXXXX1', sku: 'consulta_clinica' },
  renovacao_receita: { priceId: 'price_XXXXXXXX2', sku: 'renovacao_receita' },
  laudo_bariatrica: { priceId: 'price_XXXXXXXX3', sku: 'laudo_bariatrica' },
  laudo_laqueadura: { priceId: 'price_XXXXXXXX4', sku: 'laudo_laqueadura' },
  psicologa: { priceId: 'price_XXXXXXXX5', sku: 'psicologa' },
  psiquiatria: { priceId: 'price_XXXXXXXX6', sku: 'psiquiatria' },
  consulta_nutricional: { priceId: 'price_XXXXXXXX7', sku: 'consulta_nutricional' },
  consulta_pediatrica: { priceId: 'price_XXXXXXXX8', sku: 'consulta_pediatrica' },
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
  // Não force login: use email/phone do usuário logado apenas se existir
  let email = (args.email || await _currentUserEmail_() || '').trim();
  let phoneE164 = (args.phoneE164 || await _currentUserPhone_() || '').trim();

  // Se o componente tiver um form com email/telefone, busque também:
  if (!email && args.formSelector) {
    const f = document.querySelector(args.formSelector);
    if (f) {
      email = (f.querySelector('input[type="email"]')?.value || '').trim() || email;
      const p = (f.querySelector('input[name="phone"], input[type="tel"]')?.value || '').trim();
      if (p) phoneE164 = p;
    }
  }
  if (!email) {
    alert('Informe seu e-mail para prosseguir.');
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
  const mapping: Record<string, ProductKey> = {
    'consulta-clinica-geral': 'consulta_clinica',
    'renovacao-receita-medica': 'renovacao_receita',
    'laudo-medico-bariatrica': 'laudo_bariatrica',
    'laudo-medico-laqueadura': 'laudo_laqueadura',
    'consulta-psicologa': 'psicologa',
    'consulta-psiquiatra': 'psiquiatria',
    'consulta-nutricional': 'consulta_nutricional',
    'consulta-pediatrica': 'consulta_pediatrica',
  };

  return mapping[slug] || null;
}

// Função para obter informações do produto
export function getProductInfo(productKey: ProductKey) {
  return CATALOG[productKey];
}