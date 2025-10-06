// Resolver de links do InfinitePay via Google Apps Script
import { GAS_BASE } from "./constants";

interface LinkResponse {
  ok: boolean;
  link?: string;
  error?: string;
}

// Cache de links para evitar chamadas repetidas
const linkCache = new Map<string, string>();

/**
 * Busca o link do InfinitePay via SKU na API do Google Apps Script
 */
export async function resolveLinkBySku(sku: string): Promise<string | null> {
  const normalizedSku = sku.trim().toUpperCase();
  
  // Verificar cache primeiro
  if (linkCache.has(normalizedSku)) {
    return linkCache.get(normalizedSku)!;
  }
  
  try {
    const url = `${GAS_BASE}?fn=getLink&sku=${encodeURIComponent(normalizedSku)}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error('Erro ao buscar link do InfinitePay:', response.status);
      return null;
    }
    
    const data: LinkResponse = await response.json();
    
    if (data.ok && data.link) {
      // Salvar no cache
      linkCache.set(normalizedSku, data.link);
      return data.link;
    }
    
    console.error('Link não encontrado para SKU:', normalizedSku);
    return null;
  } catch (error) {
    console.error('Erro ao resolver link por SKU:', error);
    return null;
  }
}

/**
 * Cria um checkout no InfinitePay com redirect para /confirmacao
 */
export async function createCheckoutWithRedirect(sku: string, description: string, price: number): Promise<string | null> {
  const normalizedSku = sku.trim().toUpperCase();
  
  try {
    const redirectUrl = `${window.location.origin}/confirmacao`;
    const url = `${GAS_BASE}?fn=createCheckout`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sku: normalizedSku,
        redirect_url: redirectUrl,
        description: description,
        price: Math.round(price * 100) // Converter para centavos
      })
    });
    
    if (!response.ok) {
      console.error('Erro ao criar checkout:', response.status);
      return null;
    }
    
    const data: LinkResponse = await response.json();
    
    if (data.ok && data.link) {
      return data.link;
    }
    
    console.error('Link não retornado na criação do checkout');
    return null;
  } catch (error) {
    console.error('Erro ao criar checkout:', error);
    return null;
  }
}

/**
 * Abre o checkout do InfinitePay com redirect para /confirmacao
 */
export async function openInfinitePayCheckout(sku: string, description?: string, price?: number): Promise<boolean> {
  // Se description e price forem fornecidos, tentar createCheckout primeiro
  if (description && price) {
    const checkoutLink = await createCheckoutWithRedirect(sku, description, price);
    
    if (checkoutLink) {
      // Redirecionar para o checkout (não abrir em nova aba)
      window.location.href = checkoutLink;
      return true;
    }
    
    // Se createCheckout falhar, tentar usar link direto como fallback
    console.warn('CreateCheckout falhou, tentando link direto...');
  }
  
  // Fallback: usar o link direto da planilha ou construir URL padrão
  let link = await resolveLinkBySku(sku);
  
  // Se não conseguir resolver, construir URL padrão do InfinitePay
  if (!link) {
    const normalizedSku = sku.trim().toLowerCase();
    const rawName = description || 'servico';
    const serviceName = rawName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    link = `https://loja.infinitepay.io/prontiasaude/${normalizedSku}-${serviceName}`;
    console.log('Usando URL padrão do InfinitePay:', link);
  }
  
  // Redirecionar direto (sem abrir em nova aba)
  window.location.href = link;
  return true;
}

