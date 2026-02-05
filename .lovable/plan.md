
## 0) Resumo do que está errado (com evidência de código)

### A) Admin (suporte@…) não consegue editar no “modo produção”
**Evidência:** `src/components/admin/EditPatientModal.tsx` faz UPDATE direto via **cliente Cloud**:
- `import { supabase } from '@/integrations/supabase/client';`
- `supabase.from('patients').update(...).eq('id', patient.id)` (linhas ~130–134)

No “modo produção”, o painel lista pacientes que podem vir do ambiente de produção (IDs diferentes). Então:
- o UPDATE vai para o banco Cloud (ou falha por RLS / ou atualiza 0 linhas),
- e não altera o dado real do ambiente de produção.

### B) Usuário (em produção) não consegue editar o próprio perfil
O “Editar perfil” do usuário leva a `/completar-perfil` (confirmado em `src/pages/AreaDoPaciente.tsx` linhas ~448–452). Ao salvar, ele chama `upsertPatientBasic()` (em `src/lib/patients.ts`).

Há dois problemas concretos no fluxo híbrido:

1) **Bug de parâmetro:** `upsertPatientBasic()` detecta `environment`, mas chama:
```ts
await ensurePatientRow(userId, dbClient);
```
sem passar o `environment`.  
**Evidência:** `src/lib/patients.ts` linha ~88.  
Isso força `ensurePatientRow()` a operar como `cloud` (default), mesmo quando o usuário está em produção.

2) **Authorization sendo sobrescrito no invokeCloudEdgeFunction:**  
`ensurePatientRow()` tenta montar headers com o token do `dbClient`, mas quando cai em `invokeCloudEdgeFunction`, ele **sempre** redefine `Authorization` com o token do Cloud (ou anon do Cloud).  
**Evidência:** `src/lib/edge-functions.ts` linha ~107–109.

Resultado prático: em produção, parte do fluxo acaba chamando função/banco “errado”, e o usuário percebe “não salva / não edita”.

### C) Cadastro “signal is aborted without reason”
Pontos prováveis (e corrigíveis com mudanças mínimas e objetivas):

1) `create-user-both-envs` faz verificação de existência por:
```ts
auth.admin.listUsers({ page: 1, perPage: 1000 })
```
em dois ambientes (Cloud + Produção).  
**Evidência:** `supabase/functions/create-user-both-envs/index.ts` linhas ~102–115.  
Isso pode ficar lento/intermitente e levar a abort em mobile/conexões ruins.

2) `checkUserExists()` no frontend usa fetch com `VITE_SUPABASE_URL` (que hoje aponta pro Cloud), o que é frágil em ambiente híbrido.  
**Evidência:** `src/lib/auth-hybrid.ts` linhas ~44–54.

---

## 1) O que vou mudar (mínimo e objetivo)

### 1.1 Corrigir edição do usuário (produção) no `/completar-perfil`
- **Arquivo:** `src/lib/patients.ts`
- **Mudança mínima:**
  - passar `environment` para `ensurePatientRow(userId, dbClient, environment)`
  - garantir que, em `production`, o `ensurePatientRow()` invoque a função do ambiente correto e preserve `Authorization` (via `invokeEdgeFunction`, que já respeita `options.headers.Authorization`).

**Por que isso resolve:** impede chamadas “cloud por engano” e evita token incompatível / função errada.

### 1.2 Corrigir edição pelo Admin no painel (produção)
- **Arquivo:** `supabase/functions/patient-operations/index.ts`
  - adicionar operação **`admin_update_patient`**
  - adicionar `admin_update_patient` no `AUTH_BYPASS_OPERATIONS` (para não exigir token “da produção”)
  - **validar o token no Cloud** (mesmo padrão já existente no arquivo para `activate_plan_manual`) e checar role `admin` no `user_roles` do Cloud
  - atualizar registro `patients` no **ambiente de produção** usando `service_role` (bypass RLS, com validação server-side).
  - aplicar whitelist dos campos permitidos (somente os campos do modal: first_name, last_name, cpf, phone_e164, birth_date, gender, cep, address_line, address_number, city, state).

- **Arquivo:** `src/components/admin/EditPatientModal.tsx`
  - trocar o `.from('patients').update(...)` por `invokeEdgeFunction('patient-operations', { operation:'admin_update_patient', ... })`.

**Por que isso resolve:** o painel deixa de “editar Cloud” e passa a editar produção com segurança (validação admin server-side).

### 1.3 Tornar o cadastro mais confiável (reduzir abort/timeout)
- **Arquivo:** `supabase/functions/create-user-both-envs/index.ts`
  - substituir a verificação por listagem de 1000 users por `auth.admin.getUserByEmail(email)` em ambos os ambientes (mais rápido/estável).
  - manter fallback/logs claros caso getUserByEmail retorne erro.

