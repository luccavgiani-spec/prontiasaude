

## Versão Auto-Contida do patient-operations/index.ts

Vou gerar para você uma versão completa e auto-contida do arquivo `patient-operations/index.ts` que inclui:

1. **CORS headers inline** - substitui `import { getCorsHeaders } from '../common/cors.ts'`
2. **CPF validator inline** - substitui `import { validateCPF, cleanCPF } from '../common/cpf-validator.ts'`

### O que muda:
- Remove as 2 linhas de import externo (linhas 3-4)
- Adiciona funções `getCorsHeaders()` e `validateCPFChecksum()` diretamente no início do arquivo
- Todo o resto do código permanece **100% igual**

### Como usar:
1. Abra o Supabase Dashboard → Edge Functions → `patient-operations`
2. Apague **todo** o conteúdo atual
3. Cole o código abaixo (será muito longo ~2300 linhas)
4. Clique em **Deploy**

---

## Código Completo (copiar tudo abaixo)

```typescript
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1';

// ============================================================
// ✅ CORS HEADERS INLINE (substitui ../common/cors.ts)
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
// ✅ CPF VALIDATOR INLINE (substitui ../common/cpf-validator.ts)
// ============================================================
function cleanCPF(cpf: string): string {
  return cpf.replace(/\D/g, '');
}

function validateCPFChecksum(cpf: string): boolean {
  if (!cpf) return false;
  
  const cleanedCPF = cpf.replace(/\D/g, '');
  
  if (cleanedCPF.length !== 11) return false;
  
  const invalidPatterns = [
    '00000000000', '11111111111', '22222222222', '33333333333',
    '44444444444', '55555555555', '66666666666', '77777777777',
    '88888888888', '99999999999'
  ];
  
  if (invalidPatterns.includes(cleanedCPF)) return false;
  
  // Validar dígitos verificadores
  let sum = 0;
  let remainder;
  
  for (let i = 1; i <= 9; i++) {
    sum += parseInt(cleanedCPF.substring(i - 1, i)) * (11 - i);
  }
  
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanedCPF.substring(9, 10))) return false;
  
  sum = 0;
  for (let i = 1; i <= 10; i++) {
    sum += parseInt(cleanedCPF.substring(i - 1, i)) * (12 - i);
  }
  
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanedCPF.substring(10, 11))) return false;
  
  return true;
}

const corsHeaders = getCorsHeaders();

// ============================================================
// ✅ CONSTANTES E HELPERS PARA SYNC CLICKLIFE DE DEPENDENTES
// ============================================================

// Planos FAMILIARES que incluem especialistas → planoid 1238 na ClickLife
const PLANOS_FAMILIARES_COM_ESPECIALISTAS = [
  'FAM_COM_ESP_1M',
  'FAM_COM_ESP_3M',
  'FAM_COM_ESP_6M',
  'FAM_COM_ESP_12M',
];

// Planos FAMILIARES sem especialistas → planoid 1237 na ClickLife
const PLANOS_FAMILIARES_SEM_ESPECIALISTAS = [
  'FAM_SEM_ESP_1M',
  'FAM_SEM_ESP_3M',
  'FAM_SEM_ESP_6M',
  'FAM_SEM_ESP_12M',
  'FAMILY',
  'FAM_BASIC',
];

// ... [TODO: O restante do código continua EXATAMENTE igual a partir da linha 31 do arquivo original]
```

---

## ⚠️ IMPORTANTE

O arquivo completo tem **~2250 linhas**. Devido ao tamanho, vou gerar o arquivo completo pronto para deploy quando você aprovar este plano.

### Ao aprovar:
- Gerarei o arquivo `.ts` completo e auto-contido
- Você poderá copiar diretamente para o Dashboard do Supabase
- Não precisará mexer em `cors.ts` nem `cpf-validator.ts`

