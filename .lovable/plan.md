
# Plano: Corrigir Geração de Consulta na Communicare para o Painel Administrativo

## Diagnóstico do Problema

### O Que Acontece Hoje

O fluxo atual quando o Admin tenta gerar consulta via Communicare com `skip_registration=true`:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ handleQuickConsult (UserRegistrationsTab.tsx)                               │
│   → payload.skip_registration = true                                        │
│   → payload.force_provider = 'communicare'                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ redirectCommunicare (schedule-redirect)                                     │
│                                                                             │
│   1. skip_registration=true → PULA criação de paciente                      │
│   2. Busca paciente existente por CPF                                       │
│   3. Carolina não tem cadastro na Communicare → patientId = undefined       │
│   4. ❌ ERRO: "Paciente não encontrado na Communicare"                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Causa Raiz

O `skip_registration=true` foi projetado para pular o cadastro porque presume que o paciente já existe. Porém, diferente da ClickLife (onde o token do integrador permite criar atendimento sem cadastro prévio), a Communicare **requer** um `patientId` válido para enfileirar o paciente.

**Carolina não está cadastrada na Communicare**, então:
- A busca por CPF retorna vazio
- O sistema falha ao tentar enfileirar

### Solução

Para o caso do Admin que quer gerar consulta manualmente, quando o paciente não existe na Communicare, devemos:

1. **Detectar que o paciente não existe** (após busca por CPF falhar)
2. **Cadastrar o paciente automaticamente** (mesmo com `skip_registration=true`)
3. **Continuar o fluxo normalmente** com o `patientId` obtido

Ou seja: `skip_registration` deve significar "não falhar por erro de cadastro" e não "nunca tentar cadastrar".

---

## Arquivos que Serão Modificados

| Arquivo | Motivo |
|---------|--------|
| `supabase/functions/schedule-redirect/index.ts` | Ajustar lógica de `redirectCommunicare` para cadastrar automaticamente quando paciente não encontrado |

**Confirmação:** Estas alterações estão explicitamente solicitadas? **SIM** (você pediu para corrigir o problema específico da Communicare).

---

## Plano de Implementação

### Fase A - Modificar a Lógica de `redirectCommunicare`

#### A1. Ajustar o fluxo para auto-cadastrar quando paciente não existe

**Lógica Atual (linhas 1771-1815):**
```javascript
if (payload.skip_registration) {
  console.log('[Communicare] ⏭️ skip_registration=true, pulando criação de paciente');
} else {
  const patientResult = await createCommunicarePatient(payload, API_TOKEN);
  // ... obtém patientId
}

// Se não tem patientId, busca por CPF
if (!patientId) {
  // busca por CPF...
}

// Se AINDA não tem patientId, retorna erro
if (!patientId) {
  return Response({ error: 'Paciente não encontrado...' });
}
```

