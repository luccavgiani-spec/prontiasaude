/**
 * 🔐 Sistema de Autenticação Híbrida
 * 
 * Estratégia:
 * - Login: Verificar onde o email existe (Cloud ou Produção) e usar o cliente correto
 * - Cadastro: Novos usuários são criados em AMBOS os ambientes (Produção + Cloud)
 * - Bloquear cadastro se email já existir em qualquer ambiente
 */

import { supabase } from "@/integrations/supabase/client";
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { invokeCloudEdgeFunction } from './edge-functions';

// Cliente de Produção para autenticação de novos usuários
const PRODUCTION_URL = "https://ploqujuhpwutpcibedbr.supabase.co";
const PRODUCTION_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsb3F1anVocHd1dHBjaWJlZGJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3NjYxODQsImV4cCI6MjA3MjM0MjE4NH0.WD3MXt1Y4sYxkaCPGgD0s8LdhPx_7eEQ1ewaFhnQ8-I";

export const supabaseProductionAuth = createClient<Database>(
  PRODUCTION_URL, 
  PRODUCTION_ANON_KEY,
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
      storageKey: 'supabase-production-auth'
    }
  }
);

export type UserCheckResult = {
  existsInCloud: boolean;
  existsInProduction: boolean;
  loginEnvironment: 'cloud' | 'production' | 'none';
  canRegister: boolean;
};

/**
 * Verifica em qual ambiente o email existe
 * ✅ OTIMIZADO: Usa invokeCloudEdgeFunction para endpoint correto
 */
export const checkUserExists = async (email: string): Promise<UserCheckResult> => {
  try {
    console.log('[checkUserExists] Verificando email:', email.toLowerCase().trim());
    
    const { data, error } = await invokeCloudEdgeFunction('check-user-exists', {
      body: { email: email.toLowerCase().trim() }
    });

    if (error) {
      console.error('[checkUserExists] Error:', error);
      // Em caso de erro, retornar resultado que permite fallback
      return {
        existsInCloud: false,
        existsInProduction: false,
        loginEnvironment: 'none',
        canRegister: true
      };
    }

    console.log('[checkUserExists] Result:', data);
    return data as UserCheckResult;
  } catch (error) {
    console.error('[checkUserExists] Exception:', error);
    // Em caso de erro, retornar resultado que permite fallback
    return {
      existsInCloud: false,
      existsInProduction: false,
      loginEnvironment: 'none',
      canRegister: true
    };
  }
};

/**
 * Login híbrido - usa o ambiente correto baseado na verificação
 * ✅ CORREÇÃO: Adiciona fallback direto se checkUserExists falhar
 */
