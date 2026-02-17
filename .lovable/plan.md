

# Correcao: Nota PIX 70/100 no Mercado Pago (Falta SDK v2 no Frontend)

## Diagnostico

O problema esta claro ao comparar os dois fluxos:

| Fluxo | Frontend | Score |
|-------|----------|-------|
| Cartao | Usa `<CardPayment />` Brick do SDK React | 100/100 |
| PIX | Botao manual "Gerar QR Code PIX" que chama backend diretamente | 70/100 |

Para **cartao**, o SDK do MP gerencia todo o formulario (Secure Fields, device fingerprint, tokenizacao). O scanner do MP detecta o SDK ativo e da nota maxima.

Para **PIX**, o frontend coleta os dados manualmente (email, CPF, nome) e chama `invokeEdgeFunction("mp-create-payment")` diretamente. O scanner do MP **nao detecta** nenhum Brick/SDK envolvido no fluxo PIX, resultando em nota 70/100.

A nota baixa no PIX contamina a nota geral da integracao, e o sistema antifraude do MP passa a recusar pagamentos com cartao tambem (especialmente em bancos digitais, que tem regras mais senssiveis ao score de integracao).

## Solucao

Substituir o botao manual "Gerar QR Code PIX" pelo componente `<Payment />` do `@mercadopago/sdk-react`, configurado para mostrar **apenas PIX** (`bankTransfer: 'all'`).

O Brick coleta e valida os dados do pagador atraves do SDK oficial do MP (email, CPF, nome, etc.), e retorna os dados estruturados no callback `onSubmit`. O frontend entao envia esses dados ao backend (`mp-create-payment`) exatamente como faz hoje.

Isso garante que o scanner do MP detecte o SDK v2 ativo no fluxo PIX, elevando a nota para 100/100.

## Arquivos Alterados

### 1. NOVO: `src/components/payment/MercadoPagoPixForm.tsx`

Componente wrapper do `<Payment />` Brick configurado para PIX only:

```text
- Importa Payment de @mercadopago/sdk-react
- Configura customization.paymentMethods = { bankTransfer: 'all' }
- Exclui tipos: creditCard, debitCard, ticket, atm, mercadoPago
- Pre-preenche payer com email, CPF, nome do formulario do PaymentModal
- No onSubmit, extrai formData e chama o callback do pai
- Mostra loader enquanto Brick carrega
```

Interface de saida:

```typescript
interface PixFormSubmitData {
  payment_method_id: string; // "pix"
  transaction_amount: number;
  payer: {
    email: string;
    first_name: string;
    last_name: string;
    identification: { type: string; number: string };
  };
  deviceId?: string;
}
```

### 2. ALTERACAO: `src/components/payment/PaymentModal.tsx`

Duas alteracoes cirurgicas:

**2a. Import** (topo do arquivo): Adicionar import do novo componente:

```typescript
import { MercadoPagoPixForm, type PixFormSubmitData } from "./MercadoPagoPixForm";
```

**2b. Troca do botao PIX** (regiao do `paymentMethod === "pix"`, linhas ~2492-2496):

Substituir:

```typescript
{paymentMethod === "pix" && (
  <>
    <Button onClick={handlePixSubmit} className="w-full" size="lg">
      Gerar QR Code PIX
    </Button>
```

Por:

```typescript
{paymentMethod === "pix" && (
  <>
    <MercadoPagoPixForm
      amount={appliedCoupon ? appliedCoupon.amount_discounted : amount}
      payerEmail={formData.email}
      payerCPF={formData.cpf}
      payerName={formData.name}
      onSubmit={async (data: PixFormSubmitData) => {
        // Setar deviceId capturado pelo Brick
        if (data.deviceId) setDeviceId(data.deviceId);
        // Chamar o handlePixSubmit existente (sem alteracoes)
        await handlePixSubmit();
      }}
      isProcessing={paymentStatus === "processing"}
    />
```

O `handlePixSubmit()` continua exatamente como esta hoje -- a unica diferenca e que agora ele e disparado pelo Brick ao inves do botao manual.

### Resumo de impacto

| Arquivo | Tipo | Linhas afetadas |
|---------|------|----------------|
| `src/components/payment/MercadoPagoPixForm.tsx` | NOVO | ~80 linhas |
| `src/components/payment/PaymentModal.tsx` | ALTERACAO | ~2 linhas (import) + ~6 linhas (troca botao por componente) |

### O que NAO muda

- `supabase/functions/mp-create-payment/index.ts` -- zero alteracoes
- `handlePixSubmit()` -- mantido intacto
- `PixPaymentForm.tsx` -- mantido intacto (exibe QR code apos geracao)
- Fluxo de cartao -- mantido intacto
- Toda logica de cupom, polling, redirecionamento -- mantida intacta

