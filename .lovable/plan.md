

## Plano: Remover 7 especialidades do frontend

Especialidades a remover: **Personal Trainer, Nutrição, Reumatologia, Neurologia, Infectologia, Nutrologia, Urologia**

### Arquivos que serão modificados

**1. `src/lib/constants.ts`** (linhas 31, 34-39, 42-49)
- Remover da `descricao` do serviço "Médicos Especialistas"
- Remover do array `inclui`
- Remover das `variantes` (7 itens: Personal Trainer, Nutrição, Reumatologia, Neurologia, Infectologia, Nutrologia, Urologia)
- O `precoBase` passará a ser o menor valor restante (Cardiologia = 89.90), e o SKU base do serviço precisa ser ajustado para não apontar para Personal Trainer (BIR7668)

**2. `src/lib/specialties-config.ts`** (linhas 8-9, 16, 21-25)
- Remover: `'Personal Trainer'`, `'Nutrição'`, `'Nutrologia'`, `'Reumatologia'`, `'Neurologia'`, `'Infectologia'`, `'Urologia'`

**3. `src/lib/sku-mapping.ts`** (linhas 14-15, 27-31)
- Remover mapeamentos SKU: BIR7668 (Personal Trainer), VPN5132 (Nutricionista), LZF3879 (Nutrólogo), UDH3250 (Reumatologista), PKS9388 (Neurologista), MYX5186 (Infectologista)
- Nota: Urologia não tem SKU neste arquivo (usa URO1099 só nas variantes)

### O que NÃO será alterado
- Nenhum arquivo de backend/edge functions
- Nenhum componente de UI (ServicoCard, ServicosSection, etc.) — eles renderizam dinamicamente a partir de `constants.ts`
- Página MedicosEspecialistas.tsx — o seletor é gerado dinamicamente das variantes