export const hybridSignIn = async (
  email: string, 
  password: string
): Promise<{ 
  success: boolean; 
  error?: string; 
  environment?: 'cloud' | 'production';
  session?: any;
}> => {
  const normalizedEmail = email.toLowerCase().trim();
  
  // Verificar onde o usuário existe
  const userCheck = await checkUserExists(normalizedEmail);
  console.log('[hybridSignIn] User check:', userCheck);

  // ✅ CORREÇÃO: Se checkUserExists falhou (loginEnvironment: 'none'), tentar login direto
  if (userCheck.loginEnvironment === 'none') {
    console.log('[hybridSignIn] checkUserExists retornou none, tentando login direto...');
    
    // Tentar Cloud primeiro
    console.log('[hybridSignIn] Tentando Cloud...');
    const { data: cloudData, error: cloudError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });
    
    if (!cloudError && cloudData?.session) {
      console.log('[hybridSignIn] ✅ Login Cloud bem-sucedido!');
      // Salvar ambiente no sessionStorage
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('auth_environment', 'cloud');
      }
      return { 
        success: true, 
        environment: 'cloud',
        session: cloudData.session
      };
    }
    
    // Se Cloud falhou com "Invalid login credentials", tentar Produção
    if (cloudError?.message === 'Invalid login credentials') {
      console.log('[hybridSignIn] Cloud retornou credenciais inválidas, tentando Produção...');
      const { data: prodData, error: prodError } = await supabaseProductionAuth.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      
      if (!prodError && prodData?.session) {
        console.log('[hybridSignIn] ✅ Login Produção bem-sucedido!');
        // Salvar ambiente no sessionStorage
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('auth_environment', 'production');
        }
        return { 
          success: true, 
          environment: 'production',
          session: prodData.session
        };
      }
      
      // Se ambos falharam com credenciais inválidas
      if (prodError?.message === 'Invalid login credentials') {
        return { 
          success: false, 
          error: 'Email ou senha incorretos.' 
        };
      }
      
      // Outro erro da Produção
      if (prodError) {
        return { 
          success: false, 
          error: prodError.message 
        };
      }
    }
    
    // Outro erro do Cloud (não credenciais inválidas)
    if (cloudError) {
      // Ainda tentar Produção como última chance
      console.log('[hybridSignIn] Erro Cloud, tentando Produção como fallback...');
      const { data: prodData, error: prodError } = await supabaseProductionAuth.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      
      if (!prodError && prodData?.session) {
        console.log('[hybridSignIn] ✅ Login Produção bem-sucedido (fallback)!');
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('auth_environment', 'production');
        }
        return { 
          success: true, 
          environment: 'production',
          session: prodData.session
        };
      }
      
      // Ambos falharam - retornar erro mais específico
      return { 
        success: false, 
        error: 'Email não encontrado. Verifique o email ou crie uma conta.' 
      };
    }
  }

  // Tentar login no ambiente correto (comportamento original)
  if (userCheck.loginEnvironment === 'cloud') {
    console.log('[hybridSignIn] Trying Cloud login...');
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      console.error('[hybridSignIn] Cloud login error:', error.message);
      return { 
        success: false, 
        error: error.message === 'Invalid login credentials' 
          ? 'Email ou senha incorretos.' 
          : error.message 
      };
    }

    // Salvar ambiente no sessionStorage
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('auth_environment', 'cloud');
    }

    return { 
      success: true, 
      environment: 'cloud',
      session: data.session
    };
  }

  if (userCheck.loginEnvironment === 'production') {
    console.log('[hybridSignIn] Trying Production login...');
    const { data, error } = await supabaseProductionAuth.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      console.error('[hybridSignIn] Production login error:', error.message);
      return { 
        success: false, 
        error: error.message === 'Invalid login credentials' 
          ? 'Email ou senha incorretos.' 
          : error.message 
      };
    }

    // Salvar ambiente no sessionStorage
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('auth_environment', 'production');
    }

    return { 
      success: true, 
      environment: 'production',
      session: data.session
    };
  }

  return { success: false, error: 'Erro ao identificar ambiente de login.' };
};

/**
 * Cadastro híbrido - cria usuários em AMBOS os ambientes (Produção + Cloud)
 * Usa Edge Function segura para garantir consistência
 */
