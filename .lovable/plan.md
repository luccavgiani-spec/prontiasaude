
# Correção: Parsing Seguro em Todas as Chamadas `.json()` do schedule-redirect

## Diagnóstico Confirmado

O erro `"Unexpected token '<', "<br />\n<b>"... is not valid JSON"` ocorre porque:
1. A API externa (ClickLife ou Communicare) retorna HTTP 200/201 (sucesso)
2. Mas o corpo da resposta é HTML (página de erro PHP) ao invés de JSON
3. O código chama `.json()` diretamente, que falha ao parsear HTML

### Localização exata do bug (linhas problemáticas)

```text
Linha 360:  const activationData = await activationRes.json();  // ClickLife ativação
Linha 385:  const loginData = await loginRes.json();            // ClickLife login  
Linha 1465: const data = await response.json();                 // ClickLife scheduling
Linha 1723: const ssoData = await ssoResponse.json();           // Communicare SSO
```

---

## Arquivo que será modificado

1. `supabase/functions/schedule-redirect/index.ts`

**Motivo**: Corrigir parsing de JSON em todas as chamadas de API externas para evitar crash quando receber HTML.

**Escopo exato**: Trocar `.json()` direto por `.text()` + `JSON.parse()` com try/catch em 4 lugares específicos.

---

## Correção Técnica

### Padrão de parsing seguro a ser aplicado

```typescript
// ANTES (problemático):
const data = await response.json();

// DEPOIS (seguro):
const responseText = await response.text();
let data;
try {
  data = JSON.parse(responseText);
} catch (parseError) {
  console.error('[Provider] ❌ Resposta não é JSON válido:', responseText.substring(0, 500));
  return {
    success: false,
    error: 'API retornou resposta inválida (não JSON)',
    debug_hint: 'HTML recebido ao invés de JSON',
    response_preview: responseText.substring(0, 200)
  };
}
```

### Correções específicas

#### 1. Linha 360 - ClickLife ativação
```typescript
// ANTES
const activationData = await activationRes.json();

// DEPOIS
const activationText = await activationRes.text();
let activationData;
try {
  activationData = JSON.parse(activationText);
} catch (parseError) {
  console.error('[ClickLife] ❌ Resposta de ativação não é JSON:', activationText.substring(0, 500));
  return { 
    success: false, 
    error: 'ClickLife retornou resposta inválida na ativação',
    debug_hint: 'API retornou HTML ao invés de JSON',
    response_preview: activationText.substring(0, 200)
  };
}
```

#### 2. Linha 385 - ClickLife login
```typescript
// ANTES
const loginData = await loginRes.json();

// DEPOIS
const loginText = await loginRes.text();
let loginData;
try {
  loginData = JSON.parse(loginText);
} catch (parseError) {
  console.error('[ClickLife] ❌ Resposta de login não é JSON:', loginText.substring(0, 500));
  return { 
    success: false, 
    error: 'ClickLife retornou resposta inválida no login',
    debug_hint: 'API retornou HTML ao invés de JSON'
  };
}
```

#### 3. Linha 1465 - ClickLife scheduling
```typescript
// ANTES
const data = await response.json();

// DEPOIS
const responseText = await response.text();
let data;
try {
  data = JSON.parse(responseText);
} catch (parseError) {
  console.error('[ClickLife] ❌ Resposta de scheduling não é JSON:', responseText.substring(0, 500));
  return new Response(
    JSON.stringify({
      ok: false,
      provider: 'clicklife',
      error: 'ClickLife retornou resposta inválida',
      debug_hint: 'API retornou HTML ao invés de JSON',
      response_preview: responseText.substring(0, 200)
    }),
    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

#### 4. Linha 1723 - Communicare SSO
```typescript
// ANTES
const ssoData = await ssoResponse.json();

// DEPOIS
const ssoText = await ssoResponse.text();
let ssoData;
try {
  ssoData = JSON.parse(ssoText);
} catch (parseError) {
  console.error('[Communicare] ❌ Resposta SSO não é JSON:', ssoText.substring(0, 500));
  return new Response(
    JSON.stringify({
      ok: false,
      provider: 'communicare',
      error: 'Communicare SSO retornou resposta inválida',
      debug_hint: 'API retornou HTML ao invés de JSON',
      response_preview: ssoText.substring(0, 200)
    }),
    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

---

## Criação manual da consulta da Carolina

Após corrigir e deployar, vou:
1. Usar a edge function `schedule-redirect` com os dados da Carolina
2. Se ClickLife continuar retornando HTML, forçar Communicare como alternativa
3. Criar o appointment manualmente no banco com a URL gerada

### Dados confirmados da Carolina

| Campo | Valor |
|-------|-------|
| Email | carolina6lima@gmail.com |
| CPF | 04021896040 |
| Nome | Carolina De Lima Bombardelli |
| Telefone | +5546999240242 |
| Nascimento | 1999-08-23 |
| Sexo | F |
| SKU | ITC6534 (Clínico Geral) |

---

## Critérios de Aceite

1. **Nenhum crash 500** com "Unexpected token" - erros de parsing devem retornar mensagem clara
2. **Debug visível** - o painel admin deve mostrar `debug_hint` e `response_preview` quando ocorrer erro
3. **Carolina encaminhada** - após a correção, criar consulta para ela manualmente

---

## Sequência de implementação

1. Editar `schedule-redirect/index.ts` com as 4 correções de parsing
2. Deploy da edge function
3. Testar criação de consulta pelo painel admin
4. Criar consulta da Carolina via edge function diretamente
