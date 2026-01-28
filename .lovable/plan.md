

# Plano: Eliminar Totalmente o Lovable Cloud do Fluxo de Produção

## Objetivo

Garantir que **100% das chamadas** do frontend vão para o Supabase de produção (`ploqujuhpwutpcibedbr`), eliminando qualquer interação com o Lovable Cloud (`yrsjluhhnhxogdgnbnya`).

## Diagnóstico Atual

### Arquivos que Apontam para Lovable Cloud (Problema)

| Arquivo | Problema | Impacto |
|---------|----------|---------|
| `.env` | `VITE_SUPABASE_URL = yrsjluhhnhxogdgnbnya` | Base de todas as chamadas |
| `src/integrations/supabase/client.ts` | Gerado automaticamente, usa `.env` | 46 arquivos importam este cliente |
| 32 arquivos | Usam `supabase.functions.invoke()` | Chamam Edge Functions no Cloud (inexistentes) |

### Arquivos que Apontam para Produção (Correto)

| Arquivo | Solução Implementada | Arquivos que Usam |
|---------|---------------------|-------------------|
| `src/lib/edge-functions.ts` | `invokeEdgeFunction()` hardcoded para produção | 9 arquivos |
| `src/lib/supabase-production.ts` | `supabaseProduction` hardcoded para produção | ~5 arquivos |

## Estratégia de Correção

### Fase 1: Criar Cliente de Produção Unificado

Criar um arquivo que substitua o `client.ts` auto-gerado:

**Novo arquivo: `src/lib/supabase-client-override.ts`**

Este arquivo vai:
- Exportar um cliente Supabase que aponta SEMPRE para produção
- Manter compatibilidade com a API do cliente original
- Ser o único ponto de entrada para operações de banco

### Fase 2: Migrar Todas as Chamadas de Edge Functions

Substituir **TODOS** os 261 usos de `supabase.functions.invoke()` por `invokeEdgeFunction()`:

Arquivos afetados:
- `src/pages/NovaSenha.tsx` (2 usos)
- `src/pages/TrabalheConosco.tsx` (1 uso)
- `src/pages/SejaNossParceiro.tsx` (1 uso)
- `src/pages/DisqueDenuncia.tsx` (1 uso)
- `src/pages/EsqueciSenha.tsx` (1 uso)
- `src/pages/ClickLifeSSO.tsx` (1 uso)
- `src/pages/ClubeBen.tsx` (múltiplos)
- `src/pages/ClubeBenAuth.tsx` (múltiplos)
- `src/pages/empresa/Funcionarios.tsx` (2 usos)
- `src/components/admin/ManualPlanActivationModal.tsx` (1 uso)
- `src/components/admin/ClickLifeOverrideCard.tsx` (1 uso)
- `src/components/admin/SpecialtiesSelector.tsx` (1 uso)
- `src/components/payment/PaymentModal.tsx` (4 usos restantes)
- `src/components/teste/TestesRoteamento.tsx` (5 usos)
- E mais ~20 arquivos

### Fase 3: Migrar Operações de Banco de Dados

Para operações de banco (SELECT, INSERT, UPDATE, DELETE), há duas opções:

**Opção A - Cliente Hardcoded (Mais Simples)**:
- Substituir `import { supabase }` por `import { supabaseProduction }`
- Problema: Autenticação não funciona (JWT assinado diferente)

**Opção B - Edge Functions para Tudo (Mais Robusto)**:
- Criar Edge Functions para operações críticas
- Frontend chama Edge Functions via `invokeEdgeFunction`
- Edge Functions usam `service_role` para operar no banco

**Recomendação**: Híbrido
- Autenticação: Manter no Lovable Cloud (é necessário para login)
- Leitura de dados públicos: Usar `supabaseProduction`
- Escrita de dados: Usar Edge Functions com `service_role`
- Leitura de dados do usuário logado: Usar Edge Functions que validam o JWT

