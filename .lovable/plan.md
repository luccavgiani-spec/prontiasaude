
# ✅ IMPLEMENTADO: Correção Communicare Auto-Cadastro

## Alteração Realizada

Arquivo modificado: `supabase/functions/schedule-redirect/index.ts`

### O Que Foi Corrigido

A função `redirectCommunicare` agora:

1. **Busca primeiro por CPF** - Antes de qualquer criação
2. **Auto-cadastra se não encontrar** - Mesmo quando `skip_registration=true`
3. **Retry após falha** - Busca novamente por CPF se a criação falhar
4. **Erro estruturado** - Mensagem clara se nada funcionar

### Nova Versão
```
VERSION: 2026-01-28T-v3-communicare-auto-register
```

## Próximos Passos (VOCÊ PRECISA FAZER)

1. **Copiar** o arquivo `supabase/functions/schedule-redirect/index.ts` atualizado
2. **Colar** no painel Supabase de produção (`ploqujuhpwutpcibedbr`)
3. **Fazer deploy**
4. **Testar** criando consulta para Carolina via Communicare

## Teste Esperado

- Carolina via Communicare → Cadastra automaticamente → Enfileira → Retorna URL ✅
