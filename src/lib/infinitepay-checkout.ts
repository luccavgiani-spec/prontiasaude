// InfinitePay Checkout via Modal Transparente
import { trackInitiateCheckout } from "@/lib/meta-tracking";

// Configurações globais (serão substituídas pelo usuário)
export const INFINITEPAY_CONFIG = {
  handle: 'cloudwalker', // Substituir pelo handle real
  partnerRedirectUrl: '/area-do-paciente', // URL da plataforma parceira
};

// Catálogo de produtos
export const CATALOG = {
  consulta: { 
    name: 'Consulta Clínica Geral', 
    priceCentavos: 5990, // R$ 59,90
    sku: 'CONSULTA_CLINICA' 
  },
  renovacao: { 
    name: 'Renovação de Receita', 
    priceCentavos: 3990, // R$ 39,90
    sku: 'RENOVACAO_RECEITA' 
  },
  psicologa: { 
    name: 'Consulta com Psicólogo', 
    priceCentavos: 5990, // R$ 59,90
    sku: 'PSICOLOGA' 
  },
  psiquiatria: { 
    name: 'Consulta com Psiquiatra', 
    priceCentavos: 19990, // R$ 199,90
    sku: 'PSIQUIATRIA' 
  },
  laudo_bariatrica: { 
    name: 'Laudo para Cirurgia Bariátrica', 
    priceCentavos: 19990, // R$ 199,90
    sku: 'LAUDO_BARIATRICA' 
  },
  laudo_laq_vas: { 
    name: 'Laudo para Laqueadura/Vasectomia', 
    priceCentavos: 14990, // R$ 149,90
    sku: 'LAUDO_LAQ_VAS' 
  },
};

export type ProductKey = keyof typeof CATALOG;

// Interface para dados do cliente
interface CustomerData {
  name?: string;
  email?: string;
  cellphone?: string;
  cep?: string;
  complement?: string;
  number?: string;
}

// Interface para item do checkout
interface CheckoutItem {
  name: string;
  price: number; // Em centavos
  quantity: number;
}

// Estado do checkout
interface CheckoutState {
  orderNsu: string;
  item: CheckoutItem;
  customerData?: CustomerData;
  pollingInterval?: number;
  startTime: number;
}

let currentCheckout: CheckoutState | null = null;

// Gerar UUID v4
function generateOrderNsu(): string {
  return crypto.randomUUID();
}

// Construir URL do checkout
function buildCheckoutUrl(
  item: CheckoutItem,
  orderNsu: string,
  customerData?: CustomerData
): string {
  const baseUrl = `https://checkout.infinitepay.io/${INFINITEPAY_CONFIG.handle}`;
  
  const items = JSON.stringify([item]);
  const redirectUrl = `${window.location.origin}/confirmacao`;
  
  const params = new URLSearchParams({
    items,
    order_nsu: orderNsu,
    redirect_url: redirectUrl,
  });

  // Adicionar dados do cliente se disponíveis
  if (customerData?.name) params.append('customer_name', customerData.name);
  if (customerData?.email) params.append('customer_email', customerData.email);
  if (customerData?.cellphone) params.append('customer_cellphone', customerData.cellphone);
  if (customerData?.cep) params.append('address_cep', customerData.cep);
  if (customerData?.complement) params.append('address_complement', customerData.complement);
  if (customerData?.number) params.append('address_number', customerData.number);

  return `${baseUrl}?${params.toString()}`;
}

