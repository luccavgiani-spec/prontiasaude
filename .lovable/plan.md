

# Melhorar Qualidade da Integracao Mercado Pago (70 para 90+)

## Diagnostico

A integracao ja tem todos os componentes necessarios implementados, mas com **duplicidades e conflitos** que provavelmente derrubam a nota:

| Item | Status | Problema |
|------|--------|----------|
| SDK V2 (MercadoPago.js) | Instalado 2x | Script no HTML + React SDK no npm - conflito |
| security.js (Device Fingerprint) | OK | Carrega corretamente |
| Device ID capture | Funcional mas redundante | Leitura triplicada identica na mesma funcao |
| Secure Fields (PCI) | 2 fluxos coexistindo | CardPayment React SDK + Brick manual no PaymentModal |
| device_id enviado ao backend | OK | Enviado como body.device_id |
| declare global Window | Duplicado | PaymentModal.tsx + global.d.ts |

## Plano de Correcao

### Tarefa A - Limpar duplicidade do SDK V2

**index.html**: Remover a linha 161 (`<script src="https://sdk.mercadopago.com/js/v2"></script>`). O React SDK (`@mercadopago/sdk-react`) ja carrega o SDK internamente. Manter apenas o `security.js` (linha 158) que e um script separado para device fingerprint.

**main.tsx**: Remover a funcao `ensureMercadoPagoSdkLoaded()` e a espera async. O React SDK (`initMercadoPago`) ja gerencia o carregamento. Simplificar para inicializacao sincrona.

### Tarefa B - Consolidar Device ID

**PaymentModal.tsx**: Corrigir a funcao `getMpDeviceSessionId()` que le `window.MP_DEVICE_SESSION_ID` 3 vezes identicamente (linhas 74-76). Manter apenas 1 leitura. Remover o `declare global` duplicado (linhas 28-32) pois ja existe em `src/types/global.d.ts`.

### Tarefa C - Eliminar fluxo duplicado de cartao (brick manual)

**PaymentModal.tsx**: O arquivo tem ~3455 linhas com dois fluxos de cartao coexistindo:
- Fluxo 1 (linhas ~870-1050): Brick manual via `bricksBuilder.create("cardPayment")` - **LEGADO**
- Fluxo 2: Componente `<MercadoPagoCardForm />` que usa `<CardPayment />` do React SDK - **CORRETO**

Verificar qual fluxo esta ativo na renderizacao e garantir que apenas o do React SDK (`MercadoPagoCardForm`) seja utilizado. Se o brick manual for codigo morto/unreachable, remove-lo. Se ambos renderizam, desativar o legado.

### Tarefa D - Logs DEV controlados

Adicionar uma flag `MP_DEBUG` baseada em `import.meta.env.DEV` para controlar logs verbose do Mercado Pago. Envolver os `console.log` existentes do Device ID e tokenizacao com esta flag para que nao poluam producao.

## Arquivos que serao modificados

| Arquivo | Alteracao |
|---------|-----------|
| `index.html` | Remover script SDK V2 duplicado (linha 161) |
| `src/main.tsx` | Remover `ensureMercadoPagoSdkLoaded()`, simplificar init |
| `src/components/payment/PaymentModal.tsx` | Remover `declare global` duplicado, corrigir leitura triplicada do Device ID, avaliar/remover brick manual legado |
| `src/components/payment/MercadoPagoCardForm.tsx` | Sem alteracoes significativas (ja esta correto) |

## O que NAO sera alterado

- Nenhuma Edge Function (mp-create-payment, mp-webhook, etc.)
- Nenhuma rota ou pagina
- Nenhum fluxo de PIX existente
- Nenhuma tabela ou schema
- Nenhum componente fora do sistema de pagamento
- `statement_descriptor` e configurado no backend - frontend ja envia todos os dados necessarios

## Resultado esperado

Apos estas correcoes, o Mercado Pago detectara:
- SDK V2 carregado uma unica vez (sem conflitos)
- Device ID capturado e enviado corretamente (sem leituras redundantes)
- Secure Fields (PCI) via um unico fluxo CardPayment
- Nenhum numero de cartao trafegando no frontend

