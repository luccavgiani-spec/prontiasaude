

# Plano: Remover Cadastro ClickLife Redundante do `check-payment-status`

## Status atual

O `mp-webhook` **já está correto** — o cadastro universal já foi removido (linhas 1701-1702 contêm apenas o comentário de remoção).

O `check-payment-status` **ainda contém** o bloco redundante de cadastro na ClickLife que causa duplicações.

## Alterações no `check-payment-status/index.ts`

### Remoção 1: Funções helper não utilizadas (linhas 14-111)
- `getClickLifePlanIdFromSku()` — só era usada pelo bloco de cadastro abaixo
- `registerClickLifePatient()` — usa endpoint `/pacientes` (diferente do padrão `/usuarios/usuarios` + `/usuarios/ativacao`)

Substituir por comentário indicando a remoção.

### Remoção 2: Bloco de cadastro ClickLife (linhas 338-370)
O trecho "CADASTRAR NA CLICKLIFE AO CRIAR PLANO" dentro do fluxo de plano aprovado:
```typescript
// ✅ CADASTRAR NA CLICKLIFE AO CRIAR PLANO (redundância com mp-webhook)
const { data: patientData } = await supabaseAdmin
  .from("patients")
  .select("cpf, first_name, last_name, phone_e164, gender, birth_date")
  ...
```

Remover este bloco inteiro, mantendo o código antes (verificação do plano) e depois (atualizar pending_payment).

## Resumo

- **1 arquivo modificado**: `check-payment-status/index.ts`
- **0 arquivos adicionais**: `mp-webhook` já está correto
- Após implementar, você precisará **deployar manualmente** a função `check-payment-status` no Supabase de Produção

