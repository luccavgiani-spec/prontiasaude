

# Correcao: Frontend mostra dados antigos do Cloud em vez dos dados atualizados da Producao

## Diagnostico confirmado

Existem **dois registros** do paciente Tulio:

1. **Cloud DB** (Lovable Cloud): `user_id = 19d8998f`, CPF `06852872890`, complement `null` -- DADOS ANTIGOS
2. **Producao DB** (`ploqujuhpwutpcibedbr`): dados atualizados com CPF e complemento corretos

### Por que o frontend mostra dados antigos

No `AreaDoPaciente.tsx`, linha 56-64:

```text
1. Usuario loga via Cloud -> environment = 'cloud'
2. dbClient = supabase (Cloud)
3. Query: patients WHERE user_id = '19d8998f' -> ENCONTRA o registro antigo do Cloud
4. Como encontrou, NUNCA chega ao fallback de Producao (linhas 80-104)
5. setPatient(dados_antigos_do_cloud)
```

Todas as edicoes de perfil vao para a Producao via Edge Function, mas a leitura dos dados vem do Cloud. Os dados nunca se sincronizam.

## Solucao

Alterar a logica de busca no `AreaDoPaciente.tsx` para **sempre priorizar os dados da Producao**, ja que e la onde todas as edicoes sao salvas.

### Arquivo: `src/pages/AreaDoPaciente.tsx` (linhas 55-112)

Substituir a logica atual por:

```typescript
// SEMPRE buscar na Producao primeiro (onde os dados sao editados)
let patientFound = null;

// 1. Tentar por user_id na Producao
const { data: prodData } = await supabaseProductionAuth
  .from('patients')
  .select('*')
  .eq('user_id', session.user.id)
  .maybeSingle();

patientFound = prodData;

// 2. Se nao encontrou por user_id, tentar por email na Producao
if (!patientFound && session.user.email) {
  const { data: byEmail } = await supabaseProductionAuth
    .from('patients')
    .select('*')
    .eq('email', session.user.email.toLowerCase())
    .maybeSingle();
  patientFound = byEmail;
}

// 3. Ultimo fallback: tentar no Cloud
if (!patientFound) {
  const { data: cloudData } = await supabase
    .from('patients')
    .select('*')
    .eq('user_id', session.user.id)
    .maybeSingle();
  patientFound = cloudData;
}
```

### Nenhum outro arquivo sera alterado

- Nao altera Edge Functions
- Nao altera `CompletarPerfil.tsx`
- Nao altera `auth-hybrid.ts`
- Nao altera nenhuma tabela ou coluna

### Por que isso resolve

| Antes | Depois |
|-------|--------|
| Busca no Cloud primeiro, encontra dados antigos, para | Busca na Producao primeiro, encontra dados atualizados |
| Edicoes vao para Producao mas leitura vem do Cloud | Leitura e escrita ambas na Producao |
| Dados sempre desatualizados | Dados sempre frescos |

