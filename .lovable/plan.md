

# Plano de Correção: Botões de Override Não Funcionam

## Diagnóstico Confirmado (100% de certeza)

A edge function `admin-settings-update` **NÃO ESTÁ DEPLOYADA** no projeto Supabase de **PRODUÇÃO**.

### Evidências:
1. O arquivo `supabase/config.toml` **não contém** a entrada `[functions.admin-settings-update]`
2. Chamada direta à Produção retorna `{"code":"NOT_FOUND","message":"Requested function was not found"}`
3. A função existe apenas no Lovable Cloud, não na Produção
4. Os componentes `ClickLifeOverrideCard` e `CommunicareOverrideCard` usam `invokeEdgeFunction()` que envia requests para a **Produção**

---

## Correção Necessária

### Arquivo a ser modificado:
**`supabase/config.toml`**

### Alteração:
Adicionar a configuração da edge function ao final do arquivo:

```toml
[functions.admin-settings-update]
verify_jwt = false
```

---

## O que NÃO precisa ser feito

- Não é necessário acessar o Supabase manualmente
- Não é necessário modificar o código da edge function
- Não é necessário modificar os componentes de override
- O deploy automático do Lovable cuidará de publicar a função na Produção após a alteração do config.toml

---

## Resultado Esperado

Após a correção:
1. A função `admin-settings-update` será deployada automaticamente na Produção
2. Os botões de override funcionarão normalmente
3. As configurações serão salvas na tabela `admin_settings` da Produção

---

## Resumo Técnico

| Item | Antes | Depois |
|------|-------|--------|
| `admin-settings-update` na Produção | ❌ NOT FOUND | ✅ Deployada |
| Botões de Override | ❌ Não funcionam | ✅ Funcionam |
| Alteração em config.toml | 67 linhas | 70 linhas (+3) |

