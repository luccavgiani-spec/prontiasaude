
Contexto do problema (por que ainda dá “401 token inválido” em Produção)
- A função `patient-operations` faz uma validação “genérica” de token logo no início (antes do `switch`), usando o client do banco/ambiente onde a função roda:
  - Ela lê `Authorization` e faz `supabase.auth.getUser(token)` usando o backend “de produção” (service_role).
  - Para o fluxo de ativação manual, porém, o token que chega é do login do Admin (emitido pelo backend do app/Admin), então essa validação inicial falha e retorna `401 Token inválido` antes de chegar no case `activate_plan_manual`.
- Mesmo dentro do case `activate_plan_manual`, hoje está sendo chamado `authClient.auth.getUser()` sem passar o token explicitamente; isso pode falhar porque esse client não tem sessão armazenada. O correto é validar passando o token (`getUser(token)`) ou via claims.

Objetivo
- Fazer a ativação manual funcionar em Produção removendo o “401 token inválido”, sem abrir brecha de segurança, mantendo validação server-side do admin (role em `user_roles`).

1) ARQUIVOS QUE SERÃO MODIFICADOS
- `supabase/functions/patient-operations/index.ts`

2) MOTIVO (baseado no seu pedido)
- Corrigir o “401 token inválido” em produção na ativação manual, garantindo que o token seja validado no backend correto (onde ele foi emitido), e não bloqueado pela validação genérica do backend de execução.

3) ESCOPO (exatamente o que vai mudar)
A. Ajuste na validação genérica inicial (antes do switch)
- Alterar a regra “toda operação exceto upsert_patient exige validar token no backend de execução” para:
  - Continuar validando normalmente para as demais operações
  - Excluir explicitamente `activate_plan_manual` dessa validação inicial
  - Motivo: `activate_plan_manual` tem validação própria (cross-project) e não pode ser barrada antes

B. Ajuste na validação cross-project dentro do `activate_plan_manual`
- Trocar `authClient.auth.getUser()` por `authClient.auth.getUser(token)` (token explícito)
  - Isso garante que a verificação realmente usa o JWT recebido no header
- Manter a checagem de admin via `user_roles` no backend do login
- Manter execução da ativação no banco de produção com `service_role`

C. Melhorias de retorno de erro (para diagnosticar rápido)
- Garantir que o retorno 401 do fluxo manual venha com:
  - `success: false`
  - `step: 'admin_auth'`
  - `details` com a mensagem de erro real do provedor de auth
- Se identificarmos que o token recebido é “anon/público” (fallback), retornar mensagem mais clara (ex.: “Sessão do Admin não encontrada — faça login novamente”).

4) CONFIRMAÇÃO (regra de alteração)
- Estas alterações estão explicitamente solicitadas? SIM — ao aprovar este plano, você está autorizando a modificação do arquivo listado (`supabase/functions/patient-operations/index.ts`) exclusivamente para corrigir o 401 token inválido na ativação manual.

Sequência de implementação (passo-a-passo)
1. Ler `body.operation` antes da validação genérica e criar uma lista de exceções:
   - Exceções mínimas: `upsert_patient` (já existe) e `activate_plan_manual` (novo)
2. Ajustar o bloco inicial:
   - Se `operation` NÃO estiver nas exceções:
     - manter a validação atual (`authHeader` obrigatório + `supabase.auth.getUser(token)` no backend de execução)
   - Se `operation` estiver nas exceções:
     - pular a validação genérica (deixar o case cuidar)
3. No case `activate_plan_manual`:
   - Garantir extração do token (`Bearer ...`)
   - Validar com `authClient.auth.getUser(token)` (token explícito)
   - Checar admin em `user_roles` no backend do login
   - Prosseguir com upsert de `patient_plans` no banco de produção
4. Teste ponta a ponta em Produção
   - Login no Admin
   - Ativar plano manualmente
   - Confirmar que não há mais 401 e que retorna `success: true`
5. Se ainda houver falha, o toast deverá mostrar `step` e `details` para identificar com precisão o ponto do erro.

Critérios de aceite
- Em Produção, logado no Admin:
  - Ativação manual não retorna mais “401 token inválido”
  - Plano é ativado com sucesso (registro em `patient_plans` atualizado/criado)
  - Usuário final consegue enxergar o plano na área do paciente (quando aplicável)
- Segurança mantida:
  - Sem admin role no backend do login → 403
  - Sem token válido → 401

Observação sobre Preview (não incluído neste escopo agora)
- O problema de Preview que você relatou anteriormente é CORS (domínio `*.lovableproject.com`) + `getCorsHeaders()` sem origin. Como você pediu para focar primeiro no 401 em Produção, esse ajuste de CORS ficará para um próximo passo, se você confirmar.