const ALLOWED_HOSTS = new Set(['ygoprodeck.com', 'www.ygoprodeck.com']);
const MAX_RESPONSE_BYTES = 2_000_000;

export class DeckSourceError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

export const validateDeckSourceUrl = value => {
  let target;
  try {
    target = new URL(value);
  } catch {
    throw new DeckSourceError('Invalid deck source URL', 400);
  }
  if (target.protocol !== 'https:' || !ALLOWED_HOSTS.has(target.hostname)) {
    throw new DeckSourceError('Unsupported deck source', 403);
  }
  return target;
};

export const fetchDeckSource = async value => {
  let target = validateDeckSourceUrl(value);
  let upstream;
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    upstream = await fetch(target, {
      headers: {
        Accept: 'text/html',
        'User-Agent': 'YugiohCardDeckImporter/1.0',
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(12_000),
    });
    if (upstream.status < 300 || upstream.status >= 400) break;
    const location = upstream.headers.get('location');
    if (!location || redirects === 3) {
      throw new DeckSourceError('Too many deck source redirects', 502);
    }
    target = validateDeckSourceUrl(new URL(location, target).href);
  }
  if (!upstream.ok) {
    throw new DeckSourceError(
      `Upstream request failed (${upstream.status})`,
      upstream.status,
    );
  }
  const contentLength = Number(upstream.headers.get('content-length')) || 0;
  if (contentLength > MAX_RESPONSE_BYTES) {
    throw new DeckSourceError('Deck source response is too large', 413);
  }
  const body = await upstream.text();
  if (new TextEncoder().encode(body).byteLength > MAX_RESPONSE_BYTES) {
    throw new DeckSourceError('Deck source response is too large', 413);
  }
  return body;
};
