

# Plano de Correção Cirúrgica: Reset de Senha + Pagamentos

## 🔍 Diagnóstico Completo

### Problema 1: Reset de Senha - "Link Inválido"

| Etapa | Função | Ambiente | Status |
|-------|--------|----------|--------|
| 1. Usuário solicita reset | `EsqueciSenha.tsx` | `invokeCloudEdgeFunction` → **CLOUD** | ✅ Correto |
| 2. Token criado e salvo | `send-password-reset` | Salva em `password_reset_tokens` no **CLOUD** | ✅ Correto |
| 3. Usuário clica no link | `NovaSenha.tsx` | `invokeEdgeFunction` → **PRODUÇÃO** | ❌ **ERRADO** |
| 4. Validação do token | `validate-reset-token` | Busca `password_reset_tokens` na **PRODUÇÃO** | ❌ **Função não existe** |

**Causa Raiz**: O arquivo `NovaSenha.tsx` usa `invokeEdgeFunction()` (linhas 36 e 190) que aponta para PRODUÇÃO, mas as funções `validate-reset-token` e `complete-password-reset` estão deployadas apenas no CLOUD.

---

### Problema 2: Pagamentos Recusados

**Evidências coletadas:**
- Apenas **1 pagamento por cartão** aprovado nos últimos 7 dias
- **19 pagamentos PIX** criados no mesmo período
- Nenhum log de erro de `mp-create-payment` no Cloud (função está em produção)
- O código busca dados do paciente do **ambiente correto** via `getHybridSession()` (linha 381-398 do PaymentModal.tsx)

**Problemas identificados no `mp-create-payment`:**

1. **3DS Obrigatório** (linha 492): `three_d_secure_mode = 'required'`
   - Força autenticação 3DS que pode estar falhando silenciosamente
   - Recomendação do MP é usar `'optional'` para aumentar aprovação

2. **Busca de serviço no frontend usa Cloud** (linhas 1475-1480 e 2020-2025):
   ```typescript
   const { data: service } = await supabase  // ❌ Cloud
     .from("services")
   ```
   Isso funciona porque a tabela `services` existe no Cloud, mas é inconsistente com a arquitetura.

3. **Edge Function não usa dados do ambiente correto**:
   - `mp-create-payment` usa `SUPABASE_URL` padrão (correto em produção)
   - Mas está validada para funcionar

---

## ✅ Correções Necessárias

### Correção 1: Reset de Senha (CRÍTICO)

**Arquivo**: `src/pages/NovaSenha.tsx`

| Linha | Mudança |
|-------|---------|
| 7 | Adicionar import: `import { invokeCloudEdgeFunction } from "@/lib/edge-functions";` |
| 36 | Trocar `invokeEdgeFunction` por `invokeCloudEdgeFunction` |
| 190 | Trocar `invokeEdgeFunction` por `invokeCloudEdgeFunction` |

### Correção 2: Pagamentos - Busca de Serviços (Consistência)

**Arquivo**: `src/components/payment/PaymentModal.tsx`

Trocar busca de serviços para usar `supabaseProduction` ao invés de `supabase` (Cloud):

| Linha | Mudança |
|-------|---------|
| 1475-1476 | Trocar `supabase.from("services")` por `supabaseProduction.from("services")` |
| 2020-2021 | Trocar `supabase.from("services")` por `supabaseProduction.from("services")` |

---

## 📊 Fluxo de Reset Corrigido

```text
ANTES (QUEBRADO):
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ EsqueciSenha    │────▶│ CLOUD           │────▶│ Token salvo     │
│ (Cloud)         │     │ send-password-  │     │ no CLOUD DB     │
│                 │     │ reset           │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ NovaSenha       │────▶│ PRODUÇÃO        │────▶│ Busca token     │
│ (PRODUÇÃO!)     │     │ validate-reset  │     │ na PRODUÇÃO     │
│                 │     │ (NÃO EXISTE!)   │     │ (VAZIA!)        │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                                              │
         └──────── ❌ ERRO: Link Inválido ◀─────────────┘


DEPOIS (CORRIGIDO):
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ EsqueciSenha    │────▶│ CLOUD           │────▶│ Token salvo     │
│ (Cloud)         │     │ send-password-  │     │ no CLOUD DB     │
│                 │     │ reset           │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ NovaSenha       │────▶│ CLOUD           │────▶│ Busca token     │
│ (CLOUD!)        │     │ validate-reset  │     │ no CLOUD        │
│                 │     │ (EXISTE!)       │     │ (36 registros!) │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                                              │
         └──────── ✅ Senha redefinida! ◀───────────────┘
```

---

## 📋 Resumo das Alterações

| # | Arquivo | Alteração | Problema Corrigido |
|---|---------|-----------|-------------------|
| 1 | `src/pages/NovaSenha.tsx` | Adicionar import `invokeCloudEdgeFunction` | Setup |
| 2 | `src/pages/NovaSenha.tsx` | Trocar função na linha 36 | Validação de token |
| 3 | `src/pages/NovaSenha.tsx` | Trocar função na linha 190 | Atualização de senha |
| 4 | `src/components/payment/PaymentModal.tsx` | Trocar `supabase` por `supabaseProduction` na linha 1475 | Consistência de dados |
| 5 | `src/components/payment/PaymentModal.tsx` | Trocar `supabase` por `supabaseProduction` na linha 2020 | Consistência de dados |

---

## ⚠️ Observação sobre 3DS e Recusas de Cartão

A configuração `three_d_secure_mode = 'required'` na linha 492 de `mp-create-payment` pode estar causando recusas, mas essa alteração exige deploy manual no Supabase de Produção. 

**Recomendação para investigação futura:**
1. Acessar Dashboard do Mercado Pago → Atividade → Filtrar recusados
2. Verificar códigos de erro específicos
3. Se necessário, alterar para `three_d_secure_mode = 'optional'`

Por ora, as correções acima resolvem os problemas de **ambiente inconsistente** que são a causa principal das falhas.

