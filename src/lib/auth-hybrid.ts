/**
 * 🔐 Sistema de Autenticação Híbrida
 * 
 * Estratégia:
 * - Login: Verificar onde o email existe (Cloud ou Produção) e usar o cliente correto
 * - Cadastro: Novos usuários vão SOMENTE para Produção
 * - Bloquear cadastro se email já existir em qualquer ambiente
 */

import { supabase } from "@/integrations/supabase/client";
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

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
 */
export const checkUserExists = async (email: string): Promise<UserCheckResult> => {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-user-exists`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ email: email.toLowerCase().trim() }),
      }
    );

    if (!response.ok) {
      console.error('[checkUserExists] HTTP error:', response.status);
      // Em caso de erro, permitir fluxo normal (tentar Cloud primeiro)
      return {
        existsInCloud: false,
        existsInProduction: false,
        loginEnvironment: 'none',
        canRegister: true
      };
    }

    const result = await response.json();
    console.log('[checkUserExists] Result:', result);
    return result;
  } catch (error) {
    console.error('[checkUserExists] Error:', error);
    // Em caso de erro, permitir fluxo normal
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

  // Se não existe em nenhum lugar
  if (userCheck.loginEnvironment === 'none') {
    return { 
      success: false, 
      error: 'Email não encontrado. Verifique o email ou crie uma conta.' 
    };
  }

  // Tentar login no ambiente correto
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

    return { 
      success: true, 
      environment: 'production',
      session: data.session
    };
  }

  return { success: false, error: 'Erro ao identificar ambiente de login.' };
};

/**
 * Cadastro híbrido - novos usuários vão para Produção
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

  // Criar usuário no Supabase de Produção
  console.log('[hybridSignUp] Creating user in Production...');
  const { data, error } = await supabaseProductionAuth.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
      data: metadata
    }
  });

  if (error) {
    console.error('[hybridSignUp] Error:', error);
    return {
      success: false,
      error: error.message.includes('already registered')
        ? 'Este email já está cadastrado. Faça login ou recupere sua senha.'
        : error.message
    };
  }

  console.log('[hybridSignUp] User created successfully:', data.user?.id);
  return {
    success: true,
    user: data.user,
    session: data.session
  };
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
};

/**
 * Verifica sessão em ambos os ambientes
 */
export const getHybridSession = async (): Promise<{
  session: any | null;
  environment: 'cloud' | 'production' | null;
}> => {
  // Verificar Cloud primeiro
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
