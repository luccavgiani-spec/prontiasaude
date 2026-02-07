
# Fazer o Medidor MP Reconhecer SDK V2 + Device ID

## Problema

O `@mercadopago/sdk-react` inicializa o SDK internamente mas **nao expoe `window.MercadoPago`** como objeto global. O scanner do Mercado Pago verifica justamente `typeof window.MercadoPago` para validar que o SDK V2 esta presente. Resultado: nota 70.

## Solucao

Carregar o script `https://sdk.mercadopago.com/js/v2` diretamente (alem do React SDK que ja existe), e instanciar `new window.MercadoPago(PUBLIC_KEY)` globalmente. Isso nao conflita com o React SDK pois ambos usam o mesmo SDK por baixo.

## Alteracoes

### 1. Novo arquivo: `src/lib/mercadopago-global.ts`

Loader seguro do SDK V2 com as seguintes caracteristicas:
- Verifica se o script com `id="mp-sdk-v2"` ja existe antes de inserir
- Cria `<script>` com `src="https://sdk.mercadopago.com/js/v2"` e `id="mp-sdk-v2"`
- Retorna uma Promise que resolve quando o script carrega
- Apos carregamento, instancia `window.__mpGlobal = new window.MercadoPago(PUBLIC_KEY, { locale: 'pt-BR' })`
- Essa instancia NAO e usada no checkout - existe apenas para o scanner detectar
- Logs apenas em DEV (`import.meta.env.DEV`)

```text
Funcao exportada: loadMercadoPagoGlobal(): Promise<void>
  1. Se window.MercadoPago ja existe -> apenas inicializa __mpGlobal e retorna
  2. Se document.getElementById('mp-sdk-v2') existe -> aguarda load e retorna
  3. Senao -> cria script, aguarda onload, inicializa __mpGlobal
  4. Loga em DEV: typeof window.MercadoPago, MP_DEVICE_SESSION_ID
```

### 2. `src/main.tsx` (linha 10)

Adicionar import e chamada apos `initializeMercadoPago()`:

```text
import { loadMercadoPagoGlobal } from "./lib/mercadopago-global";

initializeMercadoPago();       // React SDK (existente)
loadMercadoPagoGlobal();       // SDK V2 global para o scanner (novo)
```

### 3. `src/types/global.d.ts` (linha 6)

Adicionar tipagem para `__mpGlobal` e `MP_DEVICE_SESSION_ID`:

```text
MercadoPago?: any;
__mpGlobal?: any;
MP_DEVICE_SESSION_ID?: string;
```

## Arquivos modificados

| Arquivo | Acao |
|---------|------|
| `src/lib/mercadopago-global.ts` | Novo - loader + init global |
| `src/main.tsx` | Adicionar 2 linhas (import + chamada) |
| `src/types/global.d.ts` | Adicionar 2 propriedades ao Window |

## Arquivos NAO alterados

- `index.html` (security.js permanece, sem novo script tag)
- `PaymentModal.tsx` (nenhuma alteracao)
- `MercadoPagoCardForm.tsx` (nenhuma alteracao)
- `mercadopago-init.ts` (nenhuma alteracao)
- Edge Functions (nenhuma)

## Resultado esperado apos deploy

```text
typeof window.MercadoPago        -> "function"
typeof window.__mpGlobal         -> "object"
window.MP_DEVICE_SESSION_ID      -> "armor..."
Network: sdk.mercadopago.com/js/v2    -> 200
Network: mercadopago.com/v2/security.js -> 200
Checkout PIX e cartao            -> sem regressao
```
