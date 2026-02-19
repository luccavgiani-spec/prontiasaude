

# Correcao: Logout apos cadastro + Usuario nao criado na Producao

## Diagnostico confirmado pelos logs

```
Cloud=true, Prod=false, success=true
```

**Dois problemas distintos:**

1. **Producao: trigger `handle_new_user` ainda quebrado** - O SQL que voce executou pode ter sido aplicado apenas no **Cloud** (Lovable Cloud), nao no banco de **Producao** (`ploqujuhpwutpcibedbr`). O erro "Database error creating new user" persiste na Producao.

2. **Logout pos-cadastro** - Mesmo com Producao falhando, o cadastro retorna `success: true` (correto). Porem, o `hybridSignUp` executa `supabase.auth.signOut()` (destroi sessao Cloud) e depois tenta login na Producao (onde o usuario nao existe). Resultado: usuario sem sessao, redirecionado para `/entrar`.

## Correcoes de codigo

### Alteracao 1: `src/lib/auth-hybrid.ts` (funcao `hybridSignUp`)

Substituir o bloco pos-criacao (linhas 301-342) por logica condicional:

- **Se `result.prodUserId` existe** (Producao OK): manter comportamento atual (signOut Cloud, login Producao)
- **Se `result.prodUserId` NAO existe** (Producao falhou): NAO fazer signOut, fazer login no **Cloud**, definir `auth_environment = 'cloud'`

### Alteracao 2: `src/pages/Cadastrar.tsx` (linha 339)

Remover `sessionStorage.setItem('auth_environment', 'production')` que sobrescreve incondicionalmente o ambiente. O `hybridSignUp` ja define o ambiente correto.

## Acao manual obrigatoria (Producao)

O trigger na Producao **ainda esta quebrado**. O SQL precisa ser executado no dashboard do projeto **de Producao** (`ploqujuhpwutpcibedbr`), NAO no Lovable Cloud.

**Passo 1**: Verificar o trigger atual na Producao:
```sql
SELECT prosrc FROM pg_proc WHERE proname = 'handle_new_user';
```

Se ainda mostrar `address_complement`, execute:

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
| Arquivos alterados | `src/lib/auth-hybrid.ts`, `src/pages/Cadastrar.tsx` |
| Mudanca principal | Login no Cloud quando Producao falha, preservando sessao |
| Efeito | Usuario permanece logado apos cadastro e e redirecionado corretamente |
| Acao manual | Corrigir trigger na Producao (verificar se SQL foi no banco correto) |

