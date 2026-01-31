
# Plano de Correção Imediata: Edge Functions com CORS Inline

## Diagnóstico do Problema

A causa raiz dos problemas com PIX e consultas manuais é a mesma:

**As Edge Functions `schedule-redirect` e outras estão usando `import { getCorsHeaders } from '../common/cors.ts'`**, mas quando coladas diretamente no Dashboard do Supabase, esse import falha silenciosamente porque o Dashboard não suporta imports de arquivos locais.

### Funções Afetadas (deployadas em PRODUÇÃO)

| Função | Status Atual | Ação Necessária |
|--------|--------------|-----------------|
| `mp-create-payment` | ✅ CORS inline (atualizada) | Copiar/colar no Supabase Prod |
| `mp-create-subscription` | ✅ CORS inline (atualizada) | Copiar/colar no Supabase Prod |
| `schedule-redirect` | ❌ Usa import externo | **PRECISA ser tornada auto-contida** |

---

## Correções Necessárias

### 1. Tornar `schedule-redirect` Auto-Contida

Substituir o import externo por CORS inline no arquivo `supabase/functions/schedule-redirect/index.ts`:

**Remover linha 3:**
```typescript
import { getCorsHeaders } from '../common/cors.ts';
```

**Adicionar após linha 2 (após o import do supabase-js):**
```typescript
// ============================================================
// ✅ CORS INLINE - Headers para permitir chamadas do frontend
// ============================================================
const ALLOWED_ORIGINS = [
  'https://prontiasaude.com.br',
  'https://www.prontiasaude.com.br',
  'https://prontiasaude.lovable.app',
  'http://localhost:5173',
];

function isLovablePreviewOrigin(origin: string): boolean {
  return /^https:\/\/id-preview--[a-f0-9-]+\.lovable\.app$/.test(origin);
}

function getCorsHeaders(requestOrigin?: string | null): Record<string, string> {
  const origin = requestOrigin || '';
  const isAllowed = ALLOWED_ORIGINS.includes(origin) || isLovablePreviewOrigin(origin);
  const allowedOrigin = isAllowed ? origin : '';
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin || ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  };
}
// ============================================================
```

### 2. Atualizar Chamada getCorsHeaders no Handler Principal

A função `schedule-redirect` também precisa passar o `requestOrigin` para `getCorsHeaders()`. Encontrar onde `corsHeaders` é usado e garantir que está usando:

```typescript
const requestOrigin = req.headers.get('origin');
const corsHeaders = getCorsHeaders(requestOrigin);
```

---

## Sequência de Deploy

1. **Atualizo o arquivo `schedule-redirect` aqui no Cloud** com CORS inline
2. **Você copia/cola no Supabase de Produção** as 3 funções:
   - `mp-create-payment` (já atualizada)
   - `mp-create-subscription` (já atualizada)
   - `schedule-redirect` (será atualizada)
3. **Testamos gerando uma consulta** para a paciente CPF 001.822.997-24

---

## Sobre a pasta `common/cors.ts` no Supabase

**Resposta à sua pergunta:**

Se você fez deploy das Edge Functions **via Dashboard (copiar/colar)**, a pasta `common/` **não tem efeito** e pode ser ignorada ou deletada do ambiente de produção.

Se você fez deploy **via Supabase CLI** (`supabase functions deploy`), a pasta `common/` é usada corretamente e os imports funcionam.

**Recomendação**: Mantenha todas as funções críticas como **auto-contidas** (CORS inline) para garantir que funcionem tanto via CLI quanto via Dashboard.

---

## Arquivos a Modificar

| # | Arquivo | Alteração |
|---|---------|-----------|
| 1 | `supabase/functions/schedule-redirect/index.ts` | Remover import de `../common/cors.ts` e adicionar CORS inline |

---

## Teste Pós-Correção

Após o deploy das funções atualizadas:

1. Testar geração de PIX no PaymentModal
2. Testar geração de consulta manual pelo Admin Dashboard
3. Gerar consulta para paciente CPF 001.822.997-24 (Sonia Mara Lyrio Volpe)
