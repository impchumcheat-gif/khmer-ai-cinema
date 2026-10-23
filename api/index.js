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

const sendJson = (response, status, message) => {
  response.statusCode = status;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.end(JSON.stringify({ error: message }));
};

const readRequestBody = (request) => new Promise((resolve, reject) => {
  const chunks = [];
  let bytes = 0;
  let tooLarge = false;

  request.on('data', (chunk) => {
    bytes += chunk.length;
    if (bytes > MAX_REQUEST_BYTES) {
      tooLarge = true;
      return;
    }
    if (!tooLarge) chunks.push(chunk);
  });
  request.on('end', () => {
    if (tooLarge) reject(new Error('Request body is too large.'));
    else resolve(Buffer.concat(chunks));
  });
  request.on('error', reject);
});

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(request, response) {
  const backendUrl = process.env.API_BACKEND_URL;
  if (!backendUrl) return sendJson(response, 503, 'The API backend is not configured.');

  let backend;
  try {
    backend = new URL(backendUrl);
    if (!['http:', 'https:'].includes(backend.protocol) || backend.username || backend.password) {
      throw new Error('Invalid API_BACKEND_URL.');
    }
  } catch {
    return sendJson(response, 500, 'API_BACKEND_URL must be a valid HTTP or HTTPS URL.');
  }

  const incomingUrl = new URL(request.url, `https://${request.headers.host || 'vercel.app'}`);
  const route = incomingUrl.searchParams.get('path');
  if (!route || route.split('/').some((part) => !part || part === '.' || part === '..')) {
    return sendJson(response, 400, 'A valid API path is required.');
  }

  const apiRoute = `api/${route.split('/').map(encodeURIComponent).join('/')}`;
  const destination = new URL(apiRoute, `${backend.href.replace(/\/+$/, '')}/`);
  for (const [key, value] of incomingUrl.searchParams) {
    if (key !== 'path') destination.searchParams.append(key, value);
  }

  const headers = new Headers();
  for (const name of ['accept', 'content-type', 'cookie', 'user-agent', 'x-admin-password']) {
    const value = request.headers[name];
    if (typeof value === 'string') headers.set(name, value);
  }

  let body;
  if (!['GET', 'HEAD'].includes(request.method)) {
    try {
      body = await readRequestBody(request);
    } catch (error) {
      return sendJson(response, error.message === 'Request body is too large.' ? 413 : 400, error.message);
    }
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
    return sendJson(response, 502, 'Could not connect to the API backend.');
  }

  for (const [name, value] of upstream.headers) {
    if (!HOP_BY_HOP_HEADERS.has(name.toLowerCase()) && name.toLowerCase() !== 'set-cookie') {
      response.setHeader(name, value);
    }
  }
  const cookies = upstream.headers.getSetCookie();
  if (cookies.length) response.setHeader('set-cookie', cookies);

  response.statusCode = upstream.status;
  if ([204, 304].includes(upstream.status) || request.method === 'HEAD') {
    return response.end();
  }
  response.end(Buffer.from(await upstream.arrayBuffer()));
}
