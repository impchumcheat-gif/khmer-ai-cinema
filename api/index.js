const MAX_REQUEST_BYTES = 1024 * 1024;
const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'content-encoding',
  'content-length',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

const jsonResponse = (status, message) => Response.json({ error: message }, { status });

export default async function handler(request) {
  const backendUrl = process.env.API_BACKEND_URL;
  if (!backendUrl) return jsonResponse(503, 'The API backend is not configured.');

  let backend;
  try {
    backend = new URL(backendUrl);
    if (!['http:', 'https:'].includes(backend.protocol) || backend.username || backend.password) {
      throw new Error('Invalid API_BACKEND_URL.');
    }
  } catch {
    return jsonResponse(500, 'API_BACKEND_URL must be a valid HTTP or HTTPS URL.');
  }

  const incomingUrl = new URL(request.url);
  const route = incomingUrl.searchParams.get('path');
  if (!route || route.split('/').some((part) => !part || part === '.' || part === '..')) {
    return jsonResponse(400, 'A valid API path is required.');
  }

  const apiRoute = `api/${route.split('/').map(encodeURIComponent).join('/')}`;
  const destination = new URL(apiRoute, `${backend.href.replace(/\/+$/, '')}/`);
  for (const [key, value] of incomingUrl.searchParams) {
    if (key !== 'path') destination.searchParams.append(key, value);
  }

  const headers = new Headers();
  for (const name of ['accept', 'content-type', 'cookie', 'user-agent', 'x-admin-password']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  let body;
  if (!['GET', 'HEAD'].includes(request.method)) {
    const bytes = await request.arrayBuffer();
    if (bytes.byteLength > MAX_REQUEST_BYTES) return jsonResponse(413, 'Request body is too large.');
    body = bytes;
  }

  let upstream;
  try {
    upstream = await fetch(destination, {
      method: request.method,
      headers,
      body,
      redirect: 'manual',
    });
  } catch {
    return jsonResponse(502, 'Could not connect to the API backend.');
  }

  const responseHeaders = new Headers();
  for (const [name, value] of upstream.headers) {
    if (!HOP_BY_HOP_HEADERS.has(name.toLowerCase()) && name.toLowerCase() !== 'set-cookie') {
      responseHeaders.set(name, value);
    }
  }
  for (const cookie of upstream.headers.getSetCookie()) {
    responseHeaders.append('set-cookie', cookie);
  }

  const responseBody = [204, 304].includes(upstream.status) ? null : await upstream.arrayBuffer();
  return new Response(responseBody, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
