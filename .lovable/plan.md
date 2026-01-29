
## Objetivo
Eliminar definitivamente:
1) o loop que manda para **/completar-perfil** mesmo quando o usuário “acha” que está deslogado, e  
2) o erro ao salvar o perfil com **{"error":"Token inválido"}** / erro de insert em `patients`,  
para que **novos usuários consigam se cadastrar e finalizar o perfil**.

---

## Diagnóstico (causa raiz provável, com base no código atual)

### A) “Token inválido” vem do `patient-operations` por causa do token enviado errado
- O frontend chama funções via `invokeEdgeFunction()` em **src/lib/edge-functions.ts**.
- Hoje, `invokeEdgeFunction()` **sempre** pega token de sessão de `supabase.auth.getSession()` (cliente “Cloud”) e, se não houver sessão, manda `Bearer <ANON_KEY>`:
  - Isso funciona para chamadas “públicas”/admin-read, mas **não** para operações que exigem autenticação do usuário no projeto de produção.
- No fluxo híbrido, **o usuário pode estar logado na Produção (supabaseProductionAuth)**, mas **não estar logado no Cloud (supabase)**.
- Resultado: a Edge Function `patient-operations` (no projeto de Produção) recebe um Authorization que não é um JWT válido do usuário e responde **"Token inválido"**.

### B) O loop /completar-perfil acontece porque a /area-do-paciente está lendo dados no “ambiente errado”
- `src/pages/AreaDoPaciente.tsx` hoje:
  - usa `supabase.auth.getSession()` (Cloud)
  - e consulta `supabase.from('patients')` (Cloud)
- Se existir sessão “fantasma”/persistida no Cloud, mas o paciente só existe/está completo na Produção, a página conclui “perfil incompleto” e manda para `/completar-perfil` mesmo que o usuário “ache” estar deslogado.
- Além disso, se o cadastro estiver sendo salvo na Produção, a área do paciente continuar lendo Cloud vai sempre parecer “incompleto”.

### C) Erro do print: `null value in column "id" of relation "patients"...`
- Isso normalmente ocorre quando algum insert está indo para um banco onde a coluna `patients.id` **não está sendo preenchida via default** (ou alguém está inserindo `id: null`).
- Para blindar isso, o `ensure_patient` no `patient-operations` pode gerar explicitamente um UUID (`crypto.randomUUID()`) ao inserir (fica robusto mesmo se o default do banco estiver diferente).

---

## Arquivos que serão modificados (escopo cirúrgico, conforme você autorizou)
1. `supabase/functions/patient-operations/index.ts`
2. `src/lib/edge-functions.ts`
3. `src/lib/patients.ts`
4. `src/pages/AreaDoPaciente.tsx`
5. `src/pages/CompletarPerfil.tsx` (apenas ajustes nos calls de Edge Function quando necessário)

**Motivo:** alinhar tokens corretos + leitura/escrita no ambiente correto + garantir criação de `patients` antes do update.

---

## Correção 1 (principal): Fazer `invokeEdgeFunction` respeitar Authorization customizado
### Mudança em `src/lib/edge-functions.ts`
- Hoje o código sempre sobrescreve `headers["Authorization"]`.
- Ajuste: **se `options.headers.Authorization` já vier definido**, não sobrescrever.
- Assim, chamadas que dependem do token da Produção poderão enviar:
  - `Authorization: Bearer <access_token_do_supabaseProductionAuth>`

**Resultado:** `patient-operations` deixa de responder “Token inválido” quando o usuário está logado na Produção.

---

## Correção 2: `ensurePatientRow` deve enviar o token do `dbClient` (cloud ou produção)
### Mudança em `src/lib/patients.ts`
- Dentro de `ensurePatientRow(userId, dbClient)`:
  1) obter `session` via `dbClient.auth.getSession()`
  2) se houver `access_token`, chamar `invokeEdgeFunction('patient-operations', { headers: { Authorization: Bearer ... } })`
- Isso garante que o `ensure_patient` roda autenticado no ambiente certo.

**Resultado:** `ensure_patient` passa a criar o registro do paciente antes do upsert (sem falhar por token).

---

## Correção 3: Tornar `ensure_patient` mais robusto no backend (e blindar `id`)
### Mudança em `supabase/functions/patient-operations/index.ts`
No case `ensure_patient`:
1) Manter o “select por user_id”.
2) Se não existir:
   - inserir com:
     - `id: crypto.randomUUID()`
     - `user_id`
     - `email`
3) Melhorar logs e retorno para debug (incluindo `operation`, `user_id` e se inseriu ou já existia).

**Resultado:**
- Mesmo que o banco “de Produção” tenha alguma divergência de default, não vai falhar com “id null”.
- E o fluxo fica estável: paciente sempre existe antes de salvar o perfil.

---

## Correção 4: Parar o loop na /area-do-paciente (usar sessão híbrida e cliente correto)
### Mudança em `src/pages/AreaDoPaciente.tsx`
- Trocar o fluxo inicial para:
  1) `getHybridSession()` para detectar sessão em cloud OU produção.
  2) Se não houver sessão em nenhum: redirect para `/entrar` (não `/completar-perfil`).
  3) Escolher `dbClient` de acordo com o ambiente detectado:
     - produção: `supabaseProductionAuth`
     - cloud: `supabase`
  4) Buscar `patients` com esse `dbClient`.
  5) Se não existir ou `profile_complete` falso: redirect `/completar-perfil`.
  6) (Opcional de robustez) se não achou no ambiente atual, tentar o outro ambiente antes de concluir “incompleto” (evita usuários “migrados” travarem).

**Resultado:** clicar em Área do Paciente não entra em loop “fantasma”; deslogado vai para `/entrar`; logado e completo vai para a área corretamente.

---

## Correção 5 (ajuste de chamadas): Edge functions em CompletarPerfil devem usar token do ambiente correto quando necessário
### Mudança em `src/pages/CompletarPerfil.tsx`
- Nos pontos que chamam `invokeEdgeFunction('company-operations' | 'patient-operations')`:
  - obter `environment` via `getHybridSession()`
  - se `production`, passar `Authorization` do `supabaseProductionAuth` para evitar “Token inválido”.

**Resultado:** convites e ativações também não quebram em ambiente híbrido.

---

## Passos de validação (checklist)
1) Em janela anônima:
   - acessar `/area-do-paciente` → deve ir para `/entrar`.
2) Criar novo usuário (fluxo normal):
   - cadastrar → ir para `/completar-perfil`
   - preencher e salvar → deve salvar sem erro e ir para `/area-do-paciente`.
3) Recarregar a página na área do paciente:
   - deve permanecer em `/area-do-paciente`.
4) Logout:
   - voltar a `/entrar` e não manter sessão “fantasma”.
5) Se houver convite (empresa/família):
   - repetir o salvar e validar que não ocorre “Token inválido”.

---

## Observação operacional (o que “copiar e colar no Supabase”)
- Após eu implementar, **você só precisa atualizar/deployar** a função backend **`patient-operations`** no ambiente de Produção (onde ela roda).
- As mudanças de frontend (arquivos `src/...`) entram via publicação do app.

---

## Riscos / cuidados
- Não vamos “liberar” `ensure_patient` sem autenticação (evita brecha).
- A solução foca em **enviar o token correto** e **blindar a criação do patient**.

