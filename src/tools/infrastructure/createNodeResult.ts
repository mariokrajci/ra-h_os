interface CreateNodeSuccessPayload {
  data?: {
    id?: unknown;
    dimensions?: unknown;
  } | null;
  node?: {
    id?: unknown;
  } | null;
  id?: unknown;
  error?: unknown;
  message?: unknown;
}

function normalizeNodeId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
}

export function extractCreatedNodeId(payload: unknown): number | null {
  const candidate = payload as CreateNodeSuccessPayload | null | undefined;
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  return normalizeNodeId(candidate.data?.id)
    ?? normalizeNodeId(candidate.node?.id)
    ?? normalizeNodeId(candidate.id);
}

export function extractCreatedNodeDimensions(payload: unknown): string[] | null {
  const candidate = payload as CreateNodeSuccessPayload | null | undefined;
  const raw = candidate?.data?.dimensions;
  if (!Array.isArray(raw)) {
    return null;
  }

  const dims = raw.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
  return dims;
}

function stringifyFallback(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function resolveCreateNodeError(payload: unknown, response: Response): string {
  const candidate = payload as CreateNodeSuccessPayload | null | undefined;
  const statusLabel = `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`;
  return stringifyFallback(candidate?.error)
    ?? stringifyFallback(candidate?.message)
    ?? `Failed to create node (${statusLabel})`;
}
