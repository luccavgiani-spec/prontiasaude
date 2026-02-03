
Objetivo: eliminar definitivamente, para pagamentos PIX, quaisquer campos em `additional_info` que a API do Mercado Pago rejeita (especialmente `additional_info.payer.address.city`, `additional_info.payer.address.federal_unit`, `additional_info.shipments.receiver_address.city`). Apesar do bloco de `delete` já existir, o erro indica que esses campos ainda estão chegando no payload final enviado ao MP; então vamos aplicar uma sanitização mais “à prova de falhas”: para PIX, remover por completo `additional_info.payer` e `additional_info.shipments` (mantendo apenas o essencial).

────────────────────────────────────────────────────────────
1) ARQUIVOS QUE SERÃO MODIFICADOS
────────────────────────────────────────────────────────────
- supabase/functions/mp-create-payment/index.ts

────────────────────────────────────────────────────────────
2) MOTIVO (baseado no seu relato)
────────────────────────────────────────────────────────────
Mesmo após deploy, o MP continua retornando:
- `SDK_EXCEPTION` com detalhe: parâmetros inválidos em `additional_info.*` (city/federal_unit).
Isso só acontece se esses campos ainda estiverem presentes no body enviado ao Mercado Pago para PIX.

────────────────────────────────────────────────────────────
3) ESCOPO (exatamente o que será alterado)
────────────────────────────────────────────────────────────
A) Ajuste na sanitização do PIX
- Onde: dentro do bloco PIX (começa na linha ~457: `if (paymentRequest.payment_method_id === 'pix' ... )`)
- O que mudar: substituir/fortalecer o trecho atual que faz `delete city/federal_unit/state_name` por uma abordagem mais robusta:
  - Para PIX, remover completamente:
    - `paymentData.additional_info.payer`
    - `paymentData.additional_info.shipments`
  - Manter somente:
    - `paymentData.additional_info.items`
    - `paymentData.additional_info.ip_address` (se existir)

Isso garante que nenhum campo “proibido” sobreviva por variação de estrutura/serialização.

B) Log de diagnóstico sem PII (para você validar no log do backend)
- Adicionar um `console.log` logo após a sanitização do PIX informando:
  - se `additional_info` ainda contém `payer` e/ou `shipments`
  - quais chaves existem em `additional_info` após a limpeza
Importante: logar somente chaves/booleanos, não valores (não expor CPF/endereço/email).

────────────────────────────────────────────────────────────
4) DETALHE TÉCNICO (o que exatamente implementar)
────────────────────────────────────────────────────────────
No bloco PIX, após definir `paymentData.payer = { email, identification }`, ajustar a limpeza para algo nesse estilo:

- Se `paymentData.additional_info` existir:
  1) capturar `items` e `ip_address`
  2) reatribuir `paymentData.additional_info` para um novo objeto contendo só esses campos
     (assim, mesmo que existam referências antigas, o objeto final enviado ao SDK fica limpo)

Exemplo (conceitual):
- `const items = paymentData.additional_info.items;`
- `const ip = paymentData.additional_info.ip_address;`
- `paymentData.additional_info = { items, ...(ip ? { ip_address: ip } : {}) };`

E então logar:
- `has_additional_info_payer: false`
- `has_additional_info_shipments: false`
- `additional_info_keys: ['items','ip_address']` (exemplo)

────────────────────────────────────────────────────────────
5) CRITÉRIO DE ACEITE (como saber que resolveu)
────────────────────────────────────────────────────────────
Após novo deploy em Produção, ao tentar gerar PIX:
- Não deve mais ocorrer o erro “wrong parameters name … additional_info.payer.address.city …”.
- Nos logs da função deve aparecer o log de diagnóstico indicando que, para PIX:
  - `additional_info.payer` não existe
  - `additional_info.shipments` não existe
  - e o PIX deve criar o pagamento e retornar o `point_of_interaction` com dados do QR Code.

────────────────────────────────────────────────────────────
6) RISCOS / OBSERVAÇÕES
────────────────────────────────────────────────────────────
- Este ajuste é restrito ao fluxo PIX; cartão permanece com `additional_info` completo (antifraude).
- Se após isso o mesmo erro persistir, o cenário mais provável passa a ser “deploy não está atingindo a função correta/versão correta”. O log de diagnóstico serve exatamente para confirmar se o código novo está rodando.

────────────────────────────────────────────────────────────
7) CONFIRMAÇÃO (regra absoluta)
────────────────────────────────────────────────────────────
Estas alterações estão explicitamente solicitadas? SIM
- Você reportou erro no PIX e o arquivo alvo é o mesmo `mp-create-payment`, que você já está editando e fazendo deploy.
