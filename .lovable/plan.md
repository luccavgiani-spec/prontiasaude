
# ✅ CONCLUÍDO: Correção ClickLife Admin Console - Erro 401 "Usuário não encontrado"

## Status: IMPLEMENTADO

A correção foi aplicada em `supabase/functions/schedule-redirect/index.ts`.

### Alteração Realizada

**Novo fluxo com fallback automático:**

```text
Admin → Criar Consulta ClickLife
    ↓
skip_registration: true
    ↓
Tenta criar atendimento PRIMEIRO
    ↓
Se 401 "Usuário não encontrado":
    ↓
    ✅ CADASTRA paciente automaticamente
    ↓
    ✅ RETRY: Cria atendimento novamente
    ↓
Retorna sucesso ou erro
```

### Funções Auxiliares Criadas

1. `tryCreateClickLifeAttendance()` - Tenta criar atendimento, retorna status e dados
2. `doRegisterPatient()` - Cadastra e ativa paciente na ClickLife

### Lógica Implementada

- **skip_registration=true**: Tenta atendimento → Se 401, cadastra → Retry
- **skip_registration=false**: Cadastra → Cria atendimento (comportamento original)

---

## ⚠️ AÇÃO NECESSÁRIA

**Você precisa copiar/colar a função atualizada no Supabase de Produção:**

1. Abra o arquivo `supabase/functions/schedule-redirect/index.ts`
2. Copie TODO o conteúdo
3. Cole no Dashboard do Supabase (Produção) → Edge Functions → schedule-redirect

**Após o deploy, teste gerando uma consulta ClickLife para o CPF 001.822.997-24.**


