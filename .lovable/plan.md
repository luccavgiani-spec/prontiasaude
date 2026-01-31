

# Correção Urgente: Declaração Duplicada de `data` no schedule-redirect

## Problema Identificado

O erro `SyntaxError: Identifier 'data' has already been declared` ocorre porque há código duplicado no arquivo `schedule-redirect/index.ts`:

```text
Linha 1531: const data = attendanceResult.data;  ← NOVA lógica (correta)
Linha 1534: const responseText = await response.text();  ← CÓDIGO ANTIGO (deveria ter sido removido)
Linha 1535: let data;  ← DECLARAÇÃO DUPLICADA (causa o erro!)
```

## Causa Raiz

Quando implementei o novo fluxo com `tryCreateClickLifeAttendance()` e `doRegisterPatient()`, esqueci de remover o bloco de código antigo que processava a resposta de forma diferente.

---

## Correção a Ser Feita

**Arquivo:** `supabase/functions/schedule-redirect/index.ts`

**Ação:** Remover as linhas 1533-1550 (código antigo duplicado) e manter apenas a linha 1531 que já extrai `data` corretamente de `attendanceResult.data`.

### Código a Remover (linhas 1533-1550):

```typescript
// ✅ SAFE PARSING: Evitar crash se ClickLife retornar HTML ao invés de JSON
const responseText = await response.text();
let data;
try {
  data = JSON.parse(responseText);
} catch (parseError) {
  console.error('[ClickLife] ❌ Resposta de scheduling não é JSON válido:', responseText.substring(0, 500));
  return new Response(
    JSON.stringify({
      ok: false,
      provider: 'clicklife',
      error: 'ClickLife retornou resposta inválida',
      debug_hint: 'API retornou HTML ao invés de JSON. Possível erro no backend da ClickLife.',
      response_preview: responseText.substring(0, 200)
    }),
    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

### Código que permanece (linha 1531):

```typescript
const data = attendanceResult.data;
```

---

## Resumo

| Ação | Linhas | Descrição |
|------|--------|-----------|
| REMOVER | 1533-1550 | Código antigo de parsing que duplica variável `data` |
| MANTER | 1531 | Extração correta de `data` do resultado |

---

## Após Correção

1. Atualizarei o arquivo aqui no Cloud
2. Você copiará/colará novamente no Supabase de Produção
3. Testaremos a geração de consulta ClickLife para CPF 001.822.997-24

