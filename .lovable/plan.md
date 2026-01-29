
## Objetivo (o que vai mudar)
Corrigir a ativação manual de plano que hoje falha com:
```json
{ "success": false, "step": "patient_lookup", "error": "Paciente não encontrado com este email" }
```
A causa mais provável é: o usuário existe no `auth.users` (Cloud/Produção) mas **não existe registro correspondente na tabela `patients` da Produção** (ou existe com email nulo/diferente). A ativação manual hoje exige esse registro e aborta.

---

## 1) Arquivos que serão modificados
1. `supabase/functions/patient-operations/index.ts`

(Observação: você também autorizou `src/components/admin/UserRegistrationsTab.tsx`, mas **não vou mexer nele** porque a correção pode ser feita 100% no backend e com menos risco.)

---

## 2) Escopo exato da correção (backend)
### 2.1. Ajustar o fluxo `activate_plan_manual` para não falhar quando `patients` não existe
No `case 'activate_plan_manual'`, no **PASSO 4 (patient_lookup)**:

**ANTES (atual):**
- Busca somente por `patients.email = patient_email`
- Se não acha, retorna 404 com “Paciente não encontrado com este email”

**DEPOIS (corrigido):**
- Tentar localizar/criar o paciente em Produção antes de falhar:

Ordem de tentativa:
1) **Se `patient_id` vier no payload**, tentar:
   - Buscar `patients` por `id = patient_id` (caso `patient_id` seja de fato um `patients.id`)
2) Buscar por `email` (com normalização, como já faz)
3) Se ainda não encontrar:
   - Tentar obter um `user_id` válido na Produção (quando aplicável):
     - Se `patient_id` veio, tentar `supabase.auth.admin.getUserById(patient_id)`
       - Se encontrar, usar esse `patient_id` como `user_id` do paciente
   - **Criar (upsert) um registro mínimo em `patients` na Produção**, usando:
     - `email = patient_email normalizado`
     - `user_id = (user_id encontrado acima) || null`
     - `profile_complete = false` (ou manter padrão)
   - Rebuscar o paciente após o upsert para seguir o fluxo normal

Critérios importantes:
- Se `patient_id` vier mas for um ID do Cloud (e não existir na Produção), a tentativa `getUserById` vai falhar — nesse caso, o registro `patients` será criado com `user_id = null`, o que ainda permite ativar plano por email.
- **Não vamos depender de CPF** para resolver esse erro (opcional). O objetivo é desbloquear a ativação apenas com email.

### 2.2. Melhorar logs e retorno de erro (para não ficar “no escuro”)
- Incluir logs no `activate_plan_manual` indicando:
  - se encontrou paciente por `id`
  - se encontrou por `email`
  - se precisou criar o paciente
  - se conseguiu vincular `user_id` da Produção
- Se ainda falhar, retornar `details` explicando exatamente em qual passo falhou (ex.: falha ao criar patient, erro de banco, etc.)

---

## 3) Como isso resolve seu problema na prática
Após a mudança:
- Ao clicar “Ativar Plano” no Admin:
  - mesmo que o usuário ainda não exista em `patients` da Produção, a função cria automaticamente um registro mínimo e **prossegue com o upsert do plano** em `patient_plans`.
- Isso elimina o bloqueio “Paciente não encontrado com este email” e torna a ativação manual resiliente para usuários “cloud-only”, migrados ou com cadastro incompleto.

---

## 4) Confirmação sobre “novos cadastros”
Pelo código atual do `create-user-both-envs`, o cadastro:
- cria usuário na Produção
- cria usuário no Cloud (se conseguir)
- faz `upsert` na tabela `patients` em ambos (Produção e Cloud)

Nesta correção, eu vou **validar o caminho de “novo cadastro” indiretamente**, garantindo que mesmo que algum registro `patients` falhe/esteja faltando, a ativação manual não quebra.

Teste recomendado (pós-implementação):
1) Criar um usuário novo (cadastro)
2) Verificar que aparece na aba Pacientes
3) Ativar um plano manualmente para esse email (deve funcionar sem erro)

---

## 5) Passos de validação (checklist)
1) No Admin → Pacientes → selecionar um usuário que hoje dá erro
2) Ativar um plano manualmente
3) Confirmar:
   - retorna `success: true`
   - a tabela `patient_plans` passa a ter `status = active` para o email
   - não aparece mais “Paciente não encontrado com este email”

---

## 6) Regras de alteração (conforme sua política interna)
1. **ARQUIVOS QUE SERÃO MODIFICADOS:** `supabase/functions/patient-operations/index.ts`
2. **MOTIVO:** corrigir o erro de ativação manual (“Paciente não encontrado com este email”) criando/recuperando automaticamente o registro `patients` na Produção.
3. **ESCOPO:** somente a lógica do fluxo `activate_plan_manual` (lookup + fallback de criação), mais logs/retorno.
4. **CONFIRMAÇÃO: “Estas alterações estão explicitamente solicitadas?”** SIM — você solicitou corrigir a ativação manual e autorizou editar `patient-operations`.
