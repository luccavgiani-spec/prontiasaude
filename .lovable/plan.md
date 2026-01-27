
# Plano de Correção: Adicionar `verify_jwt = false` para `mp-create-payment`

## Problema Identificado

O arquivo `supabase/config.toml` **NÃO contém** a configuração `verify_jwt = false` para a função `mp-create-payment`.

### Por que isso causa o erro:
1. O frontend está no projeto **Lovable Cloud** (`yrsjluhhnhxogdgnbnya`)
2. Quando a Valentina faz login, ela recebe um JWT assinado pelo Lovable Cloud
3. O `invokeEdgeFunction` envia esse JWT para o projeto de **produção** (`ploqujuhpwutpcibedbr`)
4. O Supabase de produção **rejeita o JWT** porque foi assinado com uma chave diferente
5. A requisição é bloqueada com HTTP 401 **antes** do código executar
6. Por isso **não há logs** - o código nunca chega a rodar

---

## Correção Necessária

### Arquivo: `supabase/config.toml`

Adicionar a configuração para desabilitar verificação de JWT na função de pagamento:

```toml
[functions.mp-create-payment]
verify_jwt = false
```

---

## Código Atualizado

```toml
project_id = "ploqujuhpwutpcibedbr"

[functions.create-admin-user]
verify_jwt = false

[functions.import-users]
verify_jwt = false

[functions.reset-admin-password]
verify_jwt = false

[functions.patient-data-report]
verify_jwt = false

[functions.activate-communicare-manual]
verify_jwt = false

[functions.send-password-reset]
verify_jwt = false

[functions.validate-reset-token]
verify_jwt = false

[functions.complete-password-reset]
verify_jwt = false

[functions.reconcile-pending-payments]
verify_jwt = false

[functions.mp-create-payment]
verify_jwt = false
```

---

## Segurança

Mesmo com `verify_jwt = false`, a edge function `mp-create-payment`:
- Ainda recebe e pode validar o JWT manualmente se necessário
- Valida os dados do pagador (email, CPF, etc.)
- Usa o `MP_ACCESS_TOKEN` server-side (nunca exposto)
- Registra toda a transação no banco de dados para auditoria

---

## Impacto Esperado

| Antes | Depois |
|-------|--------|
| HTTP 401 Unauthorized (silencioso) | Requisição aceita e processada |
| Sem logs na edge function | Logs visíveis para debug |
| PIX não gera código | PIX funciona normalmente |
| Cartão falha silenciosamente | Cartão processa no Mercado Pago |

---

## Verificação Pós-Correção

1. Publicar o site novamente
2. Testar geração de PIX com a paciente Valentina
3. Verificar se os logs aparecem em `mp-create-payment` no projeto de produção