### Fase 4: Documentação e Regras

Criar arquivo de conhecimento (`custom-knowledge`) para o AI sempre seguir:
- Nunca usar `supabase.functions.invoke()`
- Sempre usar `invokeEdgeFunction()`
- Nunca editar `.env` ou `client.ts`
- Edge Functions devem ser deployadas manualmente em produção

## Arquivos que Serão Modificados

### Modificações em Código (32+ arquivos)

Todos os arquivos que usam `supabase.functions.invoke()` serão atualizados para usar `invokeEdgeFunction()`.

### Novo Arquivo

| Arquivo | Propósito |
|---------|-----------|
| `src/lib/supabase-client-override.ts` | Cliente unificado para produção |

## Limitações e Avisos Importantes

1. **Autenticação**: O login/logout PRECISA usar o cliente do Lovable Cloud porque o JWT é assinado lá. Não podemos mudar isso.

2. **Deploy Manual**: Toda alteração em Edge Functions que eu fizer aqui precisa ser copiada e deployada manualmente no painel do Supabase de produção.

3. **Dois Bancos Separados**: O banco do Lovable Cloud e o banco de produção são DIFERENTES. Usuários cadastrados em um não existem no outro.

4. **RLS Policies**: As políticas de segurança do banco de produção precisam permitir leitura pública para dados que o frontend precisa acessar sem autenticação.

## Fluxo Após Correção

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ARQUITETURA CORRIGIDA                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Frontend (React)                                                           │
│  │                                                                          │
│  ├── Autenticação (login/logout)                                            │
│  │   └── supabase (Lovable Cloud) ← Necessário para JWT                     │
│  │                                                                          │
│  ├── Edge Functions (pagamentos, agendamentos, etc)                         │
│  │   └── invokeEdgeFunction() → ploqujuhpwutpcibedbr (PRODUÇÃO) ✅          │
│  │                                                                          │
│  ├── Leitura de dados públicos (serviços, planos)                           │
│  │   └── supabaseProduction → ploqujuhpwutpcibedbr (PRODUÇÃO) ✅            │
│  │                                                                          │
│  └── Escrita/Leitura de dados do usuário                                    │
│      └── Edge Functions com validação → ploqujuhpwutpcibedbr (PRODUÇÃO) ✅  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Seção Técnica: Detalhes de Implementação

### A. Novo Cliente Override

```typescript
// src/lib/supabase-client-override.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

const PRODUCTION_URL = "https://ploqujuhpwutpcibedbr.supabase.co";
const PRODUCTION_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";

export const supabaseProd = createClient<Database>(
  PRODUCTION_URL, 
  PRODUCTION_ANON_KEY
);
```

### B. Padrão de Migração de Edge Functions

De:
```typescript
const { data, error } = await supabase.functions.invoke('function-name', {
  body: { ... }
});
```

Para:
```typescript
import { invokeEdgeFunction } from '@/lib/edge-functions';

const { data, error } = await invokeEdgeFunction('function-name', {
  body: { ... }
});
```

### C. Ordem de Execução

1. Criar `supabase-client-override.ts`
2. Migrar arquivos de pagamento (críticos)
3. Migrar arquivos admin
4. Migrar arquivos de teste
5. Migrar arquivos de páginas públicas
6. Migrar arquivos restantes
7. Atualizar custom-knowledge com regras

## Resultado Esperado

Após implementação:
- 0 chamadas para Edge Functions do Lovable Cloud
- 100% das operações de negócio vão para produção
- Autenticação continua funcionando (único uso do Lovable Cloud)
- Deploy de Edge Functions continua sendo manual (você copia e cola no painel)

## Risco e Mitigação

| Risco | Mitigação |
|-------|-----------|
| Quebrar autenticação | Manter `supabase` do client.ts apenas para auth |
| Erro em algum arquivo | Implementar em fases, testando cada bloco |
| Novo código voltar ao padrão errado | Regras no custom-knowledge + revisão |

