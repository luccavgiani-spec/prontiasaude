

# Correcao Cirurgica: Diagnosticar e Corrigir Erro de Producao

## Problema Confirmado

Todos os cadastros recentes (14:25, 14:29, 14:31, 14:33) mostram:
```
Cloud=true, Prod=false
Erro: "Database error creating new user"
```

O `ALTER TABLE patients ALTER COLUMN id SET DEFAULT gen_random_uuid()` ja estava aplicado. O erro vem de **outro lugar** no trigger ou schema de Producao.

## Causa do Diagnostico Incompleto

O Supabase JS Client (`prodClient.auth.admin.createUser()`) retorna apenas a mensagem generica `"Database error creating new user"`. O GoTrue REST API retorna detalhes adicionais (`hint`, `details`, `code`) que estao sendo descartados.

## Correcao: Trocar para REST API Direta na Producao

**Arquivo:** `supabase/functions/create-user-both-envs/index.ts`

Substituir o bloco de criacao na Producao (linhas ~198-215) para usar fetch direto na GoTrue REST API ao inves do Supabase client. Isso captura o erro COMPLETO:

```typescript
// ANTES (esconde detalhes do erro):
const { data: prodData, error: prodError } = await prodClient.auth.admin.createUser({...});

// DEPOIS (mostra erro completo do GoTrue):
const response = await fetch(`${PRODUCTION_URL}/auth/v1/admin/users`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${prodServiceKey}`,
    'apikey': prodServiceKey,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: normalizedEmail,
    password,
    email_confirm: true,
    user_metadata: metadata,
  }),
});

const responseBody = await response.text();
console.log(`[create-user-both-envs] Producao GoTrue response: ${response.status} ${responseBody}`);

if (!response.ok) {
  // AGORA veremos o erro REAL (hint, details, code do Postgres)
  console.error("[create-user-both-envs] Erro COMPLETO Producao:", responseBody);
} else {
  const userData = JSON.parse(responseBody);
  prodUserId = userData.id;
}
```

## O Que Isso Resolve

1. Na proxima tentativa de cadastro, os logs mostrarao o erro **exato** do Postgres (ex: coluna inexistente, constraint violada, permissao negada)
2. Com o erro real em maos, a correcao definitiva sera imediata

## Escopo das Alteracoes

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/create-user-both-envs/index.ts` | Substituir `prodClient.auth.admin.createUser()` por fetch direto na GoTrue REST API para capturar erro completo |

Nenhum outro arquivo sera alterado.

## Proximo Passo

Apos deploy, voce testa um cadastro e os logs mostrarao o erro real. A partir dai, aplica-se o SQL correto na Producao.

