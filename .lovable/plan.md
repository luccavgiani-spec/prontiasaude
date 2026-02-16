

# Correcao: Popup de link da consulta nao aparece no mobile

## Causa raiz

Na funcao `handleQuickConsult` (linha 664-671), apos receber a URL com sucesso:

```
1. setGeneratedConsultUrl(data.url)  // OK - salva URL
2. setQuickConsultLoading(false)      // OK
3. await navigator.clipboard.writeText(data.url)  // FALHA no mobile!
4. toast.success(...)                 // Nunca executa
```

O `navigator.clipboard.writeText` **lanca excecao** em navegadores mobile dentro de iframes (falta de secure context ou permissao). Essa excecao cai no `catch` (linha 711), que executa `setQuickConsultUser(null)` — **fechando o modal** antes do usuario ver o link.

## Solucao

Envolver o `navigator.clipboard.writeText` em um try/catch separado dentro do bloco de sucesso, para que a falha do clipboard nao feche o modal.

## Alteracao

### `src/components/admin/UserRegistrationsTab.tsx` (linhas 669-671)

```typescript
// ANTES:
await navigator.clipboard.writeText(data.url);
toast.success(`Consulta criada na ${quickConsultProvider === 'clicklife' ? 'ClickLife' : 'Communicare'}! Link copiado.`);

// DEPOIS:
try {
  await navigator.clipboard.writeText(data.url);
  toast.success(`Consulta criada na ${quickConsultProvider === 'clicklife' ? 'ClickLife' : 'Communicare'}! Link copiado.`);
} catch (clipErr) {
  console.warn('[QuickConsult] Clipboard nao disponivel:', clipErr);
  toast.success(`Consulta criada na ${quickConsultProvider === 'clicklife' ? 'ClickLife' : 'Communicare'}! Copie o link abaixo.`);
}
```

Isso garante que:
- O modal permanece aberto mostrando o link gerado
- O usuario pode copiar manualmente pelo botao de copiar no modal
- No desktop, o link continua sendo copiado automaticamente

| Arquivo | Linhas | O que muda |
|---------|--------|------------|
| `UserRegistrationsTab.tsx` | 669-671 | Envolver clipboard em try/catch isolado |
