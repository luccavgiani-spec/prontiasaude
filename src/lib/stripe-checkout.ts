// Stripe Checkout via Apps Script
import { toast } from "@/hooks/use-toast";

// Apps Script endpoint
const APPS_SCRIPT_ENDPOINT = 'https://script.google.com/macros/s/AKfycbzrbxFWk0fVpza0ZgFLWvS4cUghpGpCOyWb_VQAmvEtKSDbrptVg5K_M3QJ-m5rZ_ZRrw/exec?route=checkout';

// Catálogo de produtos - ajuste os price_id reais conforme necessário
export const CATALOG = {
  consulta_clinica: { priceId: 'price_XXXXXXXX1', sku: 'consulta_clinica' },
  renovacao_receita: { priceId: 'price_XXXXXXXX2', sku: 'renovacao_receita' },
  laudo_bariatrica: { priceId: 'price_XXXXXXXX3', sku: 'laudo_bariatrica' },
  laudo_laqueadura: { priceId: 'price_XXXXXXXX4', sku: 'laudo_laqueadura' },
  psicologa: { priceId: 'price_XXXXXXXX5', sku: 'psicologa' },         // PSICO
  psiquiatria: { priceId: 'price_XXXXXXXX6', sku: 'psiquiatria' },     // PSICO
  consulta_nutricional: { priceId: 'price_XXXXXXXX7', sku: 'consulta_nutricional' },
  consulta_pediatrica: { priceId: 'price_XXXXXXXX8', sku: 'consulta_pediatrica' },
  // Adicione outros serviços conforme necessário
};

export type ProductKey = keyof typeof CATALOG;

interface StartCheckoutParams {
  email: string;
  productKey: ProductKey;
  quantity?: number;
  phoneE164?: string;
}

// Função utilitária principal para iniciar o Stripe Checkout
export async function startCheckout({ 
  email, 
  productKey, 
  quantity = 1, 
  phoneE164 = '' 
}: StartCheckoutParams): Promise<void> {
  if (!email) {
    toast({
      title: "Erro de validação",
      description: "E-mail é obrigatório para continuar",
      variant: "destructive",
    });
    throw new Error('E-mail obrigatório');
  }

  const item = CATALOG[productKey];
  if (!item) {
    toast({
      title: "Produto inválido",
      description: "O produto selecionado não foi encontrado",
      variant: "destructive",
    });
    throw new Error('Produto inválido: ' + productKey);
  }

  // Mostrar loading (adicionar classe ao body se existir)
  try {
    document.body.classList.add('is-loading');
  } catch (e) {
    // Ignorar erro se não conseguir adicionar classe
  }

  const payload = {
    mode: 'payment',
    email,
    price_id: item.priceId,
    quantity,
    product_sku: item.sku,  // backend usa isso para decidir PRONTO x PSICO
    phone_e164: phoneE164   // opcional; Checkout também coleta
  };

  try {
    const res = await fetch(APPS_SCRIPT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const json = await res.json();
    
    if (!json.ok || !json.url) {
      console.error('Falha ao criar checkout:', json);
      throw new Error(json.error || 'Falha ao criar checkout');
    }

    // Remover loading
    try {
      document.body.classList.remove('is-loading');
    } catch (e) {
      // Ignorar erro
    }

    // Redireciona para o Stripe Checkout
    window.location.href = json.url;

  } catch (error) {
    // Remover loading em caso de erro
    try {
      document.body.classList.remove('is-loading');
    } catch (e) {
      // Ignorar erro
    }

    console.error('Erro ao criar checkout:', error);
    
    toast({
      title: "Erro no pagamento",
      description: "Não foi possível iniciar o pagamento. Tente novamente.",
      variant: "destructive",
    });

    throw error;
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