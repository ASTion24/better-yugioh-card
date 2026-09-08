import {
  DeckSourceError,
  fetchDeckSource,
} from '../server/deck-source-proxy.js';

export default async function handler(request, response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    response.statusCode = 204;
    response.end();
    return;
  }
  if (request.method !== 'GET') {
    response.statusCode = 405;
    response.end('Method not allowed');
    return;
  }

  try {
    const requestUrl = new URL(request.url, 'http://localhost');
    const body = await fetchDeckSource(requestUrl.searchParams.get('url') || '');
    response.statusCode = 200;
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
    response.end(body);
  } catch (error) {
    response.statusCode = error instanceof DeckSourceError
      ? error.status
      : 502;
    response.end(error instanceof Error ? error.message : String(error));
  }
}
