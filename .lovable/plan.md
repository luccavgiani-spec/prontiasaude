
# Plano: Correção da Lista de Usuários + Reset de Senha Híbrido

## Diagnóstico Confirmado

### Problema 1: Lista incompleta no Admin Panel
- **Causa Raiz:** O painel busca `patients` do Cloud, mas você quer ver os 449 **auth.users** do Cloud.
- **Evidência:** Os registros em `patients` do Cloud são menos que os 449 usuarios em `auth.users`.
- **Solução:** Criar Edge Function que busca `auth.users` de ambos os ambientes e mescla com dados de `patients`.

### Problema 2: Reset de senha não funciona para usuários do Cloud
- **Causa Raiz:** A Edge Function `send-password-reset` busca APENAS em `auth.users` da Produção.
- **Evidência:** Log mostra "Email não encontrado: t.giani@gmail.com" - usuário existe no Cloud, não na Produção.
- **Solução:** Modificar a função para buscar em ambos os ambientes (Cloud e Produção).

---

## Arquivos a Serem Modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/components/admin/UserRegistrationsTab.tsx` | Chamar nova Edge Function que retorna users de ambos os ambientes |
| `supabase/functions/send-password-reset/index.ts` | Buscar usuário em Cloud E Produção usando paginação |
| `supabase/functions/validate-reset-token/index.ts` | Suportar tokens de ambos os ambientes |
| `supabase/functions/complete-password-reset/index.ts` | Atualizar senha no ambiente correto (Cloud ou Produção) |

---

## Solução Detalhada

### Parte 1: Admin Panel - Lista Unificada de Usuários

Criar nova Edge Function `list-all-users` que:
1. Busca `auth.users` do Cloud (usando SUPABASE_SERVICE_ROLE_KEY)
2. Busca `auth.users` + `patients` da Produção (usando ORIGINAL_SUPABASE_SERVICE_ROLE_KEY)
3. Mescla os resultados removendo duplicatas por email
4. Retorna lista unificada com origem (cloud/production/both)

**Fluxo:**
```
Frontend (Admin) 
    → Edge Function "list-all-users" 
    → Busca auth.users Cloud (449) + auth.users Produção (219)
    → Mescla + enriquece com dados de patients
    → Retorna lista unificada
```

O componente `UserRegistrationsTab.tsx` chamará essa Edge Function em vez de buscar diretamente do Supabase client.

### Parte 2: Reset de Senha Híbrido

Modificar `send-password-reset`:

```text
1. Receber email
2. Buscar em auth.users do CLOUD (com paginação)
3. Se encontrar → gerar token, salvar em password_reset_tokens, enviar email com link
4. Se não encontrar → Buscar em auth.users da PRODUÇÃO (com paginação)
5. Se encontrar → mesma lógica acima
6. Se não encontrar em nenhum → retornar mensagem genérica (segurança)
7. SALVAR no token qual ambiente usar: cloud ou production
```

Modificar `complete-password-reset`:

```text
1. Validar token
2. Ler campo "environment" do token (cloud ou production)
3. Usar o cliente correto para atualizar a senha:
   - Se "cloud" → usar SUPABASE_SERVICE_ROLE_KEY
   - Se "production" → usar ORIGINAL_SUPABASE_SERVICE_ROLE_KEY
```

### Parte 3: Tabela de Tokens

Adicionar coluna `environment` à tabela `password_reset_tokens` para saber onde atualizar a senha:

```sql
ALTER TABLE public.password_reset_tokens 
ADD COLUMN IF NOT EXISTS environment TEXT DEFAULT 'production';
```

---

## Implementação Detalhada

### Edge Function: send-password-reset (atualizada)

Mudanças principais:
- Buscar com paginação em AMBOS os ambientes
- Salvar qual ambiente o usuário foi encontrado
- Enviar email normalmente

### Edge Function: complete-password-reset (atualizada)

Mudanças principais:
- Ler o campo `environment` do token
- Usar o cliente correto baseado no ambiente
- Atualizar senha no lugar certo

### UserRegistrationsTab.tsx

Mudanças principais:
- Chamar nova Edge Function `list-all-users` 
- Remover queries diretas ao Supabase para contagem
- Exibir a contagem real de auth.users (449 Cloud + 219 Produção - duplicados)

---

## Resultado Esperado

1. **Painel Admin mostrará:**
   - Todos os 449 usuários do Cloud
   - Todos os 219 usuários da Produção
   - Duplicados marcados como "Ambos"
   - Total real sem duplicatas

2. **Reset de senha funcionará para:**
   - Usuários do Cloud (como t.giani@gmail.com)
   - Usuários da Produção
   - Senha será atualizada no ambiente correto

3. **Contagens corretas:**
   - Total Cloud: 449
   - Total Produção: 219  
   - Duplicados: X (a calcular)
   - Total Único: 449 + 219 - X
