// auth-hybrid.ts — Produção única (Lovable Cloud removido)
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { invokeEdgeFunction } from './edge-functions';

// Alias de compatibilidade — outros arquivos que importam supabaseProductionAuth
// continuam funcionando sem alteração
export const supabaseProductionAuth = supabase;

export const getAuthClient = () => supabase;

export type UserCheckResult = {
  existsInCloud: boolean;
  existsInProduction: boolean;
  loginEnvironment: 'cloud' | 'production' | 'none';
  canRegister: boolean;
};

export const checkUserExists = async (email: string): Promise<UserCheckResult> => {
  try {
    const { data } = await invokeEdgeFunction('check-user-exists', {
      body: { email: email.toLowerCase().trim() }
    });
    return data as UserCheckResult;
  } catch {
    return {
      existsInCloud: false,
      existsInProduction: false,
      loginEnvironment: 'none',
      canRegister: true
    };
  }
};

export const hybridSignIn = async (
  email: string,
  password: string
): Promise<{
  success: boolean;
  error?: string;
  environment?: 'cloud' | 'production';
  session?: any;
}> => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.toLowerCase().trim(),
    password,
  });

  if (error) {
    return {
      success: false,
      error: error.message === 'Invalid login credentials'
        ? 'Email ou senha incorretos.'
        : error.message,
    };
  }

  return {
    success: true,
    environment: 'production',
    session: data.session,
  };
};

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

  const { data: createData, error: createError } = await invokeEdgeFunction(
    'create-user-both-envs',
    { body: { email: normalizedEmail, password, metadata } }
  );

  if (createError || !createData?.success) {
    return {
      success: false,
      error: createData?.error || createError?.message || 'Erro ao criar conta. Tente novamente.',
    };
  }

  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (loginError) {
    return {
      success: true,
      prodUserId: createData.prodUserId,
      cloudUserId: createData.cloudUserId,
      error: 'Conta criada! Por favor, faça login manualmente.',
    };
  }

  return {
    success: true,
    user: loginData.user,
    session: loginData.session,
    prodUserId: createData.prodUserId,
    cloudUserId: createData.cloudUserId,
  };
};

export const getHybridSession = async (): Promise<{
  session: any | null;
  environment: 'cloud' | 'production' | null;
}> => {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    session,
    environment: session ? 'production' : null,
  };
};

export const hybridSignOut = async () => {
  await supabase.auth.signOut();
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('auth_environment');
  }
};
