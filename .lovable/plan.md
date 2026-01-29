
# Plano de Correção: Loop Infinito no Cadastro da Monique

## Problema Identificado
O cadastro entra em loop entre `/completar-perfil` e `/auth/callback` porque:
1. O usuário foi autenticado na **Produção** (via `hybridSignUp`)
2. A sessão está salva em `supabaseProductionAuth` (chave `supabase-production-auth` no localStorage)
3. O `AuthCallback.tsx` verifica **ambos** os ambientes e encontra a sessão
4. Mas o `CompletarPerfil.tsx` usa `requireAuth()` que **só verifica o Cloud**
5. Sem sessão no Cloud, `requireAuth()` redireciona para `/entrar`
6. Login reconecta e o ciclo recomeça

## Arquivos que serão modificados

1. `src/lib/auth.ts` - atualizar `requireAuth()` para suportar autenticação híbrida

## Escopo exato da correção

### Arquivo: `src/lib/auth.ts`

**ANTES (atual):**
```typescript
export const requireAuth = async (): Promise<{ user: User; session: Session } | null> => {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.user) {
    window.location.href = '/entrar';
    return null;
  }
  
  return { user: session.user, session };
};
```

**DEPOIS (corrigido):**
```typescript
import { getHybridSession, supabaseProductionAuth } from "@/lib/auth-hybrid";

export const requireAuth = async (): Promise<{ user: User; session: Session } | null> => {
  // ✅ HÍBRIDO: Verificar sessão em ambos os ambientes (Cloud e Produção)
  const { session, environment } = await getHybridSession();
  
  if (!session?.user) {
    window.location.href = '/entrar';
    return null;
  }
  
  // Salvar ambiente para uso posterior
  if (environment) {
    sessionStorage.setItem('auth_environment', environment);
  }
  
  return { user: session.user, session };
};
```

Também atualizar `getPatient()` para usar o cliente correto:
```typescript
export const getPatient = async (userId: string): Promise<Patient | null> => {
  // Verificar qual ambiente está ativo
  const environment = sessionStorage.getItem('auth_environment') as 'cloud' | 'production' | null;
  const client = environment === 'production' ? supabaseProduction : supabase;
  
  const { data, error } = await client
    .from('patients' as any)
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
    
  if (error) {
    console.error('Error fetching patient:', error);
    return null;
  }
  
  return data as unknown as Patient;
};
```

## Por que isso resolve o problema

1. `requireAuth()` agora usa `getHybridSession()` que verifica **ambos** os ambientes
2. Se o usuário logou via Produção, a sessão será encontrada corretamente
3. O fluxo de salvamento do perfil funcionará porque temos uma sessão válida
4. O loop é quebrado porque o usuário não será mais redirecionado para `/entrar`

## Impacto

- **Baixo risco**: A função `getHybridSession()` já existe e é usada em `AuthCallback.tsx`
- **Compatibilidade**: Usuários do Cloud continuarão funcionando normalmente
- **Sem breaking changes**: A interface da função permanece a mesma

## Validação pós-implementação

1. Criar um novo usuário (cadastro normal)
2. Verificar que não há loop entre páginas
3. Confirmar que o perfil é salvo corretamente
4. Testar login de usuários existentes (Cloud e Produção)
