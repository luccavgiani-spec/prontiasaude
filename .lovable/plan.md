

# Correcao: Usuaria Redirecionada para /completar-perfil Apesar de Perfil Completo

## Problema Identificado

A usuaria `thaiz-santos-15@outlook.com` possui:
- Conta em `auth.users` no Cloud (user_id: `9a7d9b64-0fc7-4ea5-abd9-248befeed294`)
- Conta em `auth.users` na Producao (user_id diferente)
- `loginEnvironment: "cloud"` (o sistema direciona login para o Cloud)
- **NENHUM registro na tabela `patients` do Cloud** (registro existe apenas na Producao, com user_id da Producao)

Quando ela clica em "Consulta Agora", o codigo faz:
1. `getHybridSession()` retorna ambiente `cloud`
2. Busca `patients` no Cloud por `user_id` do Cloud
3. Nao encontra nada (patient = null)
4. `!patient?.profile_complete` = true
5. Redireciona para `/completar-perfil`

Este e um problema **sistemico**: qualquer usuario que existe em ambos os ambientes mas tem registro `patients` apenas na Producao (com user_id diferente) nunca consegue comprar.

## Solucao

Criar uma funcao utilitaria centralizada `checkProfileComplete()` que busca o paciente com fallback: primeiro por `user_id` no ambiente atual, depois por `user_id` no outro ambiente, e por fim por `email` na Producao. Substituir todas as 9+ ocorrencias espalhadas pelo codigo por essa funcao.

## Alteracoes

### Arquivo 1: `src/lib/patients.ts`

Adicionar funcao:

```typescript
export async function checkProfileComplete(
  userId: string, 
  email: string, 
  environment: 'cloud' | 'production' | null
): Promise<{ profileComplete: boolean; patient: any | null; resolvedClient: any }> {
  const primaryClient = environment === 'production' ? supabaseProduction : supabase;
  const secondaryClient = environment === 'production' ? supabase : supabaseProduction;
  
  // 1. Tentar por user_id no ambiente atual
  const { data: p1 } = await primaryClient
    .from('patients')
    .select('profile_complete, cpf, first_name, last_name, phone_e164, gender')
    .eq('user_id', userId)
    .maybeSingle();
  if (p1) return { profileComplete: !!p1.profile_complete, patient: p1, resolvedClient: primaryClient };
  
  // 2. Tentar por user_id no outro ambiente
  const { data: p2 } = await secondaryClient
    .from('patients')
    .select('profile_complete, cpf, first_name, last_name, phone_e164, gender')
    .eq('user_id', userId)
    .maybeSingle();
  if (p2) return { profileComplete: !!p2.profile_complete, patient: p2, resolvedClient: secondaryClient };
  
  // 3. Fallback por email na Producao
  if (email) {
    const { data: p3 } = await supabaseProduction
      .from('patients')
      .select('profile_complete, cpf, first_name, last_name, phone_e164, gender')
      .eq('email', email.toLowerCase())
      .maybeSingle();
    if (p3) return { profileComplete: !!p3.profile_complete, patient: p3, resolvedClient: supabaseProduction };
  }
  
  return { profileComplete: false, patient: null, resolvedClient: primaryClient };
}
```

### Arquivos 2-9: Substituir queries diretas pela funcao centralizada

Todos os seguintes arquivos terao suas queries `from('patients').select('profile_complete').eq('user_id', ...)` substituidas por `checkProfileComplete(user.id, user.email, environment)`:

| Arquivo | Ocorrencias |
|---------|-------------|
| `src/components/home/HeroSection.tsx` | 1 |
| `src/components/home/ServicoCard.tsx` | 3 |
| `src/components/layout/ConsultNowFloatButton.tsx` | 1 |
| `src/pages/ServicoDetalhe.tsx` | 2 |
| `src/pages/servicos/Consulta.tsx` | 1 |
| `src/pages/servicos/LaudosPsicologicos.tsx` | 1 |
| `src/pages/servicos/MedicosEspecialistas.tsx` | 1 |
| `src/pages/servicos/SolicitacaoExames.tsx` | 1 |
| `src/pages/servicos/Psicologa.tsx` | 1 |

Exemplo de substituicao (HeroSection.tsx):

```typescript
// ANTES:
const { data: patient } = await client
  .from('patients').select('profile_complete')
  .eq('user_id', user.id).maybeSingle();
if (!patient?.profile_complete) { navigate('/completar-perfil'); return; }

// DEPOIS:
const { profileComplete } = await checkProfileComplete(user.id, user.email!, environment);
if (!profileComplete) { navigate('/completar-perfil'); return; }
```

Para componentes que tambem buscam dados do paciente (cpf, nome, telefone, gender) logo apos a verificacao de perfil, a funcao `checkProfileComplete` ja retorna esses campos, eliminando a segunda query.

## Escopo

| Arquivo | Alteracao |
|---------|-----------|
| `src/lib/patients.ts` | Adicionar `checkProfileComplete()` |
| `src/components/home/HeroSection.tsx` | Usar `checkProfileComplete()` |
| `src/components/home/ServicoCard.tsx` | Usar `checkProfileComplete()` |
| `src/components/layout/ConsultNowFloatButton.tsx` | Usar `checkProfileComplete()` |
| `src/pages/ServicoDetalhe.tsx` | Usar `checkProfileComplete()` |
| `src/pages/servicos/Consulta.tsx` | Usar `checkProfileComplete()` |
| `src/pages/servicos/LaudosPsicologicos.tsx` | Usar `checkProfileComplete()` |
| `src/pages/servicos/MedicosEspecialistas.tsx` | Usar `checkProfileComplete()` |
| `src/pages/servicos/SolicitacaoExames.tsx` | Usar `checkProfileComplete()` |
| `src/pages/servicos/Psicologa.tsx` | Usar `checkProfileComplete()` |

Nenhum arquivo fora desta lista sera alterado.

## Resultado Esperado

- Usuaria `thaiz-santos-15@outlook.com` (e qualquer outro usuario na mesma situacao) conseguira iniciar o checkout normalmente
- O sistema encontra o registro `patients` mesmo quando o `user_id` difere entre Cloud e Producao
- A busca por email como fallback garante que nenhum usuario com perfil completo seja redirecionado incorretamente

