

# Correcao: Cadastros nao criados na Producao

## Causa raiz identificada

A coluna `id` da tabela `patients` na **Producao** esta configurada como `NOT NULL` sem valor default. No Cloud, essa mesma coluna tem `DEFAULT gen_random_uuid()`.

Quando o trigger `handle_new_user` executa um INSERT sem especificar `id`, o banco da Producao rejeita a operacao por violacao de NOT NULL. O GoTrue (sistema de autenticacao) captura esse erro do trigger e retorna a mensagem generica **"Database error creating new user"**, fazendo o rollback completo da criacao do usuario.

## Evidencia

CSV do schema da Producao:
```
id,NO,null,uuid    <-- column_default = null (sem default!)
```

Schema do Cloud (funcionando):
```
id | uuid | NOT NULL | DEFAULT gen_random_uuid()
```

## Correcao (uma unica linha SQL)

Execute no dashboard do Supabase de **Producao** (`ploqujuhpwutpcibedbr`):

```sql
ALTER TABLE public.patients ALTER COLUMN id SET DEFAULT gen_random_uuid();
```

## Nenhuma alteracao de codigo necessaria

O trigger, a Edge Function e o frontend estao corretos. O problema e exclusivamente de schema no banco de Producao.

## Resultado esperado

Apos executar o SQL:
- Novos cadastros serao criados em **ambos** os ambientes (Cloud + Producao)
- Os logs mostrarao `Cloud=true, Prod=true, success=true`
- O usuario permanecera logado apos o cadastro (correcao anterior no `auth-hybrid.ts`)

