
# Correção: Criar Consulta Instantânea para TODOS os Pacientes

## Diagnóstico dos Problemas

### Problema 1: Carolina não gera consulta (ClickLife)
**Causa raiz** (linhas 1326-1391 de `schedule-redirect/index.ts`):

Quando `registerClickLifePatient` falha (paciente já existe com dados diferentes), o código tenta uma "ativação direta". Se a ativação também falha (paciente já ativo), **retorna erro 500 ao invés de continuar para criar o atendimento**.

```typescript
// Linha 1351-1391 - Comportamento atual
if (!activationRes.ok) {
  // ❌ RETORNA ERRO - deveria continuar para criar atendimento
  return new Response(JSON.stringify({ ok: false, ... }), { status: 500 });
}
```

**Carolina já está cadastrada E ativa na ClickLife** → ambas as etapas falham → erro 500

### Problema 2: Communicare não funciona quando forçado
**Causa raiz** (linhas 1796-1808):

Se `createCommunicarePatient` não retornar um `patientId` (mesmo quando paciente já existe mas a API não retorna ID), **o código retorna erro 500**.

```typescript
// Linha 1796-1808 - Comportamento atual
if (!patientResult.success || !patientResult.patientId) {
  // ❌ RETORNA ERRO - deveria tentar buscar paciente existente
  return new Response(JSON.stringify({ ok: false, ... }), { status: 500 });
}
```

### Problema 3: Override não está sendo ignorado pelo force_provider
O `force_provider` já está na posição correta (linha 714), MAS os erros nas funções de redirect impedem que a consulta seja criada.

---

## Solução: Flag `skip_registration`

Adicionar um flag `skip_registration: true` no payload quando vem do painel admin. Este flag instrui as funções de redirect a:
1. **Ignorar erros de cadastro** (paciente já existe)
2. **Ignorar erros de ativação** (paciente já ativo)
3. **Ir direto para criação do atendimento**

---

## Arquivos que serão modificados

1. `src/components/admin/UserRegistrationsTab.tsx` - Adicionar flag ao payload
2. `supabase/functions/schedule-redirect/index.ts` - Respeitar flag e continuar mesmo com erros

---

## Correções Técnicas

### 1. Frontend: Adicionar `skip_registration` ao payload (UserRegistrationsTab.tsx)

**Localização**: função `handleQuickConsult`, linha ~401

```typescript
const payload = {
  cpf: quickConsultUser.patient?.cpf || '',
  email: quickConsultUser.email,
  nome: `${quickConsultUser.patient?.first_name || ''} ${quickConsultUser.patient?.last_name || ''}`.trim(),
  telefone: quickConsultUser.patient?.phone_e164 || '',
  sku: 'ITC6534',
  plano_ativo: !!quickConsultUser.activePlan,
  sexo: quickConsultUser.patient?.gender || 'F',
  birth_date: quickConsultUser.patient?.birth_date,
  force_provider: quickConsultProvider,
  skip_registration: true, // ✅ NOVO: Pular cadastro, ir direto para atendimento
};
```

### 2. Edge Function: Respeitar flag em redirectClickLife (linhas 1315-1410)

**Modificar a função para permitir "fallback graceful"**:

```typescript
async function redirectClickLife(payload: SchedulePayload, reason: string, corsHeaders: Record<string, string>) {
  // ... código existente até linha 1314 ...

  // 1. CADASTRAR PACIENTE (ou pular se skip_registration)
  let registrationSuccess = true;
  
  if (!payload.skip_registration) {
    const registration = await registerClickLifePatient(
      payload.cpf, payload.nome, payload.email, payload.telefone,
      planoId, sexoFinal, payload.birth_date
    );

    if (!registration.success) {
      console.warn('[ClickLife] Cadastro falhou, tentando ativação direta:', registration.error);
      
      // Tentar ativação direta
      const cpfClean = payload.cpf.replace(/\D/g, '');
      const INTEGRATOR_TOKEN = Deno.env.get('CLICKLIFE_AUTH_TOKEN')!;
      
      const activationRes = await fetch(`${API_BASE}/usuarios/ativacao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'authtoken': INTEGRATOR_TOKEN },
        body: JSON.stringify({
          authtoken: INTEGRATOR_TOKEN,
          cpf: cpfClean,
          empresaid: 9083,
          planoid: planoId,
          proposito: "Ativar"
        })
      });
      
      if (!activationRes.ok) {
        const errorText = await activationRes.text();
        console.warn('[ClickLife] ⚠️ Ativação também falhou (paciente pode já estar ativo):', errorText.substring(0, 200));
        // ✅ NÃO RETORNAR ERRO - continuar para criar atendimento
        registrationSuccess = false;
      }
    }
  } else {
    console.log('[ClickLife] ⏭️ skip_registration=true, pulando cadastro/ativação');
  }

  // ✅ SEMPRE continuar para criar atendimento (mesmo se registro/ativação falhou)
  console.log('[ClickLife] Prosseguindo com criação de atendimento (registrationSuccess:', registrationSuccess, ')');

  // 2. CRIAR AGENDAMENTO (resto do código existente a partir da linha 1413)
  // ...
}
```

### 3. Edge Function: Respeitar flag em redirectCommunicare (linhas 1793-1810)

**Modificar para buscar paciente existente mesmo quando criar falha**:

```typescript
// 2. CRIAR PACIENTE (se não existir) ou buscar existente
let patientId: number | undefined;

