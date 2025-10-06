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
 * Abre o link do InfinitePay em uma nova aba/modal
 */
export async function openInfinitePayCheckout(sku: string): Promise<boolean> {
  const link = await resolveLinkBySku(sku);
  
  if (!link) {
    return false;
  }
  
  // Abrir em nova aba
  window.open(link, '_blank');
  return true;
}

/**
 * Interface para especialidade retornada pela API
 */
export interface Especialidade {
  label: string;
  sku: string;
}

interface EspecialidadesResponse {
  ok: boolean;
  items?: Especialidade[];
  error?: string;
}

/**
 * Busca lista de especialidades disponíveis do Google Apps Script
 */
export async function fetchEspecialidades(): Promise<Especialidade[]> {
  try {
    const url = `${GAS_BASE}?fn=listEspecialidades`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error('Erro ao buscar especialidades:', response.status);
      return [];
    }
    
    const data: EspecialidadesResponse = await response.json();
    
    if (data.ok && Array.isArray(data.items)) {
      return data.items;
    }
    
    console.error('Resposta inválida ao buscar especialidades');
    return [];
  } catch (error) {
    console.error('Erro ao buscar especialidades:', error);
    return [];
  }
}
