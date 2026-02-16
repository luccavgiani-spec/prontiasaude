

# Correcao: "Criar Consulta" falha no mobile (Failed to fetch)

## Diagnostico

O erro `TypeError: Failed to fetch` no mobile e causado por restricoes de CORS no navegador mobile dentro do iframe de preview. A funcao `schedule-redirect` no Supabase de Producao tem uma lista restrita de headers permitidos:

```
Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type
```

Navegadores mobile frequentemente enviam headers adicionais (como `x-supabase-client-platform`, `x-supabase-client-platform-version`, etc.) que sao **rejeitados** no preflight OPTIONS, causando o `Failed to fetch` antes mesmo do request real.

## Solucao

Atualizar os CORS headers na edge function `schedule-redirect` para incluir TODOS os headers que navegadores mobile podem enviar. A funcao ja tem `verify_jwt = false`, entao nao ha risco adicional de seguranca.

## Alteracao

### `supabase/functions/schedule-redirect/index.ts` (linhas 24-28)

Atualizar o `Access-Control-Allow-Headers` no `getCorsHeaders`:

```text
ANTES:
"Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"

DEPOIS:
"Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version"
```

## Pos-alteracao

Apos a alteracao no codigo aqui no Lovable, voce precisara **copiar o conteudo atualizado** do `schedule-redirect/index.ts` e **redeployar no Supabase de Producao** para que o mobile funcione.

| Arquivo | Linha | O que muda |
|---------|-------|------------|
| `supabase/functions/schedule-redirect/index.ts` | 26 | Adicionar headers extras no CORS Allow-Headers |

