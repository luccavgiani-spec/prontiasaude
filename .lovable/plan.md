
# Plano: Correção do Sistema Híbrido de Autenticação

## Diagnóstico dos Problemas

### Problema 1: Login falhando para usuários do Cloud
- **Usuário afetado:** `t.giani@gmail.com`
- **Causa:** A edge function `check-user-exists` usa `listUsers({ filter: 'email.eq.${email}' })`, mas esse filtro não funciona corretamente na API Admin do Supabase
- **Evidência:** O usuário existe no Cloud (ID: `19d8998f-d8bc-4a6a-8323-6cc7bb3d026a`), mas a função retorna `existsInCloud: false`

### Problema 2: Painel Admin incompleto
- **Causa:** `UserRegistrationsTab.tsx` agora busca APENAS da Produção (`supabaseProduction`), ignorando os 448 usuários do Lovable Cloud
- **Resultado:** Usuários cadastrados no Cloud não aparecem no painel

---

## Solução Proposta

### Parte 1: Corrigir `check-user-exists` (Login)

Alterar a lógica para buscar usuários corretamente, sem depender do filtro problemático:

**Arquivo:** `supabase/functions/check-user-exists/index.ts`

**Mudanças:**
1. Usar paginação para buscar todos os usuários (até encontrar o email)
2. Filtrar manualmente por email após buscar
3. Adicionar logs detalhados para debug

```typescript
// ANTES (não funciona)
const { data: cloudUsers } = await cloudClient.auth.admin.listUsers({
  filter: `email.eq.${normalizedEmail}`
});

// DEPOIS (funciona)
let page = 1;
let found = false;
while (!found) {
  const { data, error } = await cloudClient.auth.admin.listUsers({
    page,
    perPage: 1000
  });
  if (error || !data?.users?.length) break;
  
  const match = data.users.find(u => u.email?.toLowerCase() === normalizedEmail);
  if (match) found = true;
  
  if (data.users.length < 1000) break;
  page++;
}
existsInCloud = found;
```

### Parte 2: Unificar Painel Admin (Cloud + Produção)

Modificar `UserRegistrationsTab.tsx` para mostrar usuários de AMBOS os ambientes.

**Arquivo:** `src/components/admin/UserRegistrationsTab.tsx`

**Estratégia:**
1. Buscar pacientes da Produção (`supabaseProduction`)
2. Buscar pacientes do Cloud (`supabase`)
3. Mesclar resultados, removendo duplicatas por email
4. Marcar a origem de cada registro (Cloud/Produção)

**Mudanças técnicas:**
- Criar função `mergePatients(cloudPatients, prodPatients)` que:
  - Combina as duas listas
  - Remove duplicatas (prioriza Produção se existir em ambos)
  - Adiciona campo `source: 'cloud' | 'production' | 'both'`
- Atualizar as contagens para somar ambos os ambientes
- Adicionar badge visual indicando a origem

### Parte 3: Deploy e Teste

1. Fazer deploy da edge function corrigida
2. Testar login com `t.giani@gmail.com`
3. Verificar se painel mostra todos os registros

---

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/check-user-exists/index.ts` | Buscar usuários com paginação, filtrar manualmente por email |
| `src/components/admin/UserRegistrationsTab.tsx` | Buscar e mesclar pacientes do Cloud + Produção |

---

## Detalhes Técnicos

### Edge Function `check-user-exists`

A nova implementação irá:

1. **Para Cloud:** Iterar páginas de 1000 usuários até encontrar o email ou esgotar
2. **Para Produção:** Mesma lógica
3. **Otimização:** Parar assim que encontrar (não precisa carregar tudo)
4. **Fallback:** Em caso de erro, logar detalhadamente e retornar valores seguros

### Painel Admin Unificado

Interface mostrará:

| Campo | Descrição |
|-------|-----------|
| Email | Email do paciente |
| Nome | Nome completo |
| Origem | Badge: "Cloud", "Produção" ou "Ambos" |
| Status | Com conta / Sem conta |
| Plano | Ativo/Inativo |

Contagens atualizadas:
- Total = Cloud + Produção (sem duplicatas)
- Com conta = user_id não nulo em qualquer ambiente
- Com plano = planos ativos da Produção

---

## Resultado Esperado

1. **Login funcionando:** Usuários do Cloud (como `t.giani@gmail.com`) conseguirão fazer login normalmente
2. **Painel completo:** Admin verá todos os 448+ usuários cadastrados em ambos os ambientes
3. **Sem perda de dados:** Nenhum cadastro será perdido ou precisará ser refeito
