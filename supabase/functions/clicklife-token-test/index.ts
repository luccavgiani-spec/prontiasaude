import { getCorsHeaders } from '../common/cors.ts';

const corsHeaders = getCorsHeaders();

/**
 * FUNÇÃO DE TESTE: Validação do Token do Integrador ClickLife
 * 
 * Esta função testa exclusivamente se o CLICKLIFE_AUTH_TOKEN está válido
 * realizando um cadastro de teste na API ClickLife.
 * 
 * Response esperado:
 * - status: 200/201 = Token válido ✅
 * - status: 401 = Token inválido/expirado ❌
 * - status: 403 = Acesso negado ❌
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const CLICKLIFE_API = Deno.env.get('CLICKLIFE_API_BASE')!;
  const INTEGRATOR_TOKEN = Deno.env.get('CLICKLIFE_AUTH_TOKEN')!;

  console.log('[Token Test] Iniciando validação do token do integrador');
  console.log('[Token Test] Token (primeiros 30 chars):', INTEGRATOR_TOKEN.substring(0, 30) + '...');
  console.log('[Token Test] API Base:', CLICKLIFE_API);

  // Payload de teste com dados fictícios
  const testPayload = {
    nome: 'Teste Token Validator',
    cpf: '12345678909', // CPF de teste (inválido propositalmente)
    email: `teste_token_${Date.now()}@prontiasaude.com.br`,
    senha: 'Pr0ntia!2025',
    datanascimento: '01-01-1990',
    sexo: 'O',
    telefone: '11999999999',
    logradouro: 'Rua Teste',
    numero: '1',
    bairro: 'Centro',
    cep: '01000000',
    cidade: 'São Paulo',
    estado: 'SP',
    empresaid: 9083,
    planoid: 863
  };

  console.log('[Token Test] Payload de teste:', JSON.stringify(testPayload));

  try {
    const res = await fetch(`${CLICKLIFE_API}/usuarios/usuarios`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'authtoken': INTEGRATOR_TOKEN
      },
      body: JSON.stringify(testPayload)
    });

    const status = res.status;
    const text = await res.text();

    console.log(`[Token Test] Response status: ${status}`);
    console.log(`[Token Test] Response body:`, text);

    // Análise do resultado
    let isValid = false;
    let message = '';

    if (status === 200 || status === 201) {
      isValid = true;
      message = '✅ Token do integrador VÁLIDO - Cadastro bem-sucedido';
    } else if (status === 409) {
      isValid = true;
      message = '✅ Token do integrador VÁLIDO - Paciente já existe (esperado)';
    } else if (status === 401) {
      message = '❌ Token do integrador INVÁLIDO ou EXPIRADO - Código 401 Unauthorized';
    } else if (status === 403) {
      message = '❌ Token do integrador sem permissão - Código 403 Forbidden';
    } else {
      message = `⚠️ Resposta inesperada: HTTP ${status}`;
    }

    console.log('[Token Test] Resultado:', message);

    return new Response(
      JSON.stringify({
        test: 'clicklife_integrator_token_validation',
        timestamp: new Date().toISOString(),
        token_prefix: INTEGRATOR_TOKEN.substring(0, 30),
        api_base: CLICKLIFE_API,
        status: status,
        valid: isValid,
        message: message,
        response_body: text,
        recommendation: isValid 
          ? '✅ Token funcionando corretamente. O problema HTTP 401 NÃO está no token do integrador.'
          : '❌ Token com problema. Contate ClickLife para renovar o CLICKLIFE_AUTH_TOKEN.'
      }, null, 2),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('[Token Test] Erro na requisição:', error);
    
    return new Response(
      JSON.stringify({
        test: 'clicklife_integrator_token_validation',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        valid: false,
        message: '❌ Erro ao testar token - Verifique conectividade com API ClickLife'
      }, null, 2),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
