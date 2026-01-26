

# Plano: Botão Copiar Código PIX logo abaixo do QR Code

## Objetivo
Adicionar um botão compacto de "Copiar Código PIX" diretamente abaixo do QR Code, dentro do mesmo container branco, sem aumentar o tamanho do modal e mantendo o design atual simplificado.

## Alteração

**Arquivo**: `src/components/payment/PixPaymentForm.tsx`

### Layout Atual (linhas 142-159)
```
┌─────────────────────────────────┐
│        [Ícone QrCode]           │
│       Pague com PIX             │
│  Escaneie o QR Code ou copie... │
│  ┌───────────────────────────┐  │
│  │       [QR CODE]           │  │
│  │                           │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
         ↓ (scroll)
┌─────────────────────────────────┐
│ Código PIX Copia e Cola         │
│ ┌─────────────────────────────┐ │
│ │ 00020126580014br...         │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘

[ Copiar Código PIX ] ← Botão separado
```

### Layout Proposto
```
┌─────────────────────────────────┐
│        [Ícone QrCode]           │
│       Pague com PIX             │
│  Escaneie o QR Code ou copie... │
│  ┌───────────────────────────┐  │
│  │       [QR CODE]           │  │
│  │                           │  │
│  └───────────────────────────┘  │
│                                 │
│  [ Copy ] Copiar Código PIX     │  ← Botão DENTRO do container
└─────────────────────────────────┘
```

## Mudanças no Código

### 1. Mover o botão para DENTRO do container do QR Code

Adicionar o botão imediatamente após a `<img>` do QR Code, ainda dentro do `<div className="flex flex-col items-center...">`.

**Código a inserir** (após linha 158, antes do fechamento do container):

```tsx
{/* Botão Copiar - Compacto, logo abaixo do QR Code */}
<Button
  type="button"
  onClick={handleCopyCode}
  variant="outline"
  className="mt-4 px-6"
  size="sm"
>
  {copied ? (
    <>
      <Check className="mr-2 h-4 w-4 text-green-600" />
      Copiado!
    </>
  ) : (
    <>
      <Copy className="mr-2 h-4 w-4" />
      Copiar Código PIX
    </>
  )}
</Button>
```

### 2. Remover seção redundante

Remover ou ocultar:
- **Linhas 161-169**: A seção "Código PIX Copia e Cola" com a caixa de texto mostrando o código longo
- **Linhas 171-190**: O botão "Copiar Código PIX" que agora foi movido para dentro do container

Isso simplifica ainda mais a interface, já que o código PIX completo não precisa ser exibido em texto (geralmente é muito longo e não traz valor visual).

## Resultado Visual Esperado

```
┌───────────────────────────────────────┐
│  ⚠️ NÃO FECHE ESTA ABA!               │
│  Após realizar o pagamento PIX...     │
└───────────────────────────────────────┘

┌───────────────────────────────────────┐
│            [Ícone PIX]                │
│         Pague com PIX                 │
│   Escaneie o QR Code ou copie...      │
│                                       │
│    ┌─────────────────────────┐        │
│    │                         │        │
│    │       [QR CODE]         │        │
│    │                         │        │
│    └─────────────────────────┘        │
│                                       │
│       [ Copiar Código PIX ]           │
└───────────────────────────────────────┘

┌───────────────────────────────────────┐
│  🔵 Aguardando pagamento...           │
│  Verificando status automaticamente   │
└───────────────────────────────────────┘
```

## Benefícios

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Altura do modal | Maior (código + botão separados) | Menor (botão integrado) |
| Ação de copiar | Requer scroll em mobile | Visível imediatamente |
| Código PIX em texto | Exibido (poluição visual) | Oculto (apenas copia) |
| UX mobile | Ruim | Excelente |

## Seção Técnica

**Arquivo modificado**: `src/components/payment/PixPaymentForm.tsx`

**Alterações**:
1. Linhas 152-159: Adicionar botão compacto após a tag `<img>`
2. Linhas 161-190: Remover seção do código em texto e botão duplicado

**Componentes utilizados**: `Button` (já importado), ícones `Copy` e `Check` (já importados)

