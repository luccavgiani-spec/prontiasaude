
## Objetivo
Fazer a **ativação manual de planos** voltar a funcionar de forma definitiva, removendo o “Unauthorized/Forbidden” mesmo estando logado no Admin, sem abrir brecha de segurança.

---

## O que eu analisei e por que está falhando hoje
### 1) O Admin login está autenticando em um backend diferente do backend onde a função `patient-operations` roda
- O `/admin/login` usa `supabase.auth.signInWithPassword()` do client padrão (`src/pages/AdminLogin.tsx`) e valida admin via tabela `user_roles` nesse mesmo backend.
- Porém, o `invokeEdgeFunction()` está chamando **as funções no backend de produção** (hardcoded em `src/lib/edge-functions.ts`), enviando no header `Authorization` o **access_token do login do Admin** (que é do backend “do app”).
- Resultado: a `patient-operations` hoje tenta validar admin dentro do **banco de produção**, mas o “admin role” que você tem (e o user_id do token) pertencem ao outro backend. Isso leva a `403 Forbidden` (ou `401` dependendo do caso).

Isso casa com o seu sintoma: você está logado no Admin, mas recebe Unauthorized/Forbidden.

### 2) Mesmo que passasse da validação, a estratégia atual de “admin via patients/user_roles do banco de produção” é frágil
Ela depende de existir um registro correspondente no banco de produção para o admin (patients + roles), o que não é garantido.

---

## Correção definitiva (arquitetura)
Ajustar a `patient-operations` para:

1) **Validar o token do Admin no backend onde ele foi emitido** (o mesmo do `/admin/login`), usando verificação real do JWT (não apenas decodificar payload).
2) **Confirmar o role admin consultando `user_roles` nesse mesmo backend** (via RLS do próprio usuário).
3) Somente após isso, executar a ativação do plano no **banco de produção**, usando o client com service_role (que já existe na função).

Em outras palavras:  
- **Autorização (admin)**: verificada no backend do login  
- **Execução (ativar plano)**: feita no backend de produção

Isso elimina de vez o problema “cross-backend JWT/roles”.

---

## Escopo e arquivos (regra de alteração)
### ARQUIVOS QUE SERÃO MODIFICADOS
1. `supabase/functions/patient-operations/index.ts`

(opcional, somente se ainda estiver acontecendo 401 por verificação automática do JWT)
2. `supabase/config.toml` (somente para garantir `verify_jwt = false` para `patient-operations`, se o ambiente de produção realmente estiver respeitando esse arquivo)

### MOTIVO
- Corrigir a autorização do `activate_plan_manual` para não depender de roles/ids do banco de produção, e sim do backend onde o admin realmente está logado.

### ESCOPO (exatamente o que vai mudar)
- Trocar a lógica do case `activate_plan_manual`:
  - Em vez de: “decodificar token e buscar role no banco de produção”
  - Passa a ser: “validar token e checar role admin no backend do login; se OK, então ativa plano no banco de produção”

### CONFIRMAÇÃO
Estas alterações estão explicitamente solicitadas? **SIM** (você pediu para “sanar em definitivo” e reportou que manual ainda falha; o único caminho seguro é corrigir a autenticação cross-backend na própria `patient-operations`).

---

## Passos de implementação (detalhados)
### Passo 1 — Separar claramente dois clients dentro da `patient-operations`
Dentro da função:
- `prodAdminClient`: aponta para o banco de produção (service_role) — já existe hoje.
- `authClient`: aponta para o backend do login do Admin (anon key + Authorization Bearer do usuário).

Observação importante de segurança:
- **Não** vamos mais “só decodificar JWT sem verificar assinatura”.
- Vamos usar `authClient.auth.getClaims(token)` (ou `getUser`) para validar assinatura no backend correto.

### Passo 2 — Validar admin no backend do login (onde o token é válido)
Fluxo pro `activate_plan_manual`:
1. Ler `Authorization` header.
2. Extrair o token.
3. `authClient.auth.getClaims(token)`:
   - Se falhar: retornar 401.
4. Pegar `claims.sub` (user_id) e `claims.email`.
5. Consultar `authClient.from('user_roles')`
   - filtro: `user_id = claims.sub` e `role = 'admin'`
   - se não tiver: retornar 403.

Isso garante que “logado no Admin” realmente significa admin, sem depender do banco de produção.

### Passo 3 — Executar ativação no banco de produção (sem depender do admin existir lá)
Com admin validado:
1. Buscar paciente no banco de produção por `patient_email`
2. Atualizar/criar plano no `patient_plans` com:
   - `patient_id` (da tabela patients)
   - `user_id` (se existir na tabela patients)
   - `status = 'active'`
   - `plan_expires_at` coerente
3. Registrar métrica/auditoria como hoje.

### Passo 4 — Melhorar retorno de erro para “ver exatamente onde falhou”
Sem depender de logs externos:
- Padronizar respostas JSON com:
  - `success: false`
  - `step: "admin_auth" | "patient_lookup" | "plan_upsert" | ...`
  - `error: string`
Assim o toast do Admin mostra um erro útil (e você consegue me colar a mensagem).

### Passo 5 — Teste ponta-a-ponta guiado (sem “achismo”)
1. Logar no `/admin/login`
2. Ir no modal de ativação manual e ativar um plano
3. Verificar:
   - Se retorna `success: true`
   - Se o paciente enxerga o plano na área do paciente
   - Se o `schedule-redirect` considera o plano ativo (consulta por `plan_expires_at`)

---

## Checklist de validação (para fechar “em definitivo”)
- [ ] Admin consegue ativar manualmente sem 401/403
- [ ] Plano aparece para o paciente (RLS ok, `user_id` preenchido quando existir)
- [ ] Nenhuma chamada sensível fica liberada para usuários não-admin
- [ ] Em caso de falha, a UI mostra o `step` e o motivo (debug rápido)

---

## Riscos e como mitigamos
- **Risco:** depender do backend do login para validar token  
  **Mitigação:** isso é apenas para autorização; a ativação continua 100% no banco de produção com service_role.
- **Risco:** vazar segredo em frontend  
  **Mitigação:** nenhuma chave privada vai para o frontend; somente chave pública/anon é usada no backend para validação.