export const hybridSignUp = async (
  email: string,
  password: string,
  metadata?: Record<string, any>
): Promise<{
  success: boolean;
  error?: string;
  user?: any;
  session?: any;
  prodUserId?: string;
  cloudUserId?: string;
}> => {
  const normalizedEmail = email.toLowerCase().trim();
  
  // Verificar se email já existe em qualquer ambiente
  const userCheck = await checkUserExists(normalizedEmail);
  console.log('[hybridSignUp] User check:', userCheck);

  if (!userCheck.canRegister) {
    return {
      success: false,
      error: 'Este email já está cadastrado. Faça login ou recupere sua senha.'
    };
  }

  // =============================================
  // CRIAR USUÁRIO EM AMBOS OS AMBIENTES VIA EDGE FUNCTION
  // =============================================
  console.log('[hybridSignUp] Chamando create-user-both-envs...');
  
  try {
    // ✅ Usar invokeCloudEdgeFunction porque a função está no Lovable Cloud
    const { data: result, error: fetchError } = await invokeCloudEdgeFunction('create-user-both-envs', {
      body: { 
        email: normalizedEmail, 
        password,
        metadata 
      }
    });

    console.log('[hybridSignUp] Result:', result, 'Error:', fetchError);

    if (fetchError || !result?.success) {
      return {
        success: false,
        error: result?.error || fetchError?.message || 'Erro ao criar conta. Tente novamente.'
      };
    }

    // ✅ CORREÇÃO: Limpar qualquer sessão no Cloud antes de fazer login na Produção
    // Isso evita que getHybridSession() encontre sessão "fantasma" no Cloud
    // e cause conflito com o ambiente de Produção onde os dados foram salvos
    try {
      await supabase.auth.signOut();
      console.log('[hybridSignUp] Cloud session cleared');
    } catch (e) {
      console.warn('[hybridSignUp] Could not clear cloud session:', e);
    }

    // Fazer login automaticamente na Produção após criar
    console.log('[hybridSignUp] Fazendo login automático na Produção...');
    const { data: loginData, error: loginError } = await supabaseProductionAuth.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (loginError) {
      console.error('[hybridSignUp] Erro no login automático:', loginError.message);
      // Usuário foi criado, mas login falhou - não é erro crítico
      return {
        success: true,
        prodUserId: result.prodUserId,
        cloudUserId: result.cloudUserId,
        error: 'Conta criada! Por favor, faça login manualmente.'
      };
    }

    // Salvar ambiente no sessionStorage
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('auth_environment', 'production');
    }

    console.log('[hybridSignUp] ✅ Cadastro completo! ProdID:', result.prodUserId, 'CloudID:', result.cloudUserId);
    
    return {
      success: true,
      user: loginData.user,
      session: loginData.session,
      prodUserId: result.prodUserId,
      cloudUserId: result.cloudUserId,
    };
    
  } catch (error: any) {
    console.error('[hybridSignUp] Exceção:', error);
    return {
      success: false,
      error: error.message || 'Erro ao criar conta. Tente novamente.'
    };
  }
};

/**
 * Retorna o cliente correto baseado no ambiente
 */
export const getAuthClient = (environment: 'cloud' | 'production') => {
  return environment === 'production' ? supabaseProductionAuth : supabase;
};

/**
 * Logout de ambos os ambientes
 */
export const hybridSignOut = async () => {
  try {
    await supabase.auth.signOut();
  } catch (e) {
    console.error('[hybridSignOut] Cloud signOut error:', e);
  }
  
  try {
    await supabaseProductionAuth.auth.signOut();
  } catch (e) {
    console.error('[hybridSignOut] Production signOut error:', e);
  }

  // Limpar ambiente do sessionStorage
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('auth_environment');
  }
};

/**
 * Verifica sessão em ambos os ambientes
 * ✅ CORREÇÃO: Respeita sessionStorage.auth_environment para evitar "sessão fantasma"
 */
export const getHybridSession = async (): Promise<{
  session: any | null;
  environment: 'cloud' | 'production' | null;
}> => {
  // Verificar se há preferência de ambiente salva
  const savedEnvironment = typeof window !== 'undefined' 
    ? sessionStorage.getItem('auth_environment') 
    : null;
  
  // Se temos preferência de ambiente, verificar esse primeiro
  if (savedEnvironment === 'production') {
    const { data: prodData } = await supabaseProductionAuth.auth.getSession();
    if (prodData.session) {
      return { session: prodData.session, environment: 'production' };
    }
    // Fallback para Cloud se não houver sessão na Produção
    const { data: cloudData } = await supabase.auth.getSession();
    if (cloudData.session) {
      return { session: cloudData.session, environment: 'cloud' };
    }
    return { session: null, environment: null };
  }
  
  if (savedEnvironment === 'cloud') {
    const { data: cloudData } = await supabase.auth.getSession();
    if (cloudData.session) {
      return { session: cloudData.session, environment: 'cloud' };
    }
    // Fallback para Produção se não houver sessão no Cloud
    const { data: prodData } = await supabaseProductionAuth.auth.getSession();
    if (prodData.session) {
      return { session: prodData.session, environment: 'production' };
    }
    return { session: null, environment: null };
  }

  // Sem preferência: verificar Cloud primeiro (comportamento padrão)
  const { data: cloudData } = await supabase.auth.getSession();
  if (cloudData.session) {
    return { session: cloudData.session, environment: 'cloud' };
  }

  // Verificar Produção
  const { data: prodData } = await supabaseProductionAuth.auth.getSession();
  if (prodData.session) {
    return { session: prodData.session, environment: 'production' };
  }

  return { session: null, environment: null };
};
