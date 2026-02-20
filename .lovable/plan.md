

# Correcao: Filtro de Pacientes Nao Funciona

## Problema Identificado

Ao digitar no campo de busca (nome, email ou CPF), o sistema **recarrega TODOS os usuarios do zero** a cada tecla (com debounce de 300ms). Isso causa:

1. **N+1 queries**: Para cada usuario retornado, o sistema faz uma chamada individual `getPatientPlanByEmail()`. Com centenas de usuarios, isso leva muitos segundos.
2. **Race condition**: Existem dois `useEffect` que chamam `loadPatients()` -- um para `[search, statusFilter]` e outro para `[page]`. Quando o search muda, ele faz `setPage(1)` que dispara o segundo useEffect, causando duas chamadas simultaneas.
3. **Resultado**: Enquanto carrega, a tabela mostra "carregando". Quando termina, o usuario ja pode ter mudado o campo de busca, disparando outro carregamento. A sensacao e de que a busca "nao funciona".

## Solucao

Separar **busca de dados** (fetch) de **filtragem** (search/filter). Os dados sao carregados UMA vez e ficam em cache. A filtragem e feita instantaneamente no cache local.

## Alteracoes

**Arquivo:** `src/components/admin/UserRegistrationsTab.tsx`

### 1. Adicionar estado para cache dos dados

```typescript
const [allUsersCache, setAllUsersCache] = useState<User[]>([]);
```

### 2. Separar `loadPatients` em duas funcoes

- `fetchAllUsers()`: Busca todos os usuarios da Edge Function (chamada apenas 1x no mount e ao clicar "Atualizar")
- `applyFilters()`: Filtra o cache local por search/statusFilter/page (chamada instantaneamente a cada tecla)

### 3. Reescrever os useEffects

```typescript
// Carregar dados apenas 1x no mount
useEffect(() => {
  fetchAllUsers();
}, []);

// Filtrar localmente quando search, filtro ou pagina mudam
useEffect(() => {
  applyFilters();
}, [search, statusFilter, page, allUsersCache]);
```

### 4. A funcao `applyFilters` filtra instantaneamente

Mesma logica de filtro que ja existe (linhas 358-406), mas operando sobre `allUsersCache` em vez de re-buscar da API.

## Resultado Esperado

- Digitar no campo de busca filtra **instantaneamente** (sem loading)
- A busca por nome, email e CPF funciona sem delay
- Atualizar a pagina recarrega os dados do servidor
- Botao "Atualizar" permite forcar recarga manual

## Escopo

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/admin/UserRegistrationsTab.tsx` | Separar fetch de filtragem, adicionar cache local |

Nenhum outro arquivo sera alterado.

