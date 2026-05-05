import axios from 'axios';
import type { ConsoleLine } from './types';

export const apiBaseUrl = '/api/generator/code';
export const pythonRuntimeBaseUrl = process.env.NEXT_PUBLIC_PY_RUNTIME_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8002';
export const socketIoRuntimeUrl = process.env.NEXT_PUBLIC_SOCKET_IO_URL || 'http://127.0.0.1:8003';

export const MAX_GENERATE_PROMPT_CHARS = 12000;
export const REQUEST_TIMEOUT_MS = {
  generateChallenge: 60000,
  generateCode: 50000,
  submitChallenge: 25000,
};

const API_BASE_CANDIDATES = [apiBaseUrl];
const FALLBACK_DEAD_BASE_TIMEOUT_MS = 3500;
let cachedApiBase: string | null = null;

export function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

function buildApiBaseCandidates(): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const raw of API_BASE_CANDIDATES) {
    const normalized = normalizeBaseUrl(String(raw || ''));
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    ordered.push(normalized);
  }
  return ordered;
}

function buildOrderedApiCandidates(preferredBase?: string): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];

  const pushCandidate = (raw: string | null | undefined) => {
    const normalized = normalizeBaseUrl(String(raw || ''));
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    ordered.push(normalized);
  };

  pushCandidate(preferredBase);
  pushCandidate(cachedApiBase);
  for (const base of buildApiBaseCandidates()) {
    pushCandidate(base);
  }

  return ordered;
}

function toWsBase(httpBase: string): string {
  return normalizeBaseUrl(httpBase)
    .replace(/^https:\/\//, 'wss://')
    .replace(/^http:\/\//, 'ws://');
}

export function buildWsCandidates(primaryBase: string): string[] {
  const baseCandidates = [normalizeBaseUrl(primaryBase), ...buildApiBaseCandidates()];
  const pathCandidates = ['/ws/console', '/ws/console/'];
  const seen = new Set<string>();
  const urls: string[] = [];

  for (const base of baseCandidates) {
    const wsBase = toWsBase(base);
    for (const path of pathCandidates) {
      const url = `${wsBase}${path}`;
      if (seen.has(url)) continue;
      seen.add(url);
      urls.push(url);
    }
  }

  return urls;
}

export function buildSocketIoCandidates(primaryBase: string): string[] {
  const rawCandidates = [primaryBase, socketIoRuntimeUrl, 'http://127.0.0.1:8003', 'http://localhost:8003'];
  const seen = new Set<string>();
  const candidates: string[] = [];

  for (const raw of rawCandidates) {
    const normalized = normalizeBaseUrl(String(raw || ''));
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    candidates.push(normalized);
  }

  return candidates;
}

export async function postJsonWithFallback<T>(
  path: string,
  payload: unknown,
  timeoutMs: number,
  preferredBase?: string,
): Promise<{ data: T; baseUrl: string }> {
  const candidates = buildOrderedApiCandidates(preferredBase);
  let lastError: unknown = null;

  for (let i = 0; i < candidates.length; i += 1) {
    const base = candidates[i];
    const requestTimeout = i === 0 ? timeoutMs : Math.min(timeoutMs, FALLBACK_DEAD_BASE_TIMEOUT_MS);
    try {
      const response = await axios.post<T>(`${base}${path}`, payload, { timeout: requestTimeout });
      cachedApiBase = base;
      return { data: response.data, baseUrl: base };
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        const status = err.response.status;
        if (status >= 400 && status < 500 && status !== 404 && status !== 408) {
          throw err;
        }
      }
      lastError = err;
    }
  }

  throw lastError ?? new Error('API indisponible');
}

export function clampPrompt(raw: string): string {
  const normalized = raw.trim();
  if (normalized.length <= MAX_GENERATE_PROMPT_CHARS) return normalized;
  const suffix = `\n\n[Prompt tronque automatiquement a ${MAX_GENERATE_PROMPT_CHARS} caracteres]`;
  return `${normalized.slice(0, MAX_GENERATE_PROMPT_CHARS - suffix.length)}${suffix}`;
}

export function extractApiErrorMessage(err: unknown, fallbackMessage: string): string {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail;
    if (typeof detail === 'string' && detail.trim()) {
      return detail;
    }

    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0];
      if (first && typeof first.msg === 'string') {
        return first.msg;
      }
    }

    if (err.code === 'ECONNABORTED') {
      return 'La generation prend trop de temps (timeout). Reessaie ou reduis la taille de l enonce.';
    }

    if (err.response) {
      const status = err.response.status;
      return `Erreur API Next (${status}) pendant la generation. Vérifie les logs du serveur Next.`;
    }

    if (!err.response) {
      return `Impossible de joindre l API Next (${apiBaseUrl}). Le serveur Next est peut-etre arrete ou la connexion a ete interrompue.`;
    }
  }

  return fallbackMessage;
}

export function isAxiosTimeoutError(err: unknown): boolean {
  return axios.isAxiosError(err) && err.code === 'ECONNABORTED';
}

export function extractTopic(text: string): string {
  const cleaned = text.trim().replace(/\s+/g, ' ');
  if (!cleaned) return 'Exercice Python genere';
  return cleaned.length > 80 ? `${cleaned.slice(0, 80)}...` : cleaned;
}

export function extractEnonceOnly(text: string): string {
  const cleaned = String(text || '').trim();
  if (!cleaned) return '';

  const markers = [
    /\n\s*contraintes?\s*:/i,
    /\n\s*indices?\s*:/i,
    /\n\s*exemple\s*:/i,
    /\n\s*tests?\s*:/i,
    /\n\s*hints?\s*:/i,
  ];

  let end = cleaned.length;
  for (const marker of markers) {
    const match = marker.exec(cleaned);
    if (match && typeof match.index === 'number') {
      end = Math.min(end, match.index);
    }
  }

  return cleaned
    .slice(0, end)
    .replace(/^\s*exercice\s*:\s*/i, '')
    .replace(/^\s*enonce\s*:\s*/i, '')
    .trim();
}

export function extractLatestRuntimeSeconds(lines: ConsoleLine[]): number | null {
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i];
    if (line.kind !== 'meta') continue;

    const match = line.text.match(/Temps d'execution\s*:\s*([0-9]+(?:\.[0-9]+)?)s/i);
    if (!match) continue;

    const value = Number(match[1]);
    if (Number.isFinite(value)) return value;
  }

  return null;
}
