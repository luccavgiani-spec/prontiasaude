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

// ✅ URL e chave FIXAS do projeto Supabase original (ploqujuhpwutpcibedbr)
const PRODUCTION_SUPABASE_URL = "https://ploqujuhpwutpcibedbr.supabase.co";
const PRODUCTION_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsb3F1anVocHd1dHBjaWJlZGJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3NjYxODQsImV4cCI6MjA3MjM0MjE4NH0.WD3MXt1Y4sYxkaCPGgD0s8LdhPx_7eEQ1ewaFhnQ8-I";

/**
 * Cliente Supabase conectado diretamente ao projeto de PRODUÇÃO.
 * Usar para operações que precisam ler/escrever dados reais do backend.
 * 
 * NOTA: Este cliente usa anon key e depende de políticas RLS permissivas para leitura.
 * Para escrita, usar Edge Functions com service_role.
 */
export const supabaseProduction = createClient<Database>(
  PRODUCTION_SUPABASE_URL, 
  PRODUCTION_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  }
);

// Exportar constantes para uso em outros lugares se necessário
export const PRODUCTION_URL = PRODUCTION_SUPABASE_URL;
export const PRODUCTION_ANON_KEY = PRODUCTION_SUPABASE_ANON_KEY;
