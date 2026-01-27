
# Correção: RLS Bloqueando Leitura no Cliente de Produção

## Problema Identificado

O código do `SalesTab.tsx` está correto e a query realmente vai para a **Produção** (`ploqujuhpwutpcibedbr`). Porém, o resultado é `[]` (vazio) porque:

1. O cliente `supabaseProduction` foi criado com `persistSession: false` (sem autenticação)
2. A tabela `pending_payments` tem RLS habilitado
3. A política "Admins can manage payments" usa `is_admin()` que verifica `auth.uid()`
4. Como não há sessão autenticada no cliente de Produção, `auth.uid()` retorna `null`
5. Resultado: todas as linhas são bloqueadas pelo RLS

## Solução Proposta

Modificar o cliente `supabaseProduction` para propagar a sessão de autenticação do admin logado.

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/lib/supabase-production.ts` | Adicionar função para copiar sessão do Cloud para Produção |
| `src/components/admin/SalesTab.tsx` | Usar a sessão propagada antes de fazer queries |
| `src/components/admin/ClickLifeOverrideCard.tsx` | Mesma correção |
| `src/components/admin/CommunicareOverrideCard.tsx` | Mesma correção |
| `src/components/admin/ReportsTab.tsx` | Migrar para usar `supabaseProduction` |

## Detalhes Técnicos

### Opção 1: Propagar Token JWT (Recomendada)

Quando o admin faz login no Cloud, ele recebe um token JWT. Esse token pode ser usado para autenticar no cliente de Produção.

```text
src/lib/supabase-production.ts
```

Adicionar função:
```
async function getProductionClientWithAuth() {
  // Pegar sessão do Cloud
  const { data: { session } } = await supabase.auth.getSession();
  
  if (session?.access_token) {
    // Setar sessão no cliente de Produção
    await supabaseProduction.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token
    });
  }
  
  return supabaseProduction;
}
```

### Opção 2: Adicionar Política RLS para Anon (Não recomendada - menos segura)

Adicionar política que permite leitura baseada em outro critério.

### Por que Opção 1 é melhor:

- Mantém a segurança do RLS intacta
- Usa a mesma autenticação do admin
- Não expõe dados para usuários anônimos
- Funciona com o token JWT existente que o admin já possui

## Fluxo Corrigido

```text
1. Admin faz login no Cloud (Lovable)
2. Recebe token JWT válido
3. Admin acessa aba "Vendas"
4. SalesTab chama getProductionClientWithAuth()
5. Função pega token do Cloud e seta no cliente Produção
6. Query vai para Produção COM autenticação
7. RLS verifica is_admin() → TRUE
8. Dados retornam → Vendas aparecem!
```

## Impacto

- Vendas aparecerão na aba de Vendas
- Overrides funcionarão corretamente
- Relatórios mostrarão dados reais
- Segurança mantida (apenas admins logados veem dados)

## Resumo das Mudanças

- **1 arquivo modificado significativamente**: `supabase-production.ts` (adicionar função de propagação)
- **4 arquivos com ajuste mínimo**: Chamar nova função antes de queries
- **0 alterações de RLS**: Políticas existentes continuam funcionando
- **0 alterações em Edge Functions**: Já funcionam corretamente
