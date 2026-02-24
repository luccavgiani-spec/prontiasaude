

# Diagnostico: Redirecionamento Erroneo de Psicologo para Communicare

## O Problema

Voce quer que **todos** os usuarios que compram consulta de Psicologo sejam redirecionados para o WhatsApp com a mensagem "Ola! Comprei uma consulta de psicologo e gostaria de agendar!". Porem, o codigo atual tem **dois pontos** que redirecionam psicologos SEM plano ativo para a Communicare (agendar.cc):

---

## Ponto 1: `schedule-redirect/index.ts` (linhas 879-902)

```typescript
// ✅ EXCEÇÃO: Psicólogos SEM plano ativo → Agenda Online da Psicóloga
const isPsicologoSemPlano = PSICOLOGO_SKUS.includes(payload.sku) && !payload.plano_ativo;

if (isPsicologoSemPlano) {
  const agendaUrl = "https://prontiasaude.agendar.cc/#/perfil/264663";  // ← AQUI
  await saveAppointment(payload, "Communicare", agendaUrl, supabase);
  return ... provider: "Communicare" ...
}
```

Este bloco intercepta ANTES da logica de especialistas/psicologos com plano (linhas 904-941) que ja redireciona para WhatsApp corretamente. Como psicologos sem plano caem aqui primeiro, nunca chegam ao WhatsApp.

## Ponto 2: `mp-webhook/index.ts` (linhas 1207-1272)

```typescript
// ✅ EXCEÇÃO 1: PSICÓLOGOS SEM plano → Agendar.cc
if (isPsicologo && semPlanoAtivo && !fromClicklife) {
  const agendarUrl = 'https://prontiasaude.agendar.cc/';  // ← AQUI
  ...
}
```

O webhook do Mercado Pago tambem tem a mesma logica errada — quando o pagamento e aprovado, redireciona psicologos sem plano para agendar.cc.

---

## Resumo: O que aconteceu no seu teste

1. Voce comprou uma consulta de Psicologo (sem plano ativo)
2. O pagamento foi aprovado pelo Mercado Pago
3. O `mp-webhook` processou o pagamento e criou o appointment com `redirect_url = agendar.cc`
4. O `check-payment-status` (polling do frontend) encontrou esse appointment e te redirecionou para agendar.cc
5. Alternativamente, o `schedule-redirect` tambem teria feito o mesmo redirecionamento

---

## Correcao Necessaria

### Arquivo 1: `supabase/functions/schedule-redirect/index.ts`

Alterar linhas 879-902: trocar o redirecionamento de `agendar.cc` para o WhatsApp:

```typescript
if (isPsicologoSemPlano) {
  const mensagem = "Olá! Comprei uma consulta de psicólogo e gostaria de agendar!";
  const whatsappUrl = `https://wa.me/5511933359187?text=${encodeURIComponent(mensagem)}`;
  await saveAppointment(payload, "whatsapp_psicologo", whatsappUrl, supabase);
  return ... provider: "whatsapp_psicologo" ...
}
```

### Arquivo 2: `supabase/functions/mp-webhook/index.ts`

Alterar linhas 1207-1272: trocar o redirecionamento de `agendar.cc` para o WhatsApp:

```typescript
if (isPsicologo && semPlanoAtivo && !fromClicklife) {
  const mensagem = "Olá! Comprei uma consulta de psicólogo e gostaria de agendar!";
  const whatsappUrl = `https://wa.me/5511933359187?text=${encodeURIComponent(mensagem)}`;
  // ... salvar appointment com provider "whatsapp_psicologo" e redirect_url = whatsappUrl
}
```

### Escopo

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/schedule-redirect/index.ts` | Linhas 879-902: trocar agendar.cc por WhatsApp |
| `supabase/functions/mp-webhook/index.ts` | Linhas 1207-1272: trocar agendar.cc por WhatsApp |

Nenhum outro arquivo sera alterado.

