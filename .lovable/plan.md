

# Correcao: Parsing/Normalizacao de birth_date na patient-operations

## Problema
Usuarios nao conseguem editar data de nascimento nem criar cadastros. A Edge Function `patient-operations` retorna 500 com erro generico porque:
1. `upsert_patient` passa `birth_date` direto ao Postgres sem normalizar
2. `admin_update_patient` faz o mesmo
3. A funcao `validateDate` e restritiva demais e usa `new Date()` que causa problemas de timezone
4. O catch generico engole o erro real, impossibilitando debug

## Solucao

### Arquivo: `supabase/functions/patient-operations/index.ts`

**Alteracao 1 - Adicionar funcao de normalizacao de data (apos a funcao `validateDate`, ~linha 499):**

```typescript
// Normaliza qualquer formato de data para YYYY-MM-DD (formato aceito pelo Postgres)
function normalizeDateToISO(value: any): string | null {
  if (!value) return null;
  
  const str = String(value).trim();
  
  // Ja esta no formato YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  
  // ISO timestamp: 2000-01-15T00:00:00.000Z -> 2000-01-15
  if (/^\d{4}-\d{2}-\d{2}T/.test(str)) {
    return str.substring(0, 10);
  }
  
  // DD/MM/YYYY ou DD-MM-YYYY
  const brMatch = str.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (brMatch) {
    return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  }
  
  // MM/DD/YYYY (fallback)
  const usMatch = str.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  // Ja coberto acima, evitar ambiguidade - priorizar DD/MM/YYYY (formato BR)
  
  return null; // formato nao reconhecido
}
```

**Alteracao 2 - Corrigir `validateDate` (~linha 494):**

```typescript
const validateDate = (dateStr: string): boolean => {
  const normalized = normalizeDateToISO(dateStr);
  if (!normalized) return false;
  const [year, month, day] = normalized.split('-').map(Number);
  if (year < 1900 || year > new Date().getFullYear()) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  return true;
};
```

**Alteracao 3 - Normalizar birth_date em `upsert_patient` (~linha 732):**

De:
```typescript
if (body.birth_date) patientData.birth_date = body.birth_date;
```
Para:
```typescript
if (body.birth_date) {
  const normalizedDate = normalizeDateToISO(body.birth_date);
  if (normalizedDate) {
    patientData.birth_date = normalizedDate;
  } else {
    console.warn("[upsert_patient] birth_date ignorada (formato invalido):", body.birth_date);
  }
}
```

**Alteracao 4 - Normalizar birth_date em `admin_update_patient` (~linha 2305-2312):**

Adicionar normalizacao dentro do loop de sanitizacao:

```typescript
const sanitizedUpdates: Record<string, any> = {};
for (const key of Object.keys(updates)) {
  if (ALLOWED_FIELDS.includes(key)) {
    if (key === 'birth_date' && updates[key]) {
      const normalized = normalizeDateToISO(updates[key]);
      if (normalized) {
        sanitizedUpdates[key] = normalized;
      } else {
        console.warn("[admin_update_patient] birth_date ignorada:", updates[key]);
      }
    } else {
      sanitizedUpdates[key] = updates[key];
    }
  }
}
```

**Alteracao 5 - Normalizar em `complete_profile` (~linha 838):**

De:
```typescript
if (!validateDate(profileData.birth_date)) {
```
Para:
```typescript
const normalizedBirthDate = normalizeDateToISO(profileData.birth_date);
if (!normalizedBirthDate) {
```

E usar `normalizedBirthDate` no `gasPayload` (linha 867):
```typescript
birth_date: normalizedBirthDate,
```

**Alteracao 6 - Melhorar catch generico para debug (~linha 2394-2410):**

```typescript
catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : '';
  console.error("Error in patient-operations:", errorMessage);
  console.error("Stack:", errorStack);
  console.error("Operation:", body?.operation);

  const requestOrigin = req.headers.get("origin");
  const errorCorsHeaders = getCorsHeaders(requestOrigin);

  return new Response(
    JSON.stringify({
      success: false,
      error: "Erro interno do servidor",
      debug_hint: errorMessage.substring(0, 200),
    }),
    {
      headers: { ...errorCorsHeaders, "Content-Type": "application/json" },
      status: 500,
    },
  );
}
```

## Resumo de Impacto

| Alteracao | Descricao | Linhas |
|-----------|-----------|--------|
| normalizeDateToISO() | Nova funcao de normalizacao | Adicionar apos linha 499 |
| validateDate() | Usar normalizacao | Linhas 494-499 |
| upsert_patient | Normalizar birth_date antes de salvar | Linha 732 |
| admin_update_patient | Normalizar birth_date no loop | Linhas 2305-2312 |
| complete_profile | Normalizar antes de validar | Linha 838 e 867 |
| catch generico | Adicionar debug_hint na resposta | Linhas 2394-2410 |

Nenhum outro arquivo sera alterado. Apos a alteracao no codigo, voce precisara copiar novamente o arquivo para o Supabase de Producao.