if (!payload.skip_registration) {
  const patientResult = await createCommunicarePatient(payload, API_TOKEN);
  
  if (patientResult.success && patientResult.patientId) {
    patientId = patientResult.patientId;
  }
}

// ✅ Se não tem patientId ainda, buscar por CPF
if (!patientId) {
  console.log('[Communicare] Buscando paciente existente por CPF...');
  const PATIENTS_BASE = Deno.env.get('COMMUNICARE_PATIENTS_BASE') || 
                        'https://api-patients-production.communicare.com.br';
  const cpfClean = payload.cpf.replace(/\D/g, '');
  
  const getRes = await fetch(`${PATIENTS_BASE}/v1/patient?cpf=${cpfClean}`, {
    method: 'GET',
    headers: { 'api_token': API_TOKEN }
  });
  
  if (getRes.ok) {
    const getData = await getRes.json();
    patientId = Array.isArray(getData) ? getData[0]?.id : getData.id;
    
    if (patientId) {
      console.log('[Communicare] ✓ Paciente existente encontrado:', patientId);
    }
  }
}

// ✅ Se AINDA não tem patientId, aí sim retorna erro
if (!patientId) {
  console.error('[Communicare] ❌ Paciente não encontrado nem criado');
  return new Response(
    JSON.stringify({
      ok: false,
      provider: 'communicare',
      error: 'Paciente não encontrado na Communicare. Verifique se o CPF está correto.'
    }),
    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Continuar com enfileiramento...
```

---

## Fluxo Esperado Após Correção

### Cenário 1: Carolina (já cadastrada na ClickLife)
1. Admin abre modal, seleciona "ClickLife"
2. Clica "Criar Consulta"
3. Payload inclui `skip_registration: true`
4. Edge function **pula** cadastro e ativação
5. Vai direto para `/atendimentos/atendimentos`
6. ✅ Retorna link da consulta

### Cenário 2: Carolina com Communicare forçada
1. Admin abre modal, seleciona "Communicare"
2. Clica "Criar Consulta"
3. Payload inclui `force_provider: 'communicare'` e `skip_registration: true`
4. Edge function respeita `force_provider` (linha 719)
5. Busca patientId existente por CPF
6. Enfileira na Communicare
7. ✅ Retorna link da consulta

### Cenário 3: Novo paciente (sem cadastro prévio)
1. Admin clica "Criar Consulta"
2. Payload inclui `skip_registration: true`
3. Edge function **tenta criar atendimento direto**
4. Se falhar (paciente não existe), retorna erro específico
5. Admin sabe que precisa completar cadastro primeiro

---

## Resumo das Mudanças

| Arquivo | Linha | Mudança |
|---------|-------|---------|
| `UserRegistrationsTab.tsx` | ~410 | Adicionar `skip_registration: true` ao payload |
| `schedule-redirect/index.ts` | ~1315-1410 | Não retornar erro 500 quando registro/ativação falha, continuar para criar atendimento |
| `schedule-redirect/index.ts` | ~1793-1810 | Buscar paciente existente por CPF se criar falhar |

---

## Critérios de Aceite

1. ✅ Carolina consegue ter consulta criada na ClickLife
2. ✅ Carolina consegue ter consulta criada na Communicare (quando selecionado)
3. ✅ Admin consegue forçar provider mesmo com override ativo
4. ✅ Link é exibido no modal para copiar
5. ✅ Pacientes novos (sem cadastro) recebem erro claro
