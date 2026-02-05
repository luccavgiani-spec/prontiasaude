

# Plano: Correção Definitiva do device_id para PIX

## Diagnóstico Confirmado

Após análise profunda do código, identifiquei que:

1. **O arquivo correto é `src/components/payment/PaymentModal.tsx`** - é o único que dispara `invokeEdgeFunction("mp-create-payment")` para PIX (linha 2251)

2. **Não existe outro modal ou handler** - confirmado via busca no projeto

3. **A função `invokeEdgeFunction` não remove campos** - ela simplesmente faz `JSON.stringify(options.body)`

4. **O problema está no frontend** - especificamente na captura e validação do device_id

---

## Causa Raiz Identificada

### Problema 1: Regex de Sanitização Muito Restritivo

```text
Linha 38: /^[A-Za-z0-9._:-]{10,200}$/
```

O `MP_DEVICE_SESSION_ID` gerado pelo `security.js` do Mercado Pago pode conter caracteres como:
- `=` (comum em base64)
- `+` (comum em base64)
- `/` (comum em base64)
- Outros caracteres especiais

**Se o ID real tiver qualquer caractere fora do regex, será rejeitado e retornará `null`.**

### Problema 2: Timing de Captura

O `useEffect` captura o device_id quando o modal abre, mas:
- O `security.js` pode não ter terminado de gerar o ID
- O estado `deviceId` fica `null`
- No momento do submit, `deviceId` ainda está `null`
- O `waitForMPDeviceId()` usa o mesmo regex restritivo

### Problema 3: Logs Insuficientes

Não há log no exato momento do submit do PIX mostrando:
- O valor de `window.MP_DEVICE_SESSION_ID`
- O valor do estado `deviceId`
- O valor retornado por `waitForMPDeviceId()`

---

## Correções Necessárias

### Correção 1: Relaxar o Regex de Sanitização (Linha 38)

**De:**
```typescript
if (!/^[A-Za-z0-9._:-]{10,200}$/.test(value)) return null;
```

**Para:**
```typescript
// ✅ CORREÇÃO: Aceitar base64 e outros chars válidos do MP_DEVICE_SESSION_ID
if (!/^[A-Za-z0-9._:\-=+\/]{10,500}$/.test(value)) return null;
```

### Correção 2: Adicionar Logs Diagnósticos no Submit do PIX (Linha ~2234)

**Antes de montar o `paymentRequest`:**
```typescript
// ✅ DEBUG: Log exato do device_id no momento do submit
const windowDeviceId = (window as any).MP_DEVICE_SESSION_ID;
const stateDeviceId = deviceId;
const waitedDeviceId = await waitForMPDeviceId();
const finalDeviceId = stateDeviceId || waitedDeviceId || null;

console.log("[handlePixSubmit] 🔍 Device ID Debug:", {
  window_MP_DEVICE_SESSION_ID: windowDeviceId,
  window_MP_DEVICE_SESSION_ID_type: typeof windowDeviceId,
  state_deviceId: stateDeviceId,
  waited_deviceId: waitedDeviceId,
  final_device_id: finalDeviceId,
  localStorage_mp_device_session_id: localStorage.getItem("mp_device_session_id"),
});
```

### Correção 3: Captura Direta no Momento do Submit (Linha 2235)

**De:**
```typescript
device_id: deviceId || (await waitForMPDeviceId()) || null,
```

**Para:**
```typescript
// ✅ CORREÇÃO: Captura direta + fallback + log
device_id: finalDeviceId,
```

E adicionar antes (na estrutura de debug):
```typescript
const finalDeviceId = deviceId 
  || (await waitForMPDeviceId()) 
  || (window as any).MP_DEVICE_SESSION_ID // ✅ Fallback direto sem sanitização
  || null;
```

---

## Arquivos a Modificar

| Arquivo | Alteração | Impacto |
|---------|-----------|---------|
| `src/components/payment/PaymentModal.tsx` | Relaxar regex + adicionar logs + captura direta | Resolve device_id = null |

**NÃO modificar:**
- Edge Functions (backend)
- index.html (security.js já funciona)
- Outros componentes

---

## Fluxo Corrigido

```text
┌─────────────────────────────────────────────────────────────┐
│                      FLUXO PIX (Corrigido)                  │
├─────────────────────────────────────────────────────────────┤
│ 1. Modal abre → useEffect tenta capturar device_id         │
│    ↓                                                        │
│ 2. User preenche dados e clica "Gerar PIX"                 │
│    ↓                                                        │
│ 3. handlePixSubmit executa:                                │
│    a) Log exato de window.MP_DEVICE_SESSION_ID             │
│    b) Log do estado deviceId                               │
│    c) Captura direta sem regex restritivo                  │
│    d) Monta paymentRequest com device_id real              │
│    ↓                                                        │
│ 4. invokeEdgeFunction envia JSON.stringify(body)           │
│    ↓                                                        │
│ 5. Backend recebe device_id e envia X-meli-session-id      │
│    ↓                                                        │
│ 6. Mercado Pago detecta device fingerprint → Qualidade 100 │
└─────────────────────────────────────────────────────────────┘
```

---

## Validação Pós-Implementação

1. **Abrir console do navegador**
2. **Executar pagamento PIX**
3. **Verificar log:** `[handlePixSubmit] 🔍 Device ID Debug:`
   - `window_MP_DEVICE_SESSION_ID`: deve mostrar string válida
   - `final_device_id`: deve ser a mesma string
4. **Verificar Network:** payload deve ter `"device_id": "arm0r.xxxxx..."`
5. **Rodar medição MP:** Qualidade deve subir para 90-100

---

## Resumo da Correção

| O que fazer | Onde | Por que |
|-------------|------|---------|
| Relaxar regex | Linha 38 | Aceitar chars do security.js |
| Adicionar logs | Linhas ~2230-2234 | Diagnosticar valor exato |
| Captura direta fallback | Linha 2235 | Garantir que device_id chegue |

**Total: 1 arquivo modificado, ~20 linhas alteradas**

