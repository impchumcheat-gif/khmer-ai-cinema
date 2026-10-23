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

const readRequestBody = (request) => new Promise((resolve, reject) => {
  const chunks = [];
  let bytes = 0;
  let isTooLarge = false;

  request.on('data', (chunk) => {
    bytes += chunk.length;
    if (!isTooLarge && bytes > MAX_REQUEST_BYTES) {
      isTooLarge = true;
      reject(new Error('Request body is too large.'));
      return;
    }
    if (!isTooLarge) chunks.push(chunk);
  });
  request.on('end', () => {
    if (!isTooLarge) resolve(Buffer.concat(chunks));
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
  if (!backendUrl) {
    response.status(503).json({ error: 'The API backend is not configured.' });
    return;
  }

  let destination;
  try {
    const backend = new URL(backendUrl);
    if (!['http:', 'https:'].includes(backend.protocol) || backend.username || backend.password) {
      throw new Error('Invalid API_BACKEND_URL.');
    }
    destination = new URL(request.url, backend);
  } catch {
    response.status(500).json({ error: 'API_BACKEND_URL must be a valid HTTP or HTTPS URL.' });
    return;
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
      response.status(error.message === 'Request body is too large.' ? 413 : 400)
        .json({ error: error.message });
      return;
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
    response.status(502).json({ error: 'Could not connect to the API backend.' });
    return;
  }

  response.statusCode = upstream.status;
  for (const [name, value] of upstream.headers) {
    if (!HOP_BY_HOP_HEADERS.has(name.toLowerCase()) && name.toLowerCase() !== 'set-cookie') {
      response.setHeader(name, value);
    }
  }

  const cookies = upstream.headers.getSetCookie();
  if (cookies.length) response.setHeader('set-cookie', cookies);

  if (upstream.status === 204 || upstream.status === 304) {
    response.end();
    return;
  }

  response.end(Buffer.from(await upstream.arrayBuffer()));
}
