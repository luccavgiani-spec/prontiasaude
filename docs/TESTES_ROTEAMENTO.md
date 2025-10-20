# Documentação de Testes - Sistema de Roteamento Inteligente

## Visão Geral

Este documento descreve os cenários de teste para validar o sistema de roteamento entre **ClickLife** e **Communicare** implementado na Edge Function `schedule-redirect`.

## Acesso

**URL:** `/admin/dashboard` → Aba "Testes de Roteamento"

**Credenciais Admin:**
- Email: `suporte@prontiasaude.com.br`
- Senha: `admin123!`

## Cenários de Teste

### Grupo A: Admin Override

#### A1 - Override Admin → ClickLife
**Condição:** `force_clicklife = true` no `admin_settings`  
**Comportamento:** Todos os agendamentos vão para ClickLife, ignorando horário e plano  
**Provider Esperado:** `clicklife`  
**Reason Esperado:** `admin_override`

---

### Grupo B: Plano Ativo

#### B1 - Plano Ativo + Clínico Geral → ClickLife (863)
**Condições:**
- `plano_ativo = true`
- SKU: `ITC6534` (Clínico Geral)
- Qualquer horário

**Provider Esperado:** `clicklife`  
**Reason Esperado:** `active_plan`  
**Plano ID:** `863`

#### B2 - Plano Ativo + Especialista → ClickLife (864)
**Condições:**
- `plano_ativo = true`
- SKU de especialista (ex: `TQP5720` - Cardiologista)
- Qualquer horário

**Provider Esperado:** `clicklife`  
**Reason Esperado:** `active_plan`  
**Plano ID:** `864`

---

### Grupo C: Sem Plano - Horário Comercial (07:00-19:00, dias úteis)

#### C1 - Clínico Geral + Horário Comercial → Communicare
**Condições:**
- `plano_ativo = false`
- SKU: `ITC6534` (Clínico Geral)
- Horário: Segunda a Sexta, 07:00-19:00

**Provider Esperado:** `communicare`  
**Reason Esperado:** `commercial_hours`

#### C2 - Psicólogo + Horário Comercial → Communicare
**Condições:**
- `plano_ativo = false`
- SKU: `ZXW2165`, `HXR8516` ou `YME9025` (Psicólogo)
- Horário: Segunda a Sexta, 07:00-19:00

**Provider Esperado:** `communicare`  
**Reason Esperado:** `commercial_hours`

#### C3 - Especialidade Indisponível → ClickLife
**Condições:**
- `plano_ativo = false`
- SKU de especialista não disponível na Communicare (ex: Cardiologista)
- Horário: Segunda a Sexta, 07:00-19:00

**Provider Esperado:** `clicklife`  
**Reason Esperado:** `specialty_unavailable`

---

### Grupo D: Sem Plano - Fora do Horário Comercial

#### D1 - Noturno → ClickLife
**Condições:**
- `plano_ativo = false`
- Horário: Segunda a Sexta, 19:00-07:00

**Provider Esperado:** `clicklife`  
**Reason Esperado:** `nighttime`

#### D2 - Sábado → ClickLife
**Condições:**
- `plano_ativo = false`
- Horário: Sábado, qualquer hora

**Provider Esperado:** `clicklife`  
**Reason Esperado:** `weekend`

#### D3 - Domingo → ClickLife
**Condições:**
- `plano_ativo = false`
- Horário: Domingo, qualquer hora

**Provider Esperado:** `clicklife`  
**Reason Esperado:** `weekend`

---

## Como Executar os Testes

### Método 1: Cenários Pré-Configurados
1. Acesse `/admin/dashboard`
2. Clique na aba "Testes de Roteamento"
3. Selecione um cenário no dropdown "Cenário Pré-Configurado"
4. Clique em "Carregar" para popular os parâmetros
5. Clique em "Executar Teste"
6. Veja o resultado com validação automática

### Método 2: Parâmetros Manuais
1. Na mesma interface, preencha manualmente:
   - CPF (11 dígitos)
   - Email
   - SKU/Especialidade
   - Horário (datetime-local)
   - Checkbox "Plano Ativo"
2. Clique em "Executar Teste"

---

## Validação de Resultados

Para cada teste, o sistema valida automaticamente:
- ✅ **Provider:** Deve corresponder ao esperado (`clicklife` ou `communicare`)
- ✅ **Reason:** Deve corresponder ao motivo esperado
- ✅ **Plano ID:** (quando ClickLife) Deve ser `863` ou `864` conforme esperado
- ✅ **URL:** Deve estar presente no response
- ⏱️ **Tempo de Resposta:** Deve ser < 3s

**Status do Teste:**
- 🎯 **PASSOU:** Todos os critérios foram atendidos
- ❌ **FALHOU:** Algum critério divergiu do esperado

---

## Admin Override

### O que é?
Um mecanismo de emergência que força **todos** os agendamentos para ClickLife, ignorando:
- Horário (comercial ou noturno)
- Dia da semana (útil ou fim de semana)
- Status do plano (ativo ou não)
- Especialidade

### Como ativar/desativar?
1. Acesse a interface de testes
2. No card "Admin Override" no topo da página
3. Clique em "Ativar Override" ou "Desativar Override"
4. O sistema atualiza o valor de `force_clicklife` no `admin_settings`