// Verificar status do pagamento via polling
async function checkPaymentStatus(orderNsu: string): Promise<{ success: boolean; paid: boolean }> {
  try {
    const params = new URLSearchParams({
      handle: INFINITEPAY_CONFIG.handle,
      external_order_nsu: orderNsu,
    });

    const response = await fetch(
      `https://api.infinitepay.io/invoices/public/checkout/payment_check/${INFINITEPAY_CONFIG.handle}?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error('Erro ao verificar pagamento:', response.status);
      return { success: false, paid: false };
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Erro ao verificar pagamento:', error);
    return { success: false, paid: false };
  }
}

// Iniciar polling
function startPolling(
  orderNsu: string,
  onSuccess: () => void,
  onTimeout: () => void
): number {
  const POLLING_INTERVAL = 3000; // 3 segundos
  const MAX_DURATION = 5 * 60 * 1000; // 5 minutos
  const startTime = Date.now();

  const intervalId = window.setInterval(async () => {
    // Verificar timeout
    if (Date.now() - startTime > MAX_DURATION) {
      clearInterval(intervalId);
      onTimeout();
      return;
    }

    // Verificar status
    const status = await checkPaymentStatus(orderNsu);
    
    if (status.paid) {
      clearInterval(intervalId);
      onSuccess();
    }
  }, POLLING_INTERVAL);

  return intervalId;
}

// Parar polling
export function stopPolling() {
  if (currentCheckout?.pollingInterval) {
    clearInterval(currentCheckout.pollingInterval);
    currentCheckout = null;
  }
}

// Abrir modal de checkout
export function openCheckoutModal(
  productKey: ProductKey,
  customerData?: CustomerData,
  onSuccess?: () => void,
  onTimeout?: () => void
): void {
  const product = CATALOG[productKey];
  
  if (!product) {
    console.error('Produto não encontrado:', productKey);
    alert('Erro: produto não encontrado.');
    return;
  }

  // Gerar novo ORDER_NSU
  const orderNsu = generateOrderNsu();

  // Preparar item
  const item: CheckoutItem = {
    name: product.name,
    price: product.priceCentavos,
    quantity: 1,
  };

  // Construir URL do checkout
  const checkoutUrl = buildCheckoutUrl(item, orderNsu, customerData);

  // Salvar estado
  currentCheckout = {
    orderNsu,
    item,
    customerData,
    startTime: Date.now(),
  };

  // Track InitiateCheckout
  trackInitiateCheckout({
    content_name: product.name,
    content_category: 'servico_medico',
    content_ids: [product.sku],
    value: product.priceCentavos / 100,
  });

  // Criar e abrir modal
  createModal(checkoutUrl, orderNsu, onSuccess, onTimeout);
}

// Criar modal com iframe
function createModal(
  checkoutUrl: string,
  orderNsu: string,
  onSuccess?: () => void,
  onTimeout?: () => void
): void {
  // Criar overlay
  const overlay = document.createElement('div');
  overlay.id = 'infinitepay-modal-overlay';
  overlay.className = 'fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'checkout-title');

  // Criar container do modal
  const modalContainer = document.createElement('div');
  modalContainer.className = 'bg-background rounded-lg shadow-xl w-full max-w-4xl h-[90vh] flex flex-col';

  // Header do modal
  const header = document.createElement('div');
  header.className = 'flex items-center justify-between p-4 border-b';
  header.innerHTML = `
    <h2 id="checkout-title" class="text-xl font-semibold">Finalizar Pagamento</h2>
    <button 
      id="close-modal-btn" 
      class="text-muted-foreground hover:text-foreground transition-colors"
      aria-label="Fechar modal"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  `;

  // Loading overlay
  const loadingOverlay = document.createElement('div');
  loadingOverlay.id = 'iframe-loading';
  loadingOverlay.className = 'absolute inset-0 flex items-center justify-center bg-background/80 z-10';
  loadingOverlay.innerHTML = `
    <div class="text-center">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
      <p class="text-muted-foreground">Carregando checkout...</p>
    </div>
  `;

  // Iframe container
  const iframeContainer = document.createElement('div');
  iframeContainer.className = 'flex-1 relative overflow-hidden';
  
  const iframe = document.createElement('iframe');
  iframe.src = checkoutUrl;
  iframe.className = 'w-full h-full border-0';
  iframe.setAttribute('allow', 'payment');
  iframe.setAttribute('loading', 'lazy');

  // Remover loading quando iframe carregar
  iframe.onload = () => {
    loadingOverlay.remove();
  };

  iframeContainer.appendChild(loadingOverlay);
  iframeContainer.appendChild(iframe);

  // Montar modal
  modalContainer.appendChild(header);
  modalContainer.appendChild(iframeContainer);
  overlay.appendChild(modalContainer);
  document.body.appendChild(overlay);

  // Focar no título
  setTimeout(() => {
    const title = document.getElementById('checkout-title');
    title?.focus();
  }, 100);

  // Função para fechar modal
  const closeModal = (confirmed = false) => {
    if (!confirmed && currentCheckout) {
      const shouldClose = confirm('Tem certeza que deseja cancelar o pagamento?');
      if (!shouldClose) return;
    }

    stopPolling();
    overlay.remove();
  };

  // Botão fechar
  const closeBtn = document.getElementById('close-modal-btn');
  closeBtn?.addEventListener('click', () => closeModal(false));

  // ESC para fechar
  const handleEsc = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeModal(false);
      document.removeEventListener('keydown', handleEsc);
    }
  };
  document.addEventListener('keydown', handleEsc);

  // Iniciar polling
  const pollingInterval = startPolling(
    orderNsu,
    () => {
      // Sucesso
      closeModal(true);
      if (onSuccess) {
        onSuccess();
      } else {
        window.location.href = '/confirmacao';
      }
    },
    () => {
      // Timeout
      closeModal(true);
      if (onTimeout) {
        onTimeout();
      } else {
        alert('O tempo de espera expirou. Por favor, tente novamente.');
      }
    }
  );

  // Salvar intervalo no estado
  if (currentCheckout) {
    currentCheckout.pollingInterval = pollingInterval;
  }
}

// Função helper para obter dados do cliente do localStorage/sessão
export async function getCurrentCustomerData(): Promise<CustomerData | undefined> {
  // Tentar obter dados do usuário logado
  try {
    const emailAtual = localStorage.getItem('prontiaSaude_email');
    const phone = localStorage.getItem('prontiaSaude_phone');
    
    if (emailAtual) {
      return {
        email: emailAtual,
        cellphone: phone || undefined,
      };
    }
  } catch (error) {
    console.error('Erro ao obter dados do cliente:', error);
  }
  
  return undefined;
}

// Função auxiliar para mapear slugs de serviços para chaves do catálogo
export function getProductKeyFromSlug(slug: string): ProductKey | null {
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
