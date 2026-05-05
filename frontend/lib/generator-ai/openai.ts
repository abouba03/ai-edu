type OpenAIMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type OpenAIRequest = {
  messages: OpenAIMessage[];
  temperature?: number;
  maxTokens?: number;
  model?: string;
  timeoutMs?: number;
};

type ProviderConfig = {
  provider: 'openai' | 'deepseek';
  apiUrl: string;
  apiKey: string;
  defaultModel: string;
};

function getProviderConfig(): ProviderConfig {
  const forcedProvider = String(process.env.AI_PROVIDER || '').trim().toLowerCase();
  const deepseekKey = String(process.env.DEEPSEEK_API_KEY || '').trim();

  if (forcedProvider === 'deepseek' || deepseekKey) {
    if (!deepseekKey) {
      throw new Error('DEEPSEEK_API_KEY is missing in frontend server environment');
    }

    return {
      provider: 'deepseek',
      apiUrl: String(process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/chat/completions').trim(),
      apiKey: deepseekKey,
      defaultModel: String(process.env.DEEPSEEK_MODEL || 'deepseek-chat').trim(),
    };
  }

  const openaiKey = String(process.env.OPENAI_API_KEY || '').trim();
  if (!openaiKey) {
    throw new Error('OPENAI_API_KEY is missing in frontend server environment');
  }

  return {
    provider: 'openai',
    apiUrl: String(process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions').trim(),
    apiKey: openaiKey,
    defaultModel: String(process.env.OPENAI_MODEL || 'gpt-4-turbo').trim(),
  };
}

export async function callOpenAI({
  messages,
  temperature = 0.4,
  maxTokens = 1200,
  model,
  timeoutMs,
}: OpenAIRequest): Promise<string> {
  const config = getProviderConfig();
  const resolvedTimeoutMs = Number(process.env.AI_REQUEST_TIMEOUT_MS || timeoutMs || 45000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), resolvedTimeoutMs);

  let response: Response;
  try {
    response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: model || config.defaultModel,
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
      cache: 'no-store',
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`AI request timeout after ${resolvedTimeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${text.slice(0, 400)}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = String(data.choices?.[0]?.message?.content || '').trim();
  if (!content) {
    throw new Error('AI provider returned empty content');
  }

  return content;
}

export function parseJsonFromText<T>(raw: string): T | null {
  const text = String(raw || '').trim();
  if (!text) return null;

  try {
    return JSON.parse(text) as T;
  } catch {
    // Try extracting JSON from fenced blocks or surrounding text.
  }

  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : text;

  try {
    return JSON.parse(candidate) as T;
  } catch {
    // Continue with object extraction.
  }

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const objectSlice = text.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(objectSlice) as T;
    } catch {
      return null;
    }
  }

  return null;
}
