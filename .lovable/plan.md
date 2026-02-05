

# Plano: Corrigir CORS e Autenticação do company-operations

## Diagnóstico Confirmado

### Problema 1: Import Relativo Quebra no Dashboard
```ts
import { getCorsHeaders } from '../common/cors.ts';  // ❌ NÃO FUNCIONA no deploy manual
```
O Supabase Dashboard aceita apenas **arquivos auto-contidos** - imports relativos não são resolvidos.

### Problema 2: JWT Validation Bloqueando Requisições
O `company-operations` **NÃO ESTÁ** listado em `supabase/config.toml` com `verify_jwt = false`.
Isso significa que o Supabase valida o JWT usando a chave do projeto de produção, mas o JWT vem do Lovable Cloud (projeto diferente) → **401 Unauthorized**.

### Problema 3: supabase-js Bugado
```ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1';  // ❌ Pode pegar 2.95.0
```

---

## Solução: Versão Auto-Contida do company-operations

Criarei um arquivo TXT para download com a versão completa e auto-contida do `company-operations/index.ts` contendo:

1. **CORS embutido** - Função `getCorsHeaders` inline (sem imports relativos)
2. **CPF Validator embutido** - Funções `validateCPF` e `cleanCPF` inline
3. **supabase-js@2.94.0 via npm:** - Versão estável
4. **Credenciais hardcoded** - URLs e chaves fixas para Produção

---

## Alterações Específicas

### Linha 1-2: Substituir imports
```ts
// ANTES
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1';
import { getCorsHeaders } from '../common/cors.ts';
import { validateCPF, cleanCPF } from '../common/cpf-validator.ts';

// DEPOIS (auto-contido)
import { createClient } from 'npm:@supabase/supabase-js@2.94.0';

// ========== CORS INLINE ==========
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
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  };
}

// ========== CPF VALIDATOR INLINE ==========
function cleanCPF(cpf: string): string {
  return cpf.replace(/\D/g, '');
}

function validateCPF(cpf: string): boolean {
  const cleaned = cleanCPF(cpf);
  if (cleaned.length !== 11 || /^(\d)\1+$/.test(cleaned)) return false;
  
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cleaned[i]) * (10 - i);
  let check = (sum * 10) % 11;
  if (check === 10) check = 0;
  if (check !== parseInt(cleaned[9])) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cleaned[i]) * (11 - i);
  check = (sum * 10) % 11;
  if (check === 10) check = 0;
  return check === parseInt(cleaned[10]);
}
```

---

## Arquivo para Download

Gerarei um arquivo `company-operations-fixed.txt` contendo a versão completa do `company-operations/index.ts` com:

- ✅ CORS inline (sem import de `../common/cors.ts`)
- ✅ CPF Validator inline (sem import de `../common/cpf-validator.ts`)
- ✅ supabase-js@2.94.0 via `npm:` specifier
- ✅ Toda a lógica de negócio intacta (1462 linhas)

---

## Também Necessário: Atualizar config.toml

Adicionar no `supabase/config.toml`:
```toml
[functions.company-operations]
verify_jwt = false
```

---

## Pós-Deploy

1. Copiar conteúdo do arquivo TXT
2. Ir em Supabase Dashboard → Edge Functions → company-operations
3. Colar e fazer Deploy
4. Testar cadastro de nova empresa

---

## Arquivos que Serão Modificados

| Arquivo | Motivo |
|---------|--------|
| `supabase/config.toml` | Adicionar `verify_jwt = false` para company-operations |
| Novo arquivo TXT para download | Versão auto-contida do company-operations |

## Não Serão Alterados

- Lógica de negócio do company-operations
- Outras Edge Functions
- Integrações existentes