### Quando usar?
- Manutenção programada da Communicare
- Incidentes técnicos com a integração Communicare
- Testes de integração exclusiva com ClickLife
- Situações emergenciais

⚠️ **IMPORTANTE:** Lembre-se de desativar após o uso!

---

## Histórico de Testes

A interface mantém um histórico dos últimos 10 testes executados, mostrando:
- ID do cenário
- Horário de execução
- Status (passou/falhou)
- Provider retornado
- Tempo de resposta

---

## Logs e Debugging

### Console Logs
Todos os testes geram logs estruturados no console do navegador:
```
[QA Test A1] Admin Override
→ Request: { cpf: "123...", plano_ativo: false, ... }
← Response: { ok: true, provider: "clicklife", reason: "admin_override" }
✅ PASSOU (provider correto)
```

### Edge Function Logs
Para ver logs detalhados da Edge Function:
1. Acesse o Supabase Dashboard
2. Vá em Functions → `schedule-redirect` → Logs
3. Filtre por horário do teste
4. Analise os `console.log` da função

**Link direto:** [schedule-redirect logs](https://supabase.com/dashboard/project/ploqujuhpwutpcibedbr/functions/schedule-redirect/logs)

---

## Troubleshooting

### ❌ "Erro ao executar teste"
**Possíveis causas:**
- Edge Function não está online
- Secrets não configurados (CLICKLIFE_*, COMMUNICARE_*)
- Permissões RLS incorretas no `admin_settings`

**Solução:** Verificar logs da Edge Function e secrets no Supabase.

### ❌ "Teste falhou - resultado divergente"
**Possíveis causas:**
- Lógica de horário incorreta (fuso horário UTC vs local)
- SKU não mapeado corretamente
- `force_clicklife` ativo quando não deveria

**Solução:** 
1. Verificar o JSON expandível (Request/Response)
2. Confirmar horário ISO está correto
3. Verificar status do Admin Override

### ❌ "Communicare retorna erro"
**Possíveis causas:**
- JWT SSO expirado ou inválido
- CPF não cadastrado na Communicare
- API da Communicare indisponível

**Solução:** Verificar logs da Edge Function e testar com outro CPF.

### ❌ "ClickLife retorna erro"
**Possíveis causas:**
- Token de autenticação inválido
- Plano ID incorreto para o SKU
- CPF já possui agendamento no mesmo horário

**Solução:** Verificar mapeamento SKU → plano_id e usar CPF de teste diferente.

---

## Mapeamento SKU → Plano ID

### Clínico Geral (plano_id: 863)
- `ITC6534` - Pronto Atendimento

### Especialistas (plano_id: 864)
- `TQP5720` - Cardiologista
- `HGG3503` - Dermatologista
- `VHH8883` - Endocrinologista
- `TSB0751` - Gastroenterologista
- `CCP1566` - Ginecologista
- `FKS5964` - Oftalmologista
- `TVQ5046` - Ortopedista
- `HMG9544` - Pediatra
- `HME8366` - Otorrinolaringologista
- `DYY8522` - Médico da Família
- `QOP1101` - Psiquiatra
- `LZF3879` - Nutrólogo
- `YZD9932` - Geriatria
- `UDH3250` - Reumatologista
- `PKS9388` - Neurologista
- `MYX5186` - Infectologista

### Psicólogos (Communicare apenas)
- `ZXW2165` - Psicólogo 1 sessão
- `HXR8516` - Psicólogo 4 sessões
- `YME9025` - Psicólogo 8 sessões

---

## Especialidades Disponíveis na Communicare

- Clínico Geral
- Psicólogo (todas as variantes)

**Todas as outras especialidades** → ClickLife

---

## Definição de Horário Comercial

- **Dias:** Segunda a Sexta-feira
- **Horário:** 07:00 às 19:00 (hora de Brasília, UTC-3)
- **Fora do comercial:** 19:00-07:00 + fins de semana

⚠️ **Importante:** A Edge Function converte o horário ISO para UTC e depois para hora de Brasília antes de validar.

---

## Contato e Suporte

Para reportar bugs ou solicitar melhorias nos testes:
- Acesse o repositório do projeto
- Abra uma issue detalhando o problema
- Inclua screenshots do resultado do teste
- Anexe os logs da Edge Function quando relevante

---

## Checklist de Testes (Aprovação QA)

Antes de considerar o sistema validado, executar e aprovar:

- [ ] **A1** - Admin Override ativado
- [ ] **B1** - Plano ativo + Clínico (863)
- [ ] **B2** - Plano ativo + Especialista (864)
- [ ] **C1** - Sem plano + Clínico + Comercial → Communicare
- [ ] **C2** - Sem plano + Psicólogo + Comercial → Communicare
- [ ] **C3** - Sem plano + Especialista + Comercial → ClickLife
- [ ] **D1** - Sem plano + Noturno → ClickLife
- [ ] **D2** - Sem plano + Sábado → ClickLife
- [ ] **D3** - Sem plano + Domingo → ClickLife
- [ ] Verificar logs da Edge Function para todos os testes
- [ ] Desativar Admin Override após testes

---

**Última atualização:** 2025-10-20
