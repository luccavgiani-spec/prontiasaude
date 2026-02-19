

# Correcao: Cadastro de usuarios 100% fora do ar

## Diagnostico

O trigger `handle_new_user` no banco de **Producao** (`ploqujuhpwutpcibedbr`) ainda referencia a coluna `address_complement` (renomeada para `complement`), causando falha em `auth.admin.createUser()`.

O problema critico: a funcao `create-user-both-envs` tenta criar na **Producao primeiro**. Quando falha, verifica se o usuario ja existe no Cloud. Como e um usuario novo (nao existe em nenhum lugar), retorna erro 400 **sem nem tentar criar no Cloud**.

Resultado: **nenhum usuario novo consegue se cadastrar**.

## Correcao proposta

### Alteracao 1: `create-user-both-envs` - Inverter ordem de criacao

**Arquivo:** `supabase/functions/create-user-both-envs/index.ts`

Mudar a logica para:
1. Criar no **Cloud primeiro** (funciona, trigger ja esta correto)
2. Depois tentar criar na **Producao** (nao-fatal se falhar)
3. Se pelo menos Cloud tiver sucesso, retornar **sucesso** ao usuario
4. Logar o erro de Producao para debug mas nao bloquear o cadastro

Isso garante que **o cadastro volta a funcionar imediatamente**, mesmo antes de voce corrigir o trigger de Producao.

### Acao manual (Producao)

Voce ainda precisa corrigir o trigger na **Producao** executando este SQL no dashboard de Producao (`ploqujuhpwutpcibedbr`):

Primeiro, **verifique** se o fix anterior realmente aplicou:
```sql
SELECT prosrc FROM pg_proc WHERE proname = 'handle_new_user';
```

Se ainda mostrar `address_complement`, execute novamente:
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  existing_patient_id uuid;
BEGIN
  SELECT id INTO existing_patient_id
  FROM public.patients WHERE LOWER(email) = LOWER(NEW.email) LIMIT 1;

  IF existing_patient_id IS NOT NULL THEN
    UPDATE public.patients SET
      user_id = NEW.id,
      first_name = COALESCE(NULLIF(first_name, ''), NEW.raw_user_meta_data->>'first_name'),
      last_name = COALESCE(NULLIF(last_name, ''), NEW.raw_user_meta_data->>'last_name'),
      updated_at = NOW()
    WHERE id = existing_patient_id;
  ELSE
    INSERT INTO public.patients (user_id, email, first_name, last_name)
    VALUES (NEW.id, NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'first_name', NEW.raw_user_meta_data->>'given_name'),
      COALESCE(NEW.raw_user_meta_data->>'last_name', NEW.raw_user_meta_data->>'family_name'));
  END IF;
  RETURN NEW;
END; $$;
```

## Resumo

| Item | Detalhes |
|------|----------|
| Arquivo alterado | `supabase/functions/create-user-both-envs/index.ts` |
| Mudanca | Criar no Cloud primeiro, Producao depois (nao-fatal) |
| Efeito imediato | Cadastro volta a funcionar sem depender do fix de Producao |
| Acao manual | Corrigir trigger na Producao (verificar `prosrc` primeiro) |