**Lógica Nova:**
```javascript
// 1. Primeiro, sempre tentar buscar paciente existente por CPF
let patientId = await tryFindPatientByCPF(payload.cpf, API_TOKEN);

// 2. Se não encontrou E temos dados suficientes, criar automaticamente
if (!patientId) {
  if (payload.skip_registration) {
    console.log('[Communicare] skip_registration=true, mas paciente não existe. Criando automaticamente...');
  }
  
  // Criar paciente (só precisa de CPF, nome, email, telefone)
  const patientResult = await createCommunicarePatient(payload, API_TOKEN);
  
  if (patientResult.success && patientResult.patientId) {
    patientId = patientResult.patientId;
  } else {
    // Se criação falhou, buscar novamente (pode ter sido criado por outro processo)
    patientId = await tryFindPatientByCPF(payload.cpf, API_TOKEN);
  }
}

// 3. Se AINDA não tem patientId, aí sim retorna erro estruturado
if (!patientId) {
  console.error('[Communicare] ❌ Não foi possível criar nem encontrar paciente');
  return new Response(
    JSON.stringify({
      ok: false,
      provider: 'communicare',
      error: 'Não foi possível cadastrar paciente na Communicare. Verifique os dados e tente novamente.',
      details: { cpf: payload.cpf, reason: 'create_patient_failed' }
    }),
    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

#### A2. Extrair a busca por CPF para função reutilizável

Criar helper `tryFindPatientByCPF` para evitar duplicação:

```javascript
async function tryFindPatientByCPF(cpf: string, apiToken: string): Promise<number | undefined> {
  const PATIENTS_BASE = Deno.env.get('COMMUNICARE_PATIENTS_BASE') || 
                        'https://api-patients-production.communicare.com.br';
  const cpfClean = cpf.replace(/\D/g, '');
  
  try {
    console.log('[Communicare] Buscando paciente por CPF:', cpfClean.substring(0, 3) + '***');
    
    const getRes = await fetch(`${PATIENTS_BASE}/v1/patient?cpf=${cpfClean}`, {
      method: 'GET',
      headers: { 'api_token': apiToken }
    });
    
    if (!getRes.ok) {
      console.warn('[Communicare] Busca por CPF falhou:', getRes.status);
      return undefined;
    }
    
    const getDataText = await getRes.text();
    
    try {
      const getData = JSON.parse(getDataText);
      const patientId = Array.isArray(getData) ? getData[0]?.id : getData?.id;
      
      if (patientId) {
        console.log('[Communicare] ✓ Paciente encontrado por CPF:', patientId);
        return patientId;
      }
    } catch (parseErr) {
      console.warn('[Communicare] Resposta de busca não é JSON válido:', getDataText.substring(0, 200));
    }
  } catch (fetchError) {
    console.warn('[Communicare] Erro ao buscar paciente por CPF:', fetchError);
  }
  
  return undefined;
}
```

---

## Fluxo Corrigido

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ handleQuickConsult (UserRegistrationsTab.tsx)                               │
│   → payload.skip_registration = true                                        │
│   → payload.force_provider = 'communicare'                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ redirectCommunicare (schedule-redirect) - FLUXO CORRIGIDO                   │
│                                                                             │
│   1. Buscar paciente por CPF                                                │
│      ├── Encontrou → patientId = X, prossegue                               │
│      └── Não encontrou → vai para passo 2                                   │
│                                                                             │
│   2. Criar paciente automaticamente (mesmo com skip_registration=true)      │
│      ├── Sucesso → patientId = Y, prossegue                                 │
│      └── Falha → buscar novamente por CPF (retry)                           │
│                                                                             │
│   3. Se ainda sem patientId → erro estruturado                              │
│                                                                             │
│   4. Enfileirar paciente com patientId                                      │
│                                                                             │
│   5. ✅ Retornar URL da consulta                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Validação

### Testes a Executar Após Deploy

1. **Carolina via Communicare (primeiro acesso)**
   - Esperado: Cadastra automaticamente na Communicare → Enfileira → Retorna URL
   
2. **Carolina via Communicare (segundo acesso)**
   - Esperado: Encontra por CPF → Enfileira → Retorna URL (sem cadastrar novamente)

3. **Carolina via ClickLife**
   - Esperado: Continua funcionando como agora

4. **Paciente com dados incompletos (sem telefone)**
   - Esperado: Erro estruturado explicando que faltam dados

---

## Seção Técnica - Resumo das Alterações

### `supabase/functions/schedule-redirect/index.ts`

1. **Adicionar função `tryFindPatientByCPF`** (helper para busca)
   - Localização: após `createCommunicarePatient` (linha ~1665)

2. **Modificar `redirectCommunicare`** (linhas 1768-1831)
   - Inverter a ordem: primeiro buscar, depois criar se não existir
   - Remover dependência do `skip_registration` para decisão de criar paciente
   - `skip_registration` passa a significar apenas "não falhar por erros de cadastro duplicado"

### Impacto nos Outros Fluxos

- **Pagamento normal → Communicare**: Continua igual (cria paciente se não existir)
- **Plano ativo → ClickLife**: Não afetado
- **Override → ClickLife**: Não afetado
- **Override → Communicare**: Agora funciona mesmo para pacientes novos

---

## Próximo Passo

Após aprovar este plano, implementarei as alterações no código. Depois você precisará:

1. **Copiar o arquivo `schedule-redirect/index.ts` atualizado**
2. **Colar no painel Supabase de produção**
3. **Fazer deploy**
4. **Testar criar consulta para Carolina via Communicare**
