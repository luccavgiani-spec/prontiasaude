# Plano de Correção: Lista de Pacientes + Cadastro de Novos Usuários

## Diagnóstico Confirmado

### Problema 1: Lista mostrando apenas 220 usuários

**Causa Raiz**: A Edge Function `list-all-users` **NÃO ESTÁ DEPLOYADA** no Supabase de Produção.

Quando acessei diretamente:

```
https://ploqujuhpwutpcibedbr.supabase.co/functions/v1/list-all-users
```

Resposta: `{"code":"NOT_FOUND","message":"Requested function was not found"}`

O frontend (`edge-functions.ts`) está configurado para chamar `https://ploqujuhpwutpcibedbr.supabase.co/functions/v1/list-all-users`, mas a função não existe lá. Por isso o código cai no fallback que busca apenas os 220 patients da tabela de Produção.

### Problema 2: Novo usuário não consegue se cadastrar

Os logs de `check-user-exists` mostram que o email `sidneiasoaresferreira61@gmail.com`:

- Não existe no Cloud (450 usuários verificados)
- Não existe na Produção (220 usuários verificados)
- `canRegister: true` - ou seja, pode se cadastrar

O problema provavelmente está no passo seguinte (o `signUp` no Supabase de Produção). Precisamos verificar os logs de autenticação ou o erro retornado no frontend.

---

## Solução

### Parte 1: Deploy da Edge Function `list-all-users` no Supabase de Produção

Você precisa fazer o deploy MANUAL da função no Supabase de Produção:

1. Acesse: https://supabase.com/dashboard/project/ploqujuhpwutpcibedbr
2. Vá em **Edge Functions** no menu lateral
3. Clique em **New Function**
4. Nome: `list-all-users`
5. Cole o código do arquivo `supabase/functions/list-all-users/index.ts`
6. Clique em **Deploy**

Alternativamente, via Supabase CLI:

```bash
supabase functions deploy list-all-users --project-ref ploqujuhpwutpcibedbr
```

### Parte 2: Verificar Secrets no Supabase de Produção

Confirme que estas secrets estão configuradas em **Edge Functions > Secrets**:

| Secret Name                          | Valor                                              |
| ------------------------------------ | -------------------------------------------------- |
| `CLOUD_SUPABASE_URL`                 | `https://yrsjluhhnhxogdgnbnya.supabase.co`         |
| `CLOUD_SUPABASE_SERVICE_ROLE_KEY`    | (a service role key do Lovable Cloud)              |
| `ORIGINAL_SUPABASE_SERVICE_ROLE_KEY` | (já deve existir - a service role key da Produção) |

### Parte 3: Depurar o Cadastro do Novo Usuário

Para entender por que o cadastro está falhando, preciso que você:

1. Peça ao usuário que tente se cadastrar novamente
2. Abra o DevTools do navegador (F12) > Console
3. Me envie o erro que aparecer (ou um screenshot)

O fluxo de cadastro é:

1. `checkUserExists()` - OK (retorna `canRegister: true`)
2. `hybridSignUp()` - chama `supabaseProductionAuth.auth.signUp()`
3. Sincroniza com tabela `patients`

Se o passo 2 falha, pode ser:

- Problema com a configuração de email do Supabase de Produção
- Validação de senha muito restritiva
- Algum erro de rede ou CORS

---

## Resultado Esperado

1. **Painel Admin**: Mostrará 569 usuários (após deploy da função)
2. **Cadastro**: Funcionará normalmente (após identificar o erro)

---

## Próximos Passos

1. Faça o deploy da função `list-all-users` no Supabase de Produção
2. Verifique se as secrets estão configuradas
3. Teste o painel admin - deve mostrar 569 usuários
4. Para o cadastro, me envie o erro do console do navegador

---

## Seção Técnica: Código da Edge Function

O arquivo `supabase/functions/list-all-users/index.ts` que você deve copiar para o Supabase de Produção já está atualizado para:

1. Usar `CLOUD_SUPABASE_URL` e `CLOUD_SUPABASE_SERVICE_ROLE_KEY` para acessar o ambiente Cloud
2. Usar `ORIGINAL_SUPABASE_SERVICE_ROLE_KEY` ou `SUPABASE_SERVICE_ROLE_KEY` para a Produção
3. Mesclar os usuários de ambos os ambientes (evitando duplicados)
4. Retornar estatísticas: `cloudOnly`, `productionOnly`, `both`, `totalUnique`

A função foi testada no ambiente Cloud e retornou corretamente 569 usuários únicos.
