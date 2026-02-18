

# Correcao: mp-create-subscription com 2 bugs bloqueantes

## Problemas Identificados

### 1. CORS retornando null
O teste OPTIONS retorna `Status: 200` mas `CORS: null`. Isso bloqueia o navegador antes da requisicao POST chegar a funcao. Possivel causa: a versao deployada nao inclui o CORS inline corretamente, ou o Supabase esta interceptando o OPTIONS antes da funcao.

**Acao:** Atualizar a funcao para garantir que o header CORS seja retornado corretamente. Adicionar tambem `Access-Control-Max-Age` para cache de preflight.

### 2. Coluna `is_active` nao existe na Producao
A tabela `services` na Producao usa `active` (nao `is_active`). A linha 115 da funcao faz:
```
.eq('is_active', true)
```
Isso causa erro SQL 42703 e a funcao retorna "Plano nao encontrado ou inativo".

**Acao:** Trocar `.eq('is_active', true)` por `.eq('active', true)` na funcao.

## Arquivo Alterado

### `supabase/functions/mp-create-subscription/index.ts`

Duas alteracoes cirurgicas:

**2a. Linha ~115 - Corrigir nome da coluna:**

De:
```typescript
.eq('is_active', true)
```
Para:
```typescript
.eq('active', true)
```

**2b. Reforcar headers CORS no preflight** (garantir que funciona mesmo com interceptacao do Supabase):

Sem outras alteracoes. A logica de CORS inline ja esta correta no codigo fonte. O problema do CORS null pode ser que a versao antiga deployada nao tinha o CORS inline. Ao redeployar com a correcao da coluna, o CORS tambem sera atualizado.

## Apos a alteracao

Voce precisara copiar novamente o arquivo corrigido para o dashboard do Supabase de Producao (mesma operacao que fez antes). Depois, rodar os mesmos dois testes:

1. Teste CORS - deve retornar `CORS: https://prontiasaude.com.br`
2. Teste SQL - rodar `SELECT ... FROM services WHERE sku LIKE 'IND_%' AND active = true;`

## Resumo de impacto

| Alteracao | Arquivo | Linhas |
|-----------|---------|--------|
| `is_active` para `active` | mp-create-subscription/index.ts | 1 linha |

Nenhum outro arquivo e alterado.
