

# Adicionar Seletor de Plano ClickLife na Ativacao Manual

## Situacao Atual

Quando voce clica em "Ativar Paciente em Plataforma" e escolhe ClickLife, o sistema envia o payload SEM `plan_id`. A Edge Function `activate-clicklife-manual` recebe isso e usa `plan_id || 864` como fallback. Ou seja, **todos os pacientes sao ativados no plano 864 (Com Especialista)**.

## O Que Sera Feito

Adicionar um seletor de plano ClickLife no modal de ativacao, visivel apenas quando a plataforma selecionada for "ClickLife". O admin podera escolher entre os 4 codigos de plano antes de confirmar.

## Alteracao

**Arquivo unico:** `src/components/admin/UserRegistrationsTab.tsx`

### 1. Novo estado para o plano selecionado

```typescript
const [selectedClickLifePlanId, setSelectedClickLifePlanId] = useState<number>(864);
```

### 2. Seletor de plano no modal (aparece apenas quando ClickLife esta selecionado)

Sera adicionado entre a selecao de plataforma e os botoes de acao:

```
Codigo do Plano ClickLife:
  [863] Sem Especialista (Pronto Atendimento)
  [864] Com Especialista (padrao)              <-- pre-selecionado
  [1237] Familiar Sem Especialista
  [1238] Familiar Com Especialista
```

### 3. Incluir `plan_id` no payload

```typescript
const payload = {
  email: ...,
  cpf: ...,
  nome: ...,
  telefone: ...,
  sexo: ...,
  birth_date: ...,
  skip_db_lookup: true,
  plan_id: selectedPlatform === 'clicklife' ? selectedClickLifePlanId : undefined
};
```

### 4. Toast de sucesso com o plano usado

```typescript
toast.success(`${patientName} ativado na ClickLife! (plano_id: ${selectedClickLifePlanId})`);
```

## Resultado

- Ao selecionar ClickLife, aparece um dropdown com os 4 planos
- Ao selecionar Communicare, o dropdown fica oculto
- O `plan_id` escolhido e enviado no payload
- A Edge Function ja aceita `plan_id` no body (nenhuma alteracao backend necessaria)
- Padrao continua sendo 864

## Escopo

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/admin/UserRegistrationsTab.tsx` | Adicionar estado, seletor e enviar plan_id no payload |

Nenhum outro arquivo sera alterado.
