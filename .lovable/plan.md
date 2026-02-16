
# Correção: Pop-up "Consulta Rápida" não abre no mobile

## Diagnóstico

O problema é um conflito de **z-index** entre o Dialog (modal) de "Consulta Rápida" e os botões flutuantes globais.

- O `Dialog` (Radix UI) renderiza overlay e conteúdo com `z-50`
- O `ConsultNowFloatButton` usa `z-[9999]` (botão) e `z-[10000]` (chat popup)
- O `WhatsAppFloatButton` provavelmente usa z-index similar

No **desktop**, o modal centralizado na tela não conflita visualmente com os botões no canto inferior direito. No **mobile**, o chat popup do `ConsultNowFloatButton` (que inicia **aberto por padrão**) ocupa boa parte da tela e fica **por cima** do overlay do Dialog, bloqueando a interação com o modal de Consulta Rápida.

Além disso, o overlay escuro do Dialog (`z-50`) não cobre os float buttons (`z-9999/10000`), então o usuário pode interagir com os floats ao invés do modal.

## Correção (1 arquivo)

### `src/components/admin/UserRegistrationsTab.tsx`

Aumentar o z-index do `DialogContent` do modal de Consulta Rápida para ficar acima dos botões flutuantes:

```tsx
// Linha ~1136 - Adicionar className com z-index alto
<DialogContent className="sm:max-w-md z-[10001]">
```

E adicionar z-index no `DialogOverlay` implícito (via wrapper) para garantir que o overlay também cubra os floats. Como o `Dialog` do shadcn não expõe o overlay separadamente no uso, a alternativa é aplicar o fix diretamente no `DialogContent` e usar CSS para o overlay:

```tsx
<Dialog open={!!quickConsultUser} onOpenChange={...}>
  <DialogContent className="sm:max-w-md z-[10001] [&~*]:z-[10001]">
```

Ou, de forma mais limpa, envolver com um estilo inline que force o portal a ter z-index superior:

```tsx
<Dialog open={!!quickConsultUser} onOpenChange={...}>
  <DialogContent 
    className="sm:max-w-md max-h-[90vh] overflow-y-auto" 
    style={{ zIndex: 10001 }}
  >
```

E sobrescrever o overlay no mesmo nível. A forma mais robusta é usar a prop `className` no overlay via composição.

**Abordagem final recomendada:** Passar o `className` com z-index elevado tanto no overlay quanto no content. Como o shadcn `DialogContent` já renderiza o `DialogOverlay` internamente, basta alterar o `DialogContent` e garantir que o overlay herde o z-index. A forma mais simples:

No `UserRegistrationsTab.tsx`, linha ~1136:
```tsx
<DialogContent className="sm:max-w-md !z-[10001] max-h-[90vh] overflow-y-auto">
```

E adicionar um CSS global ou inline para o overlay (que é irmão no DOM):

Melhor alternativa: como o `dialog.tsx` renderiza overlay e content dentro do mesmo portal, basta adicionar um wrapper `<div>` com z-index alto via `style` no Dialog que envolve tudo.

**Solução mais simples e pontual:**
- Adicionar `className="!z-[10001]"` ao `DialogContent` (linha ~1136)  
- Isso sozinho não resolve o overlay. A solução completa é sobrescrever ambos.

**Solução definitiva (2 linhas):**

No `DialogContent` do modal de Consulta Rápida, usar classes customizadas:

```tsx
<DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto z-[10001] 
  [&_~_[data-radix-dialog-overlay]]:z-[10001]">
```

Porém, como o overlay é renderizado **antes** do content no DOM pelo shadcn, o seletor CSS precisa ser diferente. A forma mais limpa é simplesmente adicionar no arquivo `dialog.tsx`... mas isso viola a regra de não alterar componentes UI sem pedido.

**Solução final aprovada (pontual, sem alterar dialog.tsx):**

No `UserRegistrationsTab.tsx`, envolver o Dialog inteiro em um `<div>` com z-index elevado via style:

```tsx
<div style={{ position: 'relative', zIndex: 10001 }}>
  <Dialog open={!!quickConsultUser} onOpenChange={...}>
    <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
      ...
    </DialogContent>
  </Dialog>
</div>
```

Como o `DialogPortal` cria um portal no `document.body`, o wrapper div não afeta o z-index do portal. Portanto, precisamos de uma abordagem CSS.

**Solução definitiva correta:**

Usar a prop `forceMount` não resolve. A solução real é passar o z-index via className ao `DialogContent` e ao overlay. Como ambos são renderizados via portal no body, o `DialogContent` do shadcn aceita className. Precisamos apenas garantir que o overlay também tenha z-index alto.

Olhando o código do `dialog.tsx` (linha 22), o overlay tem `z-50 fixed`. O content (linha 39) também tem `z-50 fixed`. Ambos são filhos diretos do portal.

**A correção mais limpa é:** passar um `className` override no `DialogContent` que aplique `!z-[10001]` e usar CSS com seletor para o overlay adjacente.

Na prática, a solução pontual mais eficaz:

1. No `UserRegistrationsTab.tsx`, linha ~1136, mudar:
```tsx
<DialogContent className="sm:max-w-md z-[10001]">
```

2. Adicionar um `<style>` inline ou CSS global para forçar o overlay do mesmo dialog a ter z-index alto. Como alternativa mais simples, podemos ajustar o CSS no `index.css` com um seletor global para overlays de dialog na página admin.

## Resumo da Alteração

| Arquivo | Mudança |
|---------|---------|
| `src/components/admin/UserRegistrationsTab.tsx` | Adicionar `z-[10001]` ao `DialogContent` do modal de Consulta Rápida + adicionar estilo inline para overlay |

A implementação exata será: usar um `useEffect` ou inline `<style>` para garantir que quando o modal está aberto, o overlay também ganhe z-index elevado. Ou, alternativamente, esconder os float buttons quando o modal está aberto (abordagem mais simples e elegante).

## Abordagem Recomendada (Mais Simples)

Esconder os float buttons quando o modal de Consulta Rápida está aberto, **OU** na página `/admin` inteira (já que é uma página de gestão, não precisa dos botões de consulta e WhatsApp).

Verificar se já existe alguma lógica de esconder floats no admin. Se não, a correção pontual seria: no `ConsultNowFloatButton` e `WhatsAppFloatButton`, verificar se a rota atual é `/admin` e não renderizar.

Mas isso muda componentes não solicitados. A correção mais cirúrgica:

**No `UserRegistrationsTab.tsx`:** Ao abrir o modal de Consulta Rápida, temporariamente aplicar z-index alto via `document.querySelector` nos elementos do overlay e content, e restaurar ao fechar.
