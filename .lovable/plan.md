
# Plano de Correção: Redirecionamento Incorreto + Renomeação de Especialidades

## Problema 1: Redirecionamento Incorreto para Área do Paciente

### Diagnóstico
O bug ocorre porque o componente `MedicosEspecialistas.tsx` usa **apenas o cliente Cloud** (`supabase`) para verificar a sessão do usuário:

```typescript
// Linha 93 - PROBLEMA: Usa apenas cliente Cloud
const { data: { user } } = await supabase.auth.getUser();
```

Usuários autenticados na **Produção** (a maioria dos usuários reais) não são encontrados pelo cliente Cloud, fazendo com que `user` seja `null` e o fluxo caia na condição de "não logado" (linha 95-106), redirecionando erroneamente para `/area-do-paciente`.

O mesmo problema existe no componente `ServicoCard.tsx` (linhas 81, 96, 142, 160, 185, 235, 253, 277).

### Solução
Implementar a mesma estratégia híbrida usada em `HeroSection.tsx` e `ConsultNowFloatButton.tsx`:

1. Usar `getHybridSession()` para detectar o ambiente correto (Cloud ou Produção)
2. Usar o cliente de banco de dados correto baseado no ambiente detectado

### Arquivos a Modificar
1. **`src/pages/servicos/MedicosEspecialistas.tsx`**
   - Importar `getHybridSession` e `supabaseProductionAuth`
   - Substituir `supabase.auth.getUser()` por `getHybridSession()`
   - Usar cliente correto para queries de paciente

2. **`src/components/home/ServicoCard.tsx`**
   - Mesmo padrão: usar sessão híbrida em todas as verificações de auth

---

## Problema 2: Renomeação de Especialidades

### Requisito
Trocar nomes de profissionais para áreas da medicina:
- "Neurologista" → "Neurologia"
- "Urologista" → "Urologia"
- "Cardiologista" → "Cardiologia"
- "Dermatologista" → "Dermatologia"
- "Endocrinologista" → "Endocrinologia"
- "Gastroenterologista" → "Gastroenterologia"
- "Ginecologista" → "Ginecologia"
- "Oftalmologista" → "Oftalmologia"
- "Ortopedista" → "Ortopedia"
- "Otorrinolaringologista" → "Otorrinolaringologia"
- "Reumatologista" → "Reumatologia"
- "Infectologista" → "Infectologia"
- "Psiquiatra" → "Psiquiatria"
- "Nutrólogo" → "Nutrologia"
- "Geriatria" → já está correto
- "Personal Trainer" → manter (não é especialidade médica)
- "Nutricionista" → "Nutrição"
- "Pediatra" → "Pediatria"
- "Médico da Família" → "Medicina da Família"

### Arquivos a Modificar
1. **`src/lib/constants.ts`** - Fonte principal (variantes de `medicos_especialistas` e lista `inclui`)
2. **`src/lib/specialties-config.ts`** - Lista `ALL_SPECIALTIES` usada para roteamento

---

## Detalhamento Técnico

### Correção do MedicosEspecialistas.tsx

**Antes (bugado):**
```typescript
const { data: { user } } = await supabase.auth.getUser();

if (!user) {
  // Redireciona para login - BUG: usuários Produção caem aqui
}

const { data: patient } = await supabase
  .from('patients')
  .select('profile_complete')
  .eq('user_id', user.id)
  .maybeSingle();
```

**Depois (corrigido):**
```typescript
import { getHybridSession, supabaseProductionAuth } from '@/lib/auth-hybrid';
import { supabaseProduction } from '@/lib/supabase-production';

// Na função handleAgendar:
const { session, environment } = await getHybridSession();
const user = session?.user;

if (!user) {
  // Agora só cai aqui se realmente não estiver logado em nenhum ambiente
}

// Usar cliente correto baseado no ambiente
const client = environment === 'production' ? supabaseProduction : supabase;

const { data: patient } = await client
  .from('patients')
  .select('profile_complete')
  .eq('user_id', user.id)
  .maybeSingle();
```

### Correção do ServicoCard.tsx

Mesma lógica: substituir todas as chamadas `supabase.auth.getUser()` por `getHybridSession()` e usar o cliente correto para queries.

### Renomeação em constants.ts

```typescript
variantes: [
  { valor: 54.99, nome: "Personal Trainer", sku: "BIR7668" },
  { valor: 59.90, nome: "Nutrição", sku: "VPN5132" },           // Era "Nutricionista"
  { valor: 129.90, nome: "Reumatologia", sku: "UDH3250" },      // Era "Reumatologista"
  { valor: 129.90, nome: "Neurologia", sku: "PKS9388" },        // Era "Neurologista"
  { valor: 129.90, nome: "Infectologia", sku: "MYX5186" },      // Era "Infectologista"
  { valor: 119.90, nome: "Nutrologia", sku: "LZF3879" },        // Era "Nutrólogo"
  { valor: 119.90, nome: "Geriatria", sku: "YZD9932" },         // Já estava correto
  { valor: 109.90, nome: "Urologia", sku: "URO1099" },          // Era "Urologista"
  { valor: 89.90, nome: "Cardiologia", sku: "TQP5720" },        // Era "Cardiologista"
  { valor: 89.90, nome: "Dermatologia", sku: "HGG3503" },       // Era "Dermatologista"
  { valor: 89.90, nome: "Endocrinologia", sku: "VHH8883" },     // Era "Endocrinologista"
  { valor: 89.90, nome: "Gastroenterologia", sku: "TSB0751" },  // Era "Gastroenterologista"
  { valor: 89.90, nome: "Ginecologia", sku: "CCP1566" },        // Era "Ginecologista"
  { valor: 89.90, nome: "Oftalmologia", sku: "FKS5964" },       // Era "Oftalmologista"
  { valor: 89.90, nome: "Ortopedia", sku: "TVQ5046" },          // Era "Ortopedista"
  { valor: 89.90, nome: "Pediatria", sku: "HMG9544" },          // Era "Pediatra"
  { valor: 89.90, nome: "Otorrinolaringologia", sku: "HME8366" },// Era "Otorrinolaringologista"
  { valor: 89.90, nome: "Medicina da Família", sku: "DYY8522" },// Era "Médico da Família"
  { valor: 89.90, nome: "Psiquiatria", sku: "QOP1101" }         // Era "Psiquiatra"
]
```

---

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/servicos/MedicosEspecialistas.tsx` | Usar `getHybridSession()` + cliente correto |
| `src/components/home/ServicoCard.tsx` | Usar `getHybridSession()` + cliente correto |
| `src/lib/constants.ts` | Renomear especialidades nas `variantes` e `inclui` |
| `src/lib/specialties-config.ts` | Renomear especialidades em `ALL_SPECIALTIES` |

---

## Impacto

- **Bug de redirecionamento**: Usuários logados na Produção agora serão corretamente identificados e poderão prosseguir para o checkout
- **Nomenclatura**: O dropdown de especialidades e todos os textos relacionados exibirão os nomes das áreas médicas ao invés dos profissionais
