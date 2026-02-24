export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
};

export const jsonResponse = (
  payload: unknown,
  status = 200,
  extraHeaders: HeadersInit = {}
) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...extraHeaders
    }
  });

export const optionsResponse = () => new Response('ok', { headers: corsHeaders });

export const readJsonBody = async (req: Request): Promise<Record<string, unknown>> => {
  try {
    const text = await req.text();
    if (!text) return {};
    return JSON.parse(text);
  } catch {
    return {};
  }
};

export class HttpError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const errorResponse = (error: unknown, fallbackMessage = 'Erro interno') => {
  if (error instanceof HttpError) {
    return jsonResponse(
      { error: error.message, details: error.details ?? null },
      error.status
    );
  }

  const message = error instanceof Error ? error.message : fallbackMessage;
  return jsonResponse({ error: message }, 500);
};
