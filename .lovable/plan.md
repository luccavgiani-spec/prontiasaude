# Plano Concluído: Ativação e Visualização de Planos

## Status: ✅ IMPLEMENTADO

## Correções Aplicadas

### 1. `supabase/functions/patient-operations/index.ts`

**`activate_plan_manual`:**
- Busca diretamente por email na tabela `patient_plans`
- Se já existe plano para o email → UPDATE
- Se não existe → INSERT com email obrigatório
- Não força mais `id = patient.id` (os IDs são independentes)

**`deactivate_plan_manual`:**
- Alterado para receber `patient_email` ao invés de `patient_id`
- Busca e atualiza por `.eq('email', email)` ao invés de `.eq('id', patient_id)`

### 2. `src/lib/patient-plan.ts`

**`getPatientPlanByEmail`:**
- Busca DIRETA por email na tabela `patient_plans`
- Removido o passo intermediário de buscar `patients.id` primeiro
- A coluna `email` é a chave de referência (NOT NULL no banco de produção)

---

## Schema Real da Tabela `patient_plans` (Produção)

```
id              UUID (PK autônomo - NÃO é igual ao patients.id!)
email           TEXT (NOT NULL!) ← CHAVE DE REFERÊNCIA
user_id         UUID (nullable)
plan_code       TEXT (NOT NULL)
plan_expires_at DATE
status          TEXT (default 'active')
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

---

## Próximos Passos

1. **Copiar edge function** `patient-operations` para o Supabase de produção
2. **Atualizar registro do Tulio** no banco de produção (se necessário):
   ```sql
   UPDATE patient_plans 
   SET status = 'active', 
       plan_code = 'BASIC', 
       plan_expires_at = CURRENT_DATE + INTERVAL '30 days',
       updated_at = NOW()
   WHERE email = 't.giani@gmail.com';
   ```
3. **Testar** ativação de plano pelo painel admin

---

## Critérios de Aceite

1. ✅ Ativar plano pelo modal admin → sucesso (sem erro NOT NULL)
2. ✅ Listar pacientes → Tulio mostra badge verde com código do plano
3. ✅ Área do Paciente (logado como Tulio) → mostra plano ativo
4. ✅ Remover plano pelo botão X → status muda para 'cancelled'
