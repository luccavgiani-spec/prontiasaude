
# Plano de Correção: ClickLife Admin Console - Erro 401 "Usuário não encontrado"

## Diagnóstico

A geração de consultas via painel administrativo para **ClickLife** está falhando com erro:
```
ClickLife API error: 401 - {"error":"Usuário não encontrado"}
```

### Causa Raiz

Quando o admin cria uma consulta rápida, o payload inclui `skip_registration: true`. A lógica atual na função `schedule-redirect` interpreta isso como "pular cadastro, ir direto para atendimento".

**Porém:** Se o paciente NÃO estiver cadastrado na ClickLife, a criação de atendimento falha com 401.

### Fluxo Atual (Problemático)

```text
Admin → Criar Consulta ClickLife
    ↓
skip_registration: true
    ↓
PULA cadastro do paciente ← PROBLEMA!
    ↓
Tenta criar atendimento
    ↓
ClickLife: 401 "Usuário não encontrado"
    ↓
ERRO retornado ao admin
```

### Fluxo Corrigido

```text
Admin → Criar Consulta ClickLife
    ↓
skip_registration: true
    ↓
Tenta criar atendimento
    ↓
Se 401 "Usuário não encontrado":
    ↓
    CADASTRA paciente (fallback)
    ↓
    TENTA criar atendimento NOVAMENTE
    ↓
    Retorna sucesso ou erro
```

---

## Solução Técnica

### Arquivo a Modificar
`supabase/functions/schedule-redirect/index.ts`

### Alteração na função `redirectClickLife`

A lógica de `skip_registration` precisa ser modificada para:

1. Quando `skip_registration: true`, **TENTAR criar atendimento primeiro**
2. Se falhar com 401 ("Usuário não encontrado"), **CADASTRAR o paciente**
3. **TENTAR criar atendimento novamente**
4. Retornar resultado (sucesso ou erro persistente)

### Código a ser alterado (linhas ~1358-1490)

**Antes:**
```typescript
if (payload.skip_registration) {
  console.log('[ClickLife] ⏭️ skip_registration=true, pulando cadastro/ativação');
} else {
  // cadastra paciente
}
// tenta criar atendimento
```

**Depois:**
```typescript
// Função auxiliar para tentar criar atendimento
async function tryCreateAttendance(cpf, integratorToken, especialidadeId) {
  // ... lógica de criação
}

// 1. Tentar criar atendimento diretamente (skip_registration ou não)
let attendanceResult = await tryCreateAttendance(...);

// 2. Se falhou com 401 e skip_registration, fazer cadastro e retry
if (attendanceResult.status === 401 && payload.skip_registration) {
  console.log('[ClickLife] 401 com skip_registration, tentando cadastrar paciente...');
  await registerClickLifePatient(...);
  attendanceResult = await tryCreateAttendance(...); // Retry
}

// 3. Se ainda falhou SEM skip_registration, cadastrar normalmente
if (!attendanceResult.ok && !payload.skip_registration) {
  await registerClickLifePatient(...);
  attendanceResult = await tryCreateAttendance(...);
}
```

---

## Resumo das Alterações

| # | Alteração | Motivo |
|---|-----------|--------|
| 1 | Reestruturar fluxo de `redirectClickLife` | Permitir retry automático após cadastro |
| 2 | Tratar 401 como "paciente não existe" | Cadastrar paciente quando 401 for recebido |
| 3 | Manter compatibilidade com fluxo normal | Não alterar comportamento para usuários comuns |

---

## Teste Pós-Correção

1. Acessar Painel Admin → Cadastros
2. Selecionar um paciente SEM cadastro prévio na ClickLife
3. Clicar em "Criar Consulta Rápida"
4. Escolher **ClickLife**
5. Verificar que a consulta é criada com sucesso (URL retornada)

---

## Ação Necessária do Usuário

Após aprovar este plano:
1. Farei as alterações na função `schedule-redirect`
2. Você precisará **copiar/colar** a função atualizada no Supabase de Produção
3. Testaremos gerando uma consulta para o CPF 001.822.997-24

