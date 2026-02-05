
## ARQUIVOS QUE SERÃO MODIFICADOS
1) `supabase/functions/check-user-exists/index.ts`  
2) `src/lib/auth-hybrid.ts`  
3) `src/lib/patients.ts`  
4) `src/components/admin/EditPatientModal.tsx`

## MOTIVO (baseado no seu pedido)
- Login “quebrado / usuário não existe” (ex.: `t.gaini@gmail.com`) passou a depender da Edge Function `check-user-exists`. Ela está falhando em runtime e, por causa disso, o frontend interpreta como “não existe em nenhum lugar”.
- Edição de perfil e edição pelo painel admin ainda retornam erro de token (o anexo mostra `{"error":"Token inválido"}`), típico de token do ambiente errado sendo validado no backend errado.

## DIAGNÓSTICO (o que está errado de fato)
### 1) Login quebrado (“usuário não existe”)
- Logs da função `check-user-exists` mostram:
  - `TypeError: client.auth.admin.getUserByEmail is not a function`
- Ou seja: a função está importando uma versão/entry do SDK que não expõe `getUserByEmail`. Isso faz a função falhar e o `checkUserExists()` do frontend cair no fallback que devolve `loginEnvironment: 'none'`, levando ao erro “Email não encontrado”.

### 2) Token inválido ao editar pelo painel admin (e ainda ocorre em produção)
- O request do admin vai para a função do backend de produção, mas o token do admin é do ambiente Cloud (onde o admin fez login).
- Se a função em produção não está com o bypass/validação cross-project como no seu repositório atual, ela tenta validar esse token Cloud no auth de produção e responde `Token inválido`.

### 3) Token inválido ao salvar o próprio perfil
- No fluxo de salvar perfil (`upsertPatientBasic`), há chamadas para `patient-operations` que exigem JWT válido.
- Hoje o helper `invokeEdgeFunction()` pega token do cliente Cloud por padrão; quando o usuário está logado em “produção”, isso pode enviar o token errado (ou anon) para operações que exigem JWT, resultando em `Token inválido`.

---

## ESCOPO (exatamente o que será alterado)
### A) Reverter/estabilizar o login urgentemente (sem depender do `getUserByEmail` quebrado)
**Arquivo:** `supabase/functions/check-user-exists/index.ts`
1. Fixar a importação do SDK para uma versão que sabemos que suporta `auth.admin.getUserByEmail` (mesma usada em `create-user-both-envs`, que está funcionando).
2. Adicionar fallback automático:
   - Se `getUserByEmail` não existir por qualquer motivo, usar o método anterior (listagem/paginação via `listUsers`) para não derrubar o login.
3. Garantir que a função retorne 200 com um payload consistente (existsInCloud/existsInProduction/loginEnvironment/canRegister) mesmo em fallback, evitando “fail closed”.

**Arquivo:** `src/lib/auth-hybrid.ts`
4. Adicionar um fallback de login para quando `checkUserExists` falhar/retornar inconsistente:
   - Se `check-user-exists` der erro (ou `loginEnvironment: none`), tentar login direto:
     1) tenta Cloud `signInWithPassword`
     2) se falhar com credencial inválida, tenta Produção `signInWithPassword`
   - Só exibir “usuário não existe” se ambas as tentativas confirmarem que não há conta (ou se as duas retornarem explicitamente credencial inválida).
   
Resultado: mesmo que a função de verificação volte a falhar no futuro, o login não trava o sistema inteiro.

---

### B) Corrigir salvar perfil do próprio usuário (token do ambiente correto)
**Arquivo:** `src/lib/patients.ts`
1. Ao detectar `environment === 'production'`, garantir que chamadas para operações que exigem auth (ex.: `complete_profile`) enviem `Authorization: Bearer <access_token da produção>`.
   - Ou seja: pegar `session.access_token` retornado por `getHybridSession()` e repassar como `headers.Authorization` em `invokeEdgeFunction(...)`.
2. Manter `ensure_patient` como bypass (sem exigir JWT), mas sem forçar “sempre produção” de forma cega para não quebrar preview:
   - `ensurePatientRow` volta a ficar “environment-aware”:
     - produção -> chama backend de produção
     - cloud -> chama backend cloud
   - Isso evita repetir o erro de foreign key no cloud com `user_id` de produção, e também evita CORS no preview.

---

### C) Corrigir edição pelo painel admin (token inválido) sem depender do auth de produção aceitar token cloud
**Arquivo:** `src/components/admin/EditPatientModal.tsx`
1. Trocar a chamada de `invokeEdgeFunction('patient-operations', ...)` para `invokeCloudEdgeFunction('patient-operations', ...)` para o admin update.
   - Motivo: o admin autentica no Cloud; então a validação do token e checagem de role admin tem que acontecer no Cloud.
   - A função cloud então executa o UPDATE no banco de produção via service_role (sem depender de validar JWT cloud no auth de produção).

Observação: isso não muda checkout/pagamentos/redirecionamentos; é apenas o caminho de escrita do painel admin.

---

## CONFIRMAÇÃO (regra absoluta do projeto)
Estas alterações estão explicitamente solicitadas? **NÃO** (você não citou paths), mas **são necessárias** para executar exatamente o que você pediu: “reverter o que travou login” + “corrigir token inválido na edição”.

Ao aprovar este plano, você autoriza mudanças **somente** nos 4 arquivos listados acima.

---

## PASSO A PASSO DE VALIDAÇÃO (E2E)
1) Login:
- Testar login com `t.gaini@gmail.com` e mais 1 usuário conhecido
- Confirmar que não aparece “usuário não existe” indevidamente
- Confirmar no Network que `check-user-exists` responde 200 e não dá TypeError

2) Salvar perfil (usuário comum) no modo produção:
- Entrar como usuário
- Editar dados e salvar
- Confirmar que as requisições que exigem auth estão indo com `Authorization` do ambiente correto e não retornam `Token inválido`

3) Editar paciente no Admin:
- Entrar como `suporte@prontiasaude.com.br`
- Abrir modal e salvar
- Confirmar que o request de update do admin vai para o backend Cloud (validação admin) e o UPDATE efetivamente reflete na produção

4) Logs:
- Verificar logs das funções `check-user-exists` e `patient-operations` (no ambiente Cloud) para confirmar que não há mais exceções e que o token é validado corretamente.
