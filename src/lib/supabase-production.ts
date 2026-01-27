/**
 * 🔒 Cliente Supabase de PRODUÇÃO (Hardcoded)
 * 
 * Este cliente aponta DIRETAMENTE para o projeto Supabase de produção (ploqujuhpwutpcibedbr),
 * independente do que estiver configurado no .env (que pode apontar para Lovable Cloud).
 * 
 * USAR EM:
 * - SalesTab.tsx (buscar vendas)
 * - ClickLifeOverrideCard.tsx (ler/escrever overrides)
 * - CommunicareOverrideCard.tsx (ler/escrever overrides)
 * - ReportsTab.tsx (métricas e relatórios)
 * - Qualquer componente admin que precise ler/escrever dados reais
 * 
 * NÃO USAR:
 * - Para autenticação (usar supabase do client.ts)
 * - Para operações de usuário logado comum
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';

// ✅ URL e chave FIXAS do projeto Supabase original (ploqujuhpwutpcibedbr)
const PRODUCTION_SUPABASE_URL = "https://ploqujuhpwutpcibedbr.supabase.co";
const PRODUCTION_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsb3F1anVocHd1dHBjaWJlZGJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3NjYxODQsImV4cCI6MjA3MjM0MjE4NH0.WD3MXt1Y4sYxkaCPGgD0s8LdhPx_7eEQ1ewaFhnQ8-I";

/**
 * Cliente Supabase conectado diretamente ao projeto de PRODUÇÃO.
 * Usar para operações que precisam ler/escrever dados reais do backend.
 */
export const supabaseProduction = createClient<Database>(
  PRODUCTION_SUPABASE_URL, 
  PRODUCTION_SUPABASE_ANON_KEY,
  {
    auth: {
      // Permitir sessão para autenticação propagada
      persistSession: false,
      autoRefreshToken: false,
    }
  }
);

// Flag para evitar múltiplas propagações simultâneas
let isSessionSyncing = false;

/**
 * Propaga a sessão de autenticação do Cloud para o cliente de Produção.
 * Isso permite que admins autenticados no Cloud façam queries autenticadas na Produção.
 * 
 * @returns O cliente supabaseProduction com a sessão sincronizada
 */
export async function getProductionClientWithAuth() {
  // Evitar race conditions
  if (isSessionSyncing) {
    // Aguardar um pouco e retornar o cliente
    await new Promise(resolve => setTimeout(resolve, 100));
    return supabaseProduction;
  }

  try {
    isSessionSyncing = true;
    
    // Pegar sessão do Cloud (Lovable)
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('[supabase-production] Erro ao obter sessão do Cloud:', error);
      return supabaseProduction;
    }

    if (session?.access_token && session?.refresh_token) {
      // Setar sessão no cliente de Produção
      const { error: setError } = await supabaseProduction.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token
      });

      if (setError) {
        console.error('[supabase-production] Erro ao propagar sessão:', setError);
      } else {
        console.log('[supabase-production] ✅ Sessão propagada com sucesso para Produção');
      }
    } else {
      console.warn('[supabase-production] ⚠️ Nenhuma sessão ativa no Cloud para propagar');
    }
  } catch (err) {
    console.error('[supabase-production] Erro na propagação de sessão:', err);
  } finally {
    isSessionSyncing = false;
  }
  
  return supabaseProduction;
}

// Exportar constantes para uso em outros lugares se necessário
export const PRODUCTION_URL = PRODUCTION_SUPABASE_URL;
export const PRODUCTION_ANON_KEY = PRODUCTION_SUPABASE_ANON_KEY;