- **Arquivo:** `supabase/functions/check-user-exists/index.ts`
  - substituir paginação/listUsers por `auth.admin.getUserByEmail` (Cloud + Produção) para resposta instantânea.

- **Arquivo:** `src/lib/auth-hybrid.ts`
  - trocar o `fetch(${VITE_SUPABASE_URL}/functions/v1/check-user-exists...)` por uma chamada via `invokeEdgeFunction('check-user-exists', ...)`, que já tem URL “de produção” hardcoded e reduz risco de endpoint errado.
  - manter o comportamento “fail open” (permitir fluxo normal em caso de erro), mas com logs melhores.

**Por que isso resolve:** evita chamadas pesadas e reduz chance de abort em mobile.

### 1.4 (Opcional, mas altamente recomendado) Preferência de sessão pelo ambiente escolhido
- **Arquivo:** `src/lib/auth-hybrid.ts`
  - ajustar `getHybridSession()` para respeitar `sessionStorage.auth_environment` quando existir:
    - se `auth_environment === 'production'`, checar produção primeiro; se não houver sessão lá, aí checar cloud.
    - se `auth_environment === 'cloud'`, mantém cloud primeiro.
  - Isso evita “sessão fantasma Cloud” ganhar prioridade quando o usuário acabou de logar na produção.

**Por que isso resolve:** elimina o caso clássico de “tenho sessão nos dois locais, mas o app escolhe o ambiente errado”.

---

## 2) Atualização do contato da Natália (o pedido direto)
Você pediu:
- email: `nataliageraldodossantos@gmail.com`
- nome: `Natália Fernanda Geraldo`
- sobrenome: `dos Santos`

Como eu não posso executar UPDATE direto via SQL daqui, vou fazer de forma segura assim que o fluxo de edição estiver corrigido:
1) Após implementar `admin_update_patient`, você entra no painel com `suporte@prontiasaude.com.br`.
2) Abre “Pacientes” → busca a Natália → edita e salva.
3) Se preferir, após publicar as mudanças você me avisa “estou logado como suporte no preview”, e eu disparo a chamada pela função usando a própria sessão do seu navegador.

---

## 3) Arquivos que serão modificados (lista objetiva)

1) `src/lib/patients.ts`  
2) `src/components/admin/EditPatientModal.tsx`  
3) `supabase/functions/patient-operations/index.ts`  
4) `supabase/functions/create-user-both-envs/index.ts`  
5) `supabase/functions/check-user-exists/index.ts`  
6) `src/lib/auth-hybrid.ts`  

---

## 4) MOTIVO (baseado no seu pedido)
- Você relatou falhas em produção para:
  - admin editar manualmente paciente,
  - usuário editar o próprio perfil,
  - novos cadastros falhando com erro de abort.
- A evidência no código mostra escrita no ambiente errado (Cloud vs produção) e validações/auth incompatíveis em modo híbrido.

---

## 5) ESCOPO (exatamente o que será alterado)
- Somente:
  - roteamento correto de ambiente (Cloud/produção) em `ensurePatientRow`/`getHybridSession`
  - troca do UPDATE do Admin para uma chamada backend segura (`admin_update_patient`)
  - otimização objetiva de “check user exists / create user” (trocar listUsers pesado por getUserByEmail)
- Não vou alterar:
  - integrações de pagamento (Mercado Pago),
  - regras de redirecionamento Clicklife/Communicare,
  - conteúdo/serviços/FAQ/home sections.

---

## 6) CONFIRMAÇÃO (regra do projeto)
**Estas alterações estão explicitamente solicitadas?**  
- **SIM** quanto ao objetivo (corrigir edição e cadastro em produção)  
- **NÃO** quanto aos caminhos de arquivo (você não citou os paths nesta última mensagem), porém **são estritamente necessárias** para atender o problema.

Ao aprovar este plano, você autoriza as mudanças apenas nos arquivos listados acima, dentro do escopo descrito.

---

## 7) Como vamos validar (checklist E2E)
1) Produção (usuário comum):
   - Login
   - Área do paciente → “Editar perfil” → salvar
   - Recarregar página → confirmar dados persistidos
2) Produção (admin suporte):
   - Login admin → abrir paciente → editar nome/telefone → salvar → conferir persistência
3) Cadastro:
   - Criar conta com email novo em mobile/desktop
   - Confirmar que não aparece “signal is aborted without reason”
4) Logs:
   - Edge function `create-user-both-envs` e `check-user-exists` com logs claros e execução rápida

