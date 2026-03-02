

# Plano: Remover Cadastro Universal dos 3 Arquivos

## Diagnóstico

Após análise detalhada, eis o que cada arquivo contém:

| Arquivo | Tipo de cadastro ClickLife/Communicare | Ação |
|---------|---------------------------------------|------|
| `mp-webhook` (linhas 1701-1798) | **CADASTRO UNIVERSAL** — dispara para TODAS as compras com `planoid: 864` fixo | **REMOVER** |
| `check-payment-status` (linhas 425-457) | Cadastro ao criar plano — usa `getClickLifePlanIdFromSku()` mas usa endpoint `/pacientes` diferente do padrão | **REMOVER** (redundante com mp-webhook/schedule-redirect) |
| `reconcile-pending-payments` (linhas 261-384 e 650-712) | Cadastro ao reconciliar plano pendente — usa planoId correto por SKU | **MANTER** (é o fallback legítimo quando webhook falha) |

## Alterações

### 1. `supabase/functions/mp-webhook/index.ts`
- **Remover linhas 1701-1798**: Bloco inteiro "CADASTRO UNIVERSAL NA CLICKLIFE" + "CADASTRO SIMULTÂNEO NA COMMUNICARE"
- Manter os cadastros específicos que já existem nos fluxos de plano (linha 1083) e serviço avulso (linha 1375)

### 2. `supabase/functions/check-payment-status/index.ts`
- **Remover linhas 425-457**: Bloco "CADASTRAR NA CLICKLIFE AO CRIAR PLANO" — é redundante porque o `mp-webhook` e o `schedule-redirect` já fazem o cadastro correto. Além disso, usa o endpoint `/pacientes` (diferente do padrão `/usuarios/usuarios` + `/usuarios/ativacao`)

### 3. `supabase/functions/reconcile-pending-payments/index.ts`
- **NÃO remover** — os dois blocos ClickLife (linhas 261-384 e 650-712) são o fallback legítimo para quando o webhook não processou. Usam planoId correto baseado no SKU

## Resumo

- **2 arquivos modificados**: `mp-webhook` e `check-payment-status`
- **1 arquivo mantido intacto**: `reconcile-pending-payments`
- Após implementar aqui no Cloud, você precisará **deployar manualmente** as duas funções no Supabase de Produção

