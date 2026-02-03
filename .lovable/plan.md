
Contexto e diagnóstico (o que está acontecendo)
- O código atual do mp-create-payment (no repositório) faz a sanitização do PIX corretamente: ele reconstrói paymentData.additional_info para conter apenas items e ip_address antes de chamar payment.create().
- Mesmo assim, o Mercado Pago ainda acusa parâmetros inválidos dentro de additional_info.* (payer.address.city / federal_unit / shipments.receiver_address.city).
- Isso só pode acontecer em 2 cenários:
  1) O código “novo” não é o que está realmente executando (deploy não está refletindo na função chamada), ou
  2) A execução está indo por um caminho diferente do esperado (ex.: fluxo de cartão por causa de token presente), ou algum ponto do código ainda está enviando um body diferente do paymentData sanitizado.

Objetivo deste ajuste
- Provar, sem depender de logs do servidor, qual versão do código está rodando e qual payload efetivamente está sendo enviado ao SDK no momento do erro.
- Garantir “à prova de falhas” que, para PIX, additional_info jamais contenha payer/shipments (nem por construção inicial).

1) ARQUIVOS QUE SERÃO MODIFICADOS
- supabase/functions/mp-create-payment/index.ts

2) MOTIVO (baseado no seu relato)
- Você está fazendo copy/paste + deploy em Produção e o comportamento “não muda”.
- Precisamos de um “selo de versão” retornando no JSON de erro/sucesso para confirmar que a versão nova está em execução e, ao mesmo tempo, registrar (sem PII) quais chaves existem em additional_info imediatamente antes do SDK.

3) ESCOPO (exatamente o que será alterado)
A) Adicionar um identificador fixo de build/versão (BUILD_ID)
- Criar uma constante (ex.: BUILD_ID = "mp-create-payment@2026-02-03Txx:xxZ") no topo do arquivo.
- Incluir build_id em todas as respostas JSON (sucesso e erro), incluindo o bloco de erro SDK_EXCEPTION (status 500).
Resultado: quando você testar e receber o erro no frontend, você verá build_id no response e confirmará instantaneamente se o código que você colou está rodando.

B) Determinar “isPix” antes de montar additional_info
- Hoje o código monta additional_info completo (com payer.address.city etc) e depois tenta sanitizar no bloco PIX.
- Vamos tornar impossível “escapar” campo proibido:
  - Definir isPix logo antes da construção de paymentData (com a mesma regra atual):
    - isPix = paymentRequest.payment_method_id === 'pix' || (!paymentRequest.token && !paymentRequest.payment_method_id)
  - Ao construir paymentData.additional_info:
    - Se isPix: criar additional_info mínimo desde o início: { items: [...], ...(clientIp? { ip_address: clientIp } : {}) }
    - Se não for PIX: manter o additional_info completo atual (com payer/shipments/city/federal_unit etc) para antifraude no cartão
Resultado: para PIX, nem existe payer/shipments dentro de additional_info em nenhum momento.

C) “Asserção” final antes de chamar o SDK (debug sem PII)
- Logo antes de payment.create({ body: paymentData, ... }):
  - Computar um snapshot de debug (sem valores sensíveis), por exemplo:
    - selected_flow: 'pix' | 'card'
    - has_token: boolean
    - payment_method_id_final: paymentData.payment_method_id
    - additional_info_keys: Object.keys(paymentData.additional_info || {})
    - has_additional_info_payer: !!paymentData.additional_info?.payer
    - has_additional_info_shipments: !!paymentData.additional_info?.shipments
  - Se paymentData.payment_method_id === 'pix' e (has_additional_info_payer || has_additional_info_shipments):
    - lançar um Error com mensagem clara do tipo:
      "PIX additional_info leak: keys=..., has_payer=true, has_shipments=true"
Resultado: se por algum motivo impossível o payload estiver “vazando”, o erro vira nosso (com debug), e não um erro misterioso do MP.

D) Incluir debug_context no retorno de erro do SDK_EXCEPTION (sem PII)
- No catch (sdkError) que retorna status 500:
  - Retornar também:
    - build_id
    - debug_context (as chaves/booleans acima)
Resultado: mesmo sem acessar logs do servidor, você verá no response exatamente:
- qual build está rodando
- se o fluxo foi pix ou card
- quais chaves existiam em additional_info ao chamar o SDK

4) Passo-a-passo de implementação (dentro do mp-create-payment/index.ts)
1. Adicionar no topo:
   - const BUILD_ID = 'mp-create-payment@...'
2. Criar const isPix antes de montar paymentData (perto de onde hoje você monta paymentData).
3. Alterar a construção do paymentData.additional_info para:
   - isPix ? minimalAdditionalInfo : fullAdditionalInfo
4. Manter a sanitização PIX atual como “segunda barreira” (opcional, mas recomendado):
   - Mesmo com additional_info mínimo, manter uma sanitização final simples (reconstruir para items/ip) para redundância.
5. Antes de payment.create:
   - criar debug_context
   - console.log do debug_context (sem PII)
   - asserção anti-vazamento (throw) se PIX contiver payer/shipments
6. Incluir build_id + debug_context no JSON do SDK_EXCEPTION e também no catch geral de erro (INTERNAL_ERROR etc).
7. Incluir build_id no response de sucesso (200) também.

5) Critérios de aceite
- Após você colar + fazer deploy em Produção:
  1) No response do erro (se ainda ocorrer), deve aparecer build_id diferente do anterior.
     - Se build_id não mudar: o deploy não está atingindo a função que o site está chamando.
  2) O debug_context deve mostrar:
     - selected_flow = 'pix'
     - has_additional_info_payer = false
     - has_additional_info_shipments = false
     - additional_info_keys = ['items'] ou ['items','ip_address']
  3) Com isso, o erro do Mercado Pago sobre additional_info.payer/shipment deve desaparecer e o PIX deve retornar point_of_interaction/qr_code.

6) Riscos / Observações
- Mudança é restrita ao fluxo PIX para reduzir risco: cartão permanece com additional_info completo (antifraude).
- O retorno de debug_context será “sem PII” (somente chaves e booleanos), seguro para diagnóstico.
- Se mesmo com build_id atualizado o MP continuar reclamando e debug_context confirmar additional_info mínimo, então o problema estará fora do additional_info (ex.: algum mapeamento do SDK), e teremos evidência concreta para o próximo passo.

7) Confirmação (regra absoluta)
- Arquivos que serão modificados: apenas supabase/functions/mp-create-payment/index.ts
- Estas alterações estão explicitamente solicitadas? SIM (você reportou erro PIX persistente e pediu correção no mp-create-payment com efeito verificável)
