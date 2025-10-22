// Shared CORS configuration for edge functions
// Security: Restricts API access to specific domains only

const ALLOWED_ORIGINS = [
  'https://prontiasaude.com.br',
  'https://www.prontiasaude.com.br',
  'https://9bc3ce56-2fcc-49e0-81b3-829d5921f2b4.lovableproject.com', // Lovable preview
  'http://localhost:5173', // Local development
];

export function getCorsHeaders(requestOrigin?: string | null): Record<string, string> {
  const origin = requestOrigin || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : '';
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin || ALLOWED_ORIGINS[0], // Default to primary domain
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  };
}

export function getWebhookCorsHeaders(): Record<string, string> {
  // Webhooks from external services (MP, etc.) need wildcard
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}
