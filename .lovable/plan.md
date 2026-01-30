

# Correção: Erro "Unknown error" para Kelly Solamita

## 🔍 Diagnóstico

| Dado | Valor |
|------|-------|
| Email | kellysolamita33@gmail.com |
| Origem | Ambos (Cloud + Produção) |
| Login Environment | Cloud |
| User ID Cloud | e97b5b60-df67-4f29-96cf-48ea520fe508 |
| User ID Produção | 7cae5103-9721-487c-b633-fd1bd51dffd5 |
| Dados completos | Sim (profile_complete: true) |
| Pagamentos gerados | Nenhum (erro ocorre antes da chamada ao backend) |

## Causa Raiz

O componente `PlanosSection.tsx` usa `supabase.auth.getUser()` diretamente (linha 42-47), que pode retornar dados inconsistentes quando o usuário está logado no ambiente Cloud mas o código espera dados da Produção.

O mesmo problema existe em outros componentes que não utilizam `getHybridSession()`:
- `src/components/home/PlanosSection.tsx` (linhas 42-53, 296-312)

## Correção

Atualizar `PlanosSection.tsx` para usar `getHybridSession()` e o cliente correto (Cloud ou Produção) baseado no ambiente detectado.

### Arquivo: `src/components/home/PlanosSection.tsx`

**Mudança 1**: Adicionar import do `getHybridSession` e `supabaseProduction`

**Mudança 2**: Atualizar função `checkActivePlan` (linhas 40-53)
- Substituir `supabase.auth.getUser()` por `getHybridSession()`

**Mudança 3**: Atualizar handler de bypass de plano (linhas 296-312)
- Usar cliente correto baseado no ambiente da sessão

## Detalhes Técnicos

```text
ANTES (linha 42-47):
┌──────────────────────────────────────────┐
│ const { data: { user } } =               │
│   await supabase.auth.getUser();         │
│                                          │
│ // Usa apenas Cloud, ignora Produção     │
└──────────────────────────────────────────┘

DEPOIS:
┌──────────────────────────────────────────┐
│ const { session, environment } =          │
│   await getHybridSession();              │
│ const user = session?.user;              │
│ const client = environment === 'production' │
│   ? supabaseProduction : supabase;       │
└──────────────────────────────────────────┘
```

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `src/components/home/PlanosSection.tsx` | Usar `getHybridSession()` e cliente híbrido |

## Resultado Esperado

Após a correção, a Kelly (e qualquer usuário logado em qualquer ambiente) poderá:
1. Visualizar corretamente se tem plano ativo
2. Iniciar compras de consultas e planos sem erro
3. Ter seus dados carregados do ambiente correto (Cloud ou Produção)

