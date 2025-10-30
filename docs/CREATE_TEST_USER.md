# Criar Usuário de Teste QA

## Opção 1: Via Supabase Dashboard (Recomendado)

1. Acesse: https://supabase.com/dashboard/project/ploqujuhpwutpcibedbr/auth/users
2. Clique em "Add User" → "Create new user"
3. Preencha:
   - **Email**: `qa+cadastro@prontiasaude.test`
   - **Password**: `Teste123!`
   - **Auto Confirm User**: ✅ Ativado

4. Copie o UUID gerado (ex: `abc123-...`)

5. Execute no SQL Editor (https://supabase.com/dashboard/project/ploqujuhpwutpcibedbr/sql/new):

```sql
-- SUBSTITUA '<USER_UUID>' PELO UUID COPIADO ACIMA

-- 1. Criar paciente completo
INSERT INTO public.patients (
  id,
  first_name,
  last_name,
  cpf,
  email,
  phone_e164,
  birth_date,
  gender,
  cep,
  address_line,
  address_number,
  city,
  state,
  profile_complete,
  intake_complete,
  terms_accepted_at,
  created_at,
  updated_at,
  source
) VALUES (
  '<USER_UUID>',
  'QA',
  'Tester',
  '76260544073',
  'qa+cadastro@prontiasaude.test',
  '+5511999999999',
  '1990-01-01',
  'M',
  '01310100',
  'Avenida Paulista, 1000, Bela Vista, São Paulo - SP',
  '1000',
  'São Paulo',
  'SP',
  true,
  true,
  now(),
  now(),
  now(),
  'test'
)
ON CONFLICT (id) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  cpf = EXCLUDED.cpf,
  email = EXCLUDED.email,
  phone_e164 = EXCLUDED.phone_e164,
  birth_date = EXCLUDED.birth_date,
  gender = EXCLUDED.gender,
  cep = EXCLUDED.cep,
  address_line = EXCLUDED.address_line,
  address_number = EXCLUDED.address_number,
  city = EXCLUDED.city,
  state = EXCLUDED.state,
  profile_complete = true,
  intake_complete = true,
  terms_accepted_at = now(),
  updated_at = now();

-- 2. Criar plano ativo (válido por 1 ano)
INSERT INTO public.patient_plans (
  id,
  user_id,
  email,
  plan_code,
  status,
  plan_expires_at,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  '<USER_UUID>',
  'qa+cadastro@prontiasaude.test',
  'ITC6534', -- Clínico Geral
  'active',
  now() + interval '1 year',
  now(),
  now()
)
ON CONFLICT DO NOTHING;

-- 3. Verificar criação
SELECT 
  p.id,
  p.first_name,
  p.last_name,
  p.email,
  p.cpf,
  p.profile_complete,
  p.intake_complete,
  pp.plan_code,
  pp.status as plan_status,
  pp.plan_expires_at
FROM public.patients p
LEFT JOIN public.patient_plans pp ON pp.user_id = p.id
WHERE p.email = 'qa+cadastro@prontiasaude.test';
```

---

## Opção 2: Via Edge Function (Script Completo)

Se preferir automatizar, você pode criar uma edge function `create-test-user` com o seguinte código:

```typescript
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1';

serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // 1. Criar usuário
    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email: 'qa+cadastro@prontiasaude.test',
      password: 'Teste123!',
      email_confirm: true,
      user_metadata: {
        first_name: 'QA',
        last_name: 'Tester',
        cpf: '76260544073'
      }
    });

    if (userError) throw userError;

    // 2. Criar paciente
    const { error: patientError } = await supabase
      .from('patients')
      .upsert({
        id: userData.user.id,
        first_name: 'QA',
        last_name: 'Tester',
        cpf: '76260544073',
        email: 'qa+cadastro@prontiasaude.test',
        phone_e164: '+5511999999999',
        birth_date: '1990-01-01',
        gender: 'M',
        cep: '01310100',
        address_line: 'Avenida Paulista, 1000, Bela Vista, São Paulo - SP',
        address_number: '1000',
        city: 'São Paulo',
        state: 'SP',
        profile_complete: true,
        intake_complete: true,
        terms_accepted_at: new Date().toISOString(),
        source: 'test'
      });

    if (patientError) throw patientError;

    // 3. Criar plano
    const { error: planError } = await supabase
      .from('patient_plans')
      .insert({
        user_id: userData.user.id,
        email: 'qa+cadastro@prontiasaude.test',
        plan_code: 'ITC6534',
        status: 'active',
        plan_expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      });

    if (planError) throw planError;

    return new Response(
      JSON.stringify({ 
        success: true, 
        user_id: userData.user.id,
        message: 'Usuário de teste criado com sucesso'
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
```

---

## Credenciais do Usuário de Teste

✅ **Email**: `qa+cadastro@prontiasaude.test`  
✅ **Senha**: `Teste123!`  
✅ **CPF**: `762.605.440-73` (limpo: `76260544073`)  
✅ **Plano**: Ativo (ITC6534 - Clínico Geral)  
✅ **Validade**: 1 ano a partir da criação  

---

## Validação Pós-Criação

Após criar o usuário, teste:

1. **Login**: Acesse `/entrar` e faça login com as credenciais
2. **Área do Paciente**: Verifique se o plano ativo aparece
3. **Perfil Completo**: Confirme que `profile_complete = true`
4. **Intake Completo**: Confirme que `intake_complete = true`
5. **Agendamento**: Tente agendar uma consulta para validar o fluxo

---

## Limpeza (Opcional)

Para remover o usuário de teste:

```sql
-- Deletar plano
DELETE FROM public.patient_plans WHERE email = 'qa+cadastro@prontiasaude.test';

-- Deletar paciente
DELETE FROM public.patients WHERE email = 'qa+cadastro@prontiasaude.test';

-- Deletar usuário (via Dashboard ou Admin API)
```
