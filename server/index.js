import { createServer } from 'node:http';
import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { promisify } from 'node:util';
import { mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

const scrypt = promisify(scryptCallback);
const DATA_FILE = resolve(process.cwd(), 'server/data/app-data.sqlite');
const SESSION_MAX_AGE = 7 * 24 * 60 * 60;
const EMAIL_TOKEN_TTL_MS = 60 * 60 * 1000;
const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;

const loadLocalEnv = async () => {
  try {
    const contents = await readFile(resolve(process.cwd(), '.env'), 'utf8');
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^(?:"(.*)"|'(.*)')$/, '$1$2');
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
};

const json = (response, status, payload) => {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(payload === undefined ? undefined : JSON.stringify(payload));
};

const readJson = (request, maxBytes = 4096) => new Promise((resolveBody, rejectBody) => {
  let body = '';
  request.on('data', (chunk) => {
    body += chunk;
    if (body.length > maxBytes) rejectBody(new Error('Request body is too large'));
  });
  request.on('end', () => {
    try { resolveBody(JSON.parse(body || '{}')); }
    catch { rejectBody(new Error('Invalid JSON')); }
  });
  request.on('error', rejectBody);
});

const escapeHtml = (value) => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));

let database;
const emptyDb = () => ({ users: [], orders: [], entitlements: [], emailTokens: [], passwordResetTokens: [], magicTokens: [], googleStates: [], sessions: [], movieViews: [] });
const loadDb = async () => {
  const row = database.prepare('SELECT data FROM app_state WHERE id = 1').get();
  return JSON.parse(row.data);
};

let writeQueue = Promise.resolve();
const updateDb = (update) => {
  const operation = writeQueue.then(async () => {
    const db = await loadDb();
    const result = await update(db);
    database.prepare('UPDATE app_state SET data = ? WHERE id = 1').run(JSON.stringify(db));
    return result;
  });
  writeQueue = operation.catch(() => undefined);
  return operation;
};

const hashPassword = async (password, salt = randomBytes(16).toString('hex')) => {
  const hash = await scrypt(password, salt, 64);
  return { salt, hash: hash.toString('hex') };
};

const safeEqual = (first, second) => {
  const a = Buffer.from(first || '');
  const b = Buffer.from(second || '');
  return a.length === b.length && timingSafeEqual(a, b);
};

const digestToken = (token) => createHash('sha256').update(token).digest('hex');

const sendAccountEmail = async ({ to, subject, text }) => {
  const { RESEND_API_KEY, EMAIL_FROM } = process.env;
  if (!RESEND_API_KEY || !EMAIL_FROM) throw new Error('Email is not configured. Add RESEND_API_KEY and EMAIL_FROM to .env.');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, text }),
  });
  if (!response.ok) throw new Error('Could not send the email. Check the email service configuration.');
};

const cookieValue = (request, name) => {
  const cookie = request.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : '';
};

const setSessionCookie = (response, token) => {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  response.setHeader('Set-Cookie', `khmer_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE}${secure}`);
};

const clearSessionCookie = (response) => {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  response.setHeader('Set-Cookie', `khmer_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`);
};

const googleRedirectUri = () => process.env.GOOGLE_REDIRECT_URI || `${process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:5173'}/api/auth/google/callback`;
const hasGoogleOAuthCredentials = () => /^[\w-]+\.apps\.googleusercontent\.com$/.test(process.env.GOOGLE_CLIENT_ID || '')
  && Boolean(process.env.GOOGLE_CLIENT_SECRET)
  && !/your_google|client_secret|client_id|ដាក់/i.test(`${process.env.GOOGLE_CLIENT_ID} ${process.env.GOOGLE_CLIENT_SECRET}`);
const clearGoogleStateCookie = (response) => {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  const existing = response.getHeader('Set-Cookie');
  const cookies = Array.isArray(existing) ? existing : existing ? [existing] : [];
  cookies.push(`google_oauth_state=; HttpOnly; SameSite=Lax; Path=/api/auth/google/callback; Max-Age=0${secure}`);
  response.setHeader('Set-Cookie', cookies);
};

await loadLocalEnv();

mkdirSync(resolve(process.cwd(), 'server/data'), { recursive: true });
database = new DatabaseSync(DATA_FILE);
database.exec('CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY CHECK (id = 1), data TEXT NOT NULL)');
if (!database.prepare('SELECT id FROM app_state WHERE id = 1').get()) {
  let initialData = emptyDb();
  try {
    initialData = { ...initialData, ...JSON.parse(await readFile(resolve(process.cwd(), 'server/data/app-data.json'), 'utf8')) };
    // Keep existing local accounts usable when migrating from the JSON-backed version.
    for (const user of initialData.users) if (user.verified === undefined) user.verified = true;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  database.prepare('INSERT INTO app_state (id, data) VALUES (1, ?)').run(JSON.stringify(initialData));
}

const authAttempts = new Map();
const paymentAttempts = new Map();
const emailAttempts = new Map();
const allowEmailAction = (request) => {
  const ip = request.socket.remoteAddress || 'unknown';
  const recent = (emailAttempts.get(ip) || []).filter((time) => Date.now() - time < 60 * 60 * 1000);
  if (recent.length >= 5) return false;
  recent.push(Date.now());
  emailAttempts.set(ip, recent);
  return true;
};

const getUser = async (request) => {
  const token = cookieValue(request, 'khmer_session');
  if (!token) return null;
  const db = await loadDb();
  const session = (db.sessions || []).find((entry) => entry.tokenHash === digestToken(token));
  if (!session || session.expiresAt < Date.now()) return null;
  return db.users.find((user) => user.id === session.userId) || null;
};

const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  try {
    if (request.method === 'GET' && url.pathname === '/api/auth/google') {
      if (!hasGoogleOAuthCredentials()) {
        const appUrl = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:5173';
        response.writeHead(302, { Location: `${appUrl}/?google_error=not_configured` });
        return response.end();
      }
      const state = randomBytes(32).toString('hex');
      await updateDb((db) => {
        db.googleStates ||= [];
        db.googleStates = db.googleStates.filter((entry) => entry.expiresAt > Date.now());
        db.googleStates.push({ stateHash: digestToken(state), expiresAt: Date.now() + 10 * 60 * 1000 });
      });
      const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
      response.setHeader('Set-Cookie', `google_oauth_state=${encodeURIComponent(state)}; HttpOnly; SameSite=Lax; Path=/api/auth/google/callback; Max-Age=600${secure}`);
      const authorization = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authorization.search = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        redirect_uri: googleRedirectUri(),
        response_type: 'code',
        scope: 'openid email profile',
        state,
        prompt: 'select_account',
      }).toString();
      response.writeHead(302, { Location: authorization.toString() });
      return response.end();
    }

    if (request.method === 'GET' && url.pathname === '/api/auth/google/callback') {
      const appUrl = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:5173';
      const fail = (reason) => {
        clearGoogleStateCookie(response);
        response.writeHead(302, { Location: `${appUrl}/?google_error=${encodeURIComponent(reason)}` });
        return response.end();
      };
      const state = url.searchParams.get('state') || '';
      const stateCookie = cookieValue(request, 'google_oauth_state');
      const code = url.searchParams.get('code') || '';
      if (!state || !stateCookie || !safeEqual(state, stateCookie) || !code || !hasGoogleOAuthCredentials()) return fail('invalid_request');
      const validState = await updateDb((db) => {
        db.googleStates ||= [];
        const hash = digestToken(state);
        const index = db.googleStates.findIndex((entry) => entry.stateHash === hash && entry.expiresAt > Date.now());
        if (index < 0) return false;
        db.googleStates.splice(index, 1);
        return true;
      });
      if (!validState) return fail('invalid_request');

      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          redirect_uri: googleRedirectUri(),
          grant_type: 'authorization_code',
        }),
      });
      if (!tokenResponse.ok) return fail('google_sign_in_failed');
      const tokens = await tokenResponse.json();
      const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (!profileResponse.ok) return fail('google_sign_in_failed');
      const profile = await profileResponse.json();
      const email = typeof profile.email === 'string' ? profile.email.trim().toLowerCase() : '';
      if (!profile.sub || !email || profile.email_verified !== true) return fail('email_not_verified');

      const sessionToken = randomBytes(32).toString('hex');
      const credentials = await hashPassword(randomBytes(48).toString('hex'));
      let accountConflict = false;
      await updateDb((db) => {
        db.sessions ||= [];
        db.emailTokens ||= [];
        const linkedUser = db.users.find((entry) => entry.googleSub === profile.sub);
        const emailUser = db.users.find((entry) => entry.email === email);
        if ((linkedUser && emailUser && linkedUser.id !== emailUser.id) || (emailUser?.googleSub && emailUser.googleSub !== profile.sub)) {
          accountConflict = true;
          return;
        }
        let user = linkedUser || emailUser;
        if (!user) {
          user = {
            id: randomUUID(), email, name: (typeof profile.name === 'string' && profile.name.trim()) || email.split('@')[0],
            googleSub: profile.sub, verified: true, ...credentials, createdAt: new Date().toISOString(),
          };
          db.users.push(user);
        }
        user.googleSub ||= profile.sub;
        user.email = email;
        user.verified = true;
        db.emailTokens = db.emailTokens.filter((entry) => entry.userId !== user.id);
        db.sessions = db.sessions.filter((entry) => entry.expiresAt > Date.now());
        db.sessions.push({ tokenHash: digestToken(sessionToken), userId: user.id, expiresAt: Date.now() + SESSION_MAX_AGE * 1000 });
      });
      if (accountConflict) return fail('account_conflict');
      setSessionCookie(response, sessionToken);
      clearGoogleStateCookie(response);
      response.writeHead(302, { Location: `${appUrl}/?google_success=1` });
      return response.end();
    }

    if (request.method === 'POST' && ['/api/auth/signup', '/api/auth/login'].includes(url.pathname)) {
      const ip = request.socket.remoteAddress || 'unknown';
      const recent = authAttempts.get(ip) || [];
      const allowed = recent.filter((time) => Date.now() - time < 15 * 60 * 1000);
      if (allowed.length >= 10) return json(response, 429, { error: 'Too many login attempts. Please wait a little and try again.' });
      allowed.push(Date.now());
      authAttempts.set(ip, allowed);

      const body = await readJson(request);
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const password = typeof body.password === 'string' ? body.password : '';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(response, 400, { error: 'Enter a valid email address.' });
      if (password.length < 8 || password.length > 128) return json(response, 400, { error: 'Password must be between 8 and 128 characters.' });

      let user;
      if (url.pathname === '/api/auth/signup') {
        const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '';
        if (!name) return json(response, 400, { error: 'Enter your name.' });
        const credentials = await hashPassword(password);
        const id = randomUUID();
        const created = await updateDb((db) => {
          if (db.users.some((entry) => entry.email === email)) return null;
          const newUser = { id, email, name, ...credentials, verified: false, createdAt: new Date().toISOString() };
          db.users.push(newUser);
          return newUser;
        });
        if (!created) return json(response, 409, { error: 'An account with this email already exists.' });
        user = created;
        const rawToken = randomBytes(32).toString('hex');
        const verifyUrl = `${process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:5173'}/?verify=${rawToken}`;
        await updateDb((db) => { db.emailTokens.push({ userId: user.id, tokenHash: digestToken(rawToken), expiresAt: Date.now() + EMAIL_TOKEN_TTL_MS }); });
        try {
          await sendAccountEmail({ to: user.email, subject: 'Verify your Khmer AI Cinema account', text: `Hello ${user.name},\n\nVerify your email within 1 hour:\n${verifyUrl}\n\nIf you did not create this account, ignore this email.` });
        } catch (error) {
          await updateDb((db) => {
            db.users = db.users.filter((entry) => entry.id !== user.id);
            db.emailTokens = db.emailTokens.filter((entry) => entry.userId !== user.id);
          });
          throw error;
        }
        return json(response, 201, { needsVerification: true });
      } else {
        const db = await loadDb();
        user = db.users.find((entry) => entry.email === email);
        const credentials = user ? await hashPassword(password, user.salt) : null;
        if (!user || !safeEqual(credentials.hash, user.hash)) return json(response, 401, { error: 'Email or password is incorrect.' });
        if (!user.verified) return json(response, 403, { error: 'Verify your email using the link we sent before signing in.' });
      }

      const token = randomBytes(32).toString('hex');
      await updateDb((db) => {
        db.sessions ||= [];
        db.sessions = db.sessions.filter((entry) => entry.expiresAt > Date.now());
        db.sessions.push({ tokenHash: digestToken(token), userId: user.id, expiresAt: Date.now() + SESSION_MAX_AGE * 1000 });
      });
      setSessionCookie(response, token);
      return json(response, 200, { user: { id: user.id, email: user.email, name: user.name } });
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/verify-email') {
      const { token } = await readJson(request);
      if (typeof token !== 'string' || token.length > 200) return json(response, 400, { error: 'Verification link is invalid or expired.' });
      let verified = false;
      await updateDb((db) => {
        const hash = digestToken(token);
        const index = db.emailTokens.findIndex((entry) => entry.tokenHash === hash && entry.expiresAt > Date.now());
        if (index < 0) return;
        const user = db.users.find((entry) => entry.id === db.emailTokens[index].userId);
        if (user) { user.verified = true; verified = true; }
        db.emailTokens.splice(index, 1);
      });
      return verified ? json(response, 200, { ok: true }) : json(response, 400, { error: 'Verification link is invalid or expired.' });
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/email-login') {
      if (!allowEmailAction(request)) return json(response, 429, { error: 'Too many email requests. Try again later.' });
      const { email: inputEmail } = await readJson(request);
      const email = typeof inputEmail === 'string' ? inputEmail.trim().toLowerCase() : '';
      const db = await loadDb();
      const user = db.users.find((entry) => entry.email === email && entry.verified);
      if (user) {
        const rawToken = randomBytes(32).toString('hex');
        const loginUrl = `${process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:5173'}/?login=${rawToken}`;
        await updateDb((latest) => {
          latest.magicTokens ||= [];
          latest.magicTokens = latest.magicTokens.filter((entry) => entry.userId !== user.id);
          latest.magicTokens.push({ userId: user.id, tokenHash: digestToken(rawToken), expiresAt: Date.now() + MAGIC_LINK_TTL_MS });
        });
        await sendAccountEmail({ to: user.email, subject: 'Sign in to Khmer AI Cinema', text: `Hello ${user.name},\n\nUse this secure sign-in link within 15 minutes:\n${loginUrl}\n\nIf you did not request this, ignore this email.` });
      }
      return json(response, 200, { ok: true, message: 'If the verified email belongs to an account, a sign-in link has been sent.' });
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/email-login/verify') {
      const { token } = await readJson(request);
      if (typeof token !== 'string' || token.length > 200) return json(response, 400, { error: 'Sign-in link is invalid or expired.' });
      let signedInUser;
      let sessionCookieToken = '';
      await updateDb((db) => {
        db.magicTokens ||= [];
        const tokenHash = digestToken(token);
        const index = db.magicTokens.findIndex((entry) => entry.tokenHash === tokenHash && entry.expiresAt > Date.now());
        if (index < 0) return;
        signedInUser = db.users.find((entry) => entry.id === db.magicTokens[index].userId && entry.verified);
        db.magicTokens.splice(index, 1);
        if (signedInUser) {
          db.sessions ||= [];
          db.sessions = db.sessions.filter((entry) => entry.expiresAt > Date.now());
          sessionCookieToken = randomBytes(32).toString('hex');
          db.sessions.push({ tokenHash: digestToken(sessionCookieToken), userId: signedInUser.id, expiresAt: Date.now() + SESSION_MAX_AGE * 1000 });
        }
      });
      if (!signedInUser) return json(response, 400, { error: 'Sign-in link is invalid or expired.' });
      setSessionCookie(response, sessionCookieToken);
      return json(response, 200, { user: { id: signedInUser.id, email: signedInUser.email, name: signedInUser.name } });
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/resend-verification') {
      if (!allowEmailAction(request)) return json(response, 429, { error: 'Too many email requests. Try again later.' });
      const { email: inputEmail } = await readJson(request);
      const email = typeof inputEmail === 'string' ? inputEmail.trim().toLowerCase() : '';
      const db = await loadDb();
      const user = db.users.find((entry) => entry.email === email && !entry.verified);
      if (user) {
        const rawToken = randomBytes(32).toString('hex');
        const verifyUrl = `${process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:5173'}/?verify=${rawToken}`;
        await updateDb((latest) => {
          latest.emailTokens = (latest.emailTokens || []).filter((entry) => entry.userId !== user.id);
          latest.emailTokens.push({ userId: user.id, tokenHash: digestToken(rawToken), expiresAt: Date.now() + EMAIL_TOKEN_TTL_MS });
        });
        await sendAccountEmail({ to: user.email, subject: 'Verify your Khmer AI Cinema account', text: `Hello ${user.name},\n\nVerify your email within 1 hour:\n${verifyUrl}\n\nIf you did not create this account, ignore this email.` });
      }
      return json(response, 200, { ok: true, message: 'If the account needs verification, a new link has been sent.' });
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/forgot-password') {
      if (!allowEmailAction(request)) return json(response, 429, { error: 'Too many email requests. Try again later.' });
      const { email: inputEmail } = await readJson(request);
      const email = typeof inputEmail === 'string' ? inputEmail.trim().toLowerCase() : '';
      const db = await loadDb();
      const user = db.users.find((entry) => entry.email === email && entry.verified);
      if (user) {
        const rawToken = randomBytes(32).toString('hex');
        const resetUrl = `${process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:5173'}/?reset=${rawToken}`;
        await updateDb((latest) => {
          latest.passwordResetTokens = (latest.passwordResetTokens || []).filter((entry) => entry.userId !== user.id);
          latest.passwordResetTokens.push({ userId: user.id, tokenHash: digestToken(rawToken), expiresAt: Date.now() + EMAIL_TOKEN_TTL_MS });
        });
        await sendAccountEmail({ to: user.email, subject: 'Reset your Khmer AI Cinema password', text: `Hello ${user.name},\n\nReset your password within 1 hour:\n${resetUrl}\n\nIf you did not request this, ignore this email.` });
      }
      return json(response, 200, { ok: true, message: 'If the verified email is registered, a reset link has been sent.' });
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/reset-password') {
      const { token, password } = await readJson(request);
      if (typeof token !== 'string' || token.length > 200 || typeof password !== 'string' || password.length < 8 || password.length > 128) {
        return json(response, 400, { error: 'Use a valid reset link and a password between 8 and 128 characters.' });
      }
      const credentials = await hashPassword(password);
      let updated = false;
      let resetUserId = '';
      await updateDb((db) => {
        db.passwordResetTokens ||= [];
        const hash = digestToken(token);
        const index = db.passwordResetTokens.findIndex((entry) => entry.tokenHash === hash && entry.expiresAt > Date.now());
        if (index < 0) return;
        const userId = db.passwordResetTokens[index].userId;
        resetUserId = userId;
        const user = db.users.find((entry) => entry.id === userId);
        if (user) { Object.assign(user, credentials); updated = true; }
        db.passwordResetTokens = db.passwordResetTokens.filter((entry) => entry.userId !== userId);
      });
      if (updated) {
        await updateDb((db) => { db.sessions = (db.sessions || []).filter((entry) => entry.userId !== resetUserId); });
      }
      return updated ? json(response, 200, { ok: true }) : json(response, 400, { error: 'Reset link is invalid or expired.' });
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/logout') {
      const token = cookieValue(request, 'khmer_session');
      if (token) await updateDb((db) => { db.sessions = (db.sessions || []).filter((entry) => entry.tokenHash !== digestToken(token)); });
      clearSessionCookie(response);
      return json(response, 200, { ok: true });
    }

    if (request.method === 'GET' && url.pathname === '/api/auth/me') {
      const user = await getUser(request);
      if (!user) return json(response, 200, { user: null, access: { vip: false, movieIds: [] } });
      if (!user.verified) return json(response, 403, { error: 'Verify your email before continuing.' });
      const db = await loadDb();
      const access = db.entitlements.find((entry) => entry.userId === user.id) || { vip: false, movieIds: [] };
      const latestOrder = db.orders.filter((entry) => entry.userId === user.id).at(-1);
      return json(response, 200, {
        user: { id: user.id, email: user.email, name: user.name },
        profile: {
          favorites: Array.isArray(user.profile?.favorites) ? user.profile.favorites : [],
          progress: Array.isArray(user.profile?.progress) ? user.profile.progress : [],
        },
        access: { vip: Boolean(access.vip), movieIds: access.movieIds || [] },
        latestOrder: latestOrder ? {
          orderId: latestOrder.id,
          claimCode: latestOrder.claimCode,
          status: latestOrder.status,
          item: latestOrder.item,
          movieId: latestOrder.movieId,
        } : null,
      });
    }

    if (request.method === 'PUT' && url.pathname === '/api/profile') {
      const user = await getUser(request);
      if (!user) return json(response, 401, { error: 'Log in to save your profile.' });
      if (!user.verified) return json(response, 403, { error: 'Verify your email before continuing.' });
      const body = await readJson(request, 32 * 1024);
      if (!Array.isArray(body.favorites) || !Array.isArray(body.progress) || body.favorites.length > 500 || body.progress.length > 100) {
        return json(response, 400, { error: 'Invalid profile data.' });
      }

      const favorites = [...new Set(body.favorites.filter((id) => Number.isSafeInteger(id) && id > 0))];
      const progressByMovie = new Map();
      for (const item of body.progress) {
        if (!item || !Number.isSafeInteger(item.movieId) || item.movieId <= 0
          || !Number.isFinite(item.currentTime) || item.currentTime < 0
          || !Number.isFinite(item.duration) || item.duration < 0) {
          return json(response, 400, { error: 'Invalid watch progress.' });
        }
        progressByMovie.set(item.movieId, {
          movieId: item.movieId,
          currentTime: Math.min(item.currentTime, item.duration || item.currentTime),
          duration: item.duration,
          updatedAt: new Date().toISOString(),
        });
      }

      await updateDb((db) => {
        const account = db.users.find((entry) => entry.id === user.id);
        if (!account) throw new Error('Account not found.');
        account.profile = { favorites, progress: [...progressByMovie.values()].slice(-100) };
      });
      return json(response, 200, { favorites, progress: [...progressByMovie.values()].slice(-100) });
    }

    if (request.method === 'POST' && url.pathname === '/api/analytics/view') {
      const user = await getUser(request);
      if (!user || !user.verified) return json(response, 401, { error: 'Sign in with a verified account to record viewing.' });
      const body = await readJson(request);
      if (!Number.isSafeInteger(body.movieId) || body.movieId <= 0) return json(response, 400, { error: 'A valid movie ID is required.' });

      await updateDb((db) => {
        db.movieViews ||= [];
        const recentView = db.movieViews.find((entry) => entry.userId === user.id
          && entry.movieId === body.movieId && Date.now() - entry.viewedAt < 5 * 60 * 1000);
        if (!recentView) {
          db.movieViews.push({ userId: user.id, movieId: body.movieId, viewedAt: Date.now() });
          db.movieViews = db.movieViews.slice(-100000);
        }
      });
      return json(response, 204);
    }

    if (request.method === 'POST' && url.pathname === '/api/payment-intent') {
      const ip = request.socket.remoteAddress || 'unknown';
      const last = paymentAttempts.get(ip) || 0;
      if (Date.now() - last < 8000) return json(response, 429, { error: 'Please wait before sending another request.' });
      const user = await getUser(request);
      if (!user) return json(response, 401, { error: 'Log in before creating a payment request.' });
      const body = await readJson(request);
      const item = typeof body.item === 'string' ? body.item.trim().slice(0, 120) : '';
      const amount = typeof body.amount === 'string' ? body.amount.trim().slice(0, 30) : '';
      if (!item || !amount) return json(response, 400, { error: 'Item and amount are required.' });

      const order = {
        id: randomUUID(), claimCode: randomBytes(4).toString('hex').toUpperCase(),
        userId: user.id, customerEmail: user.email, customerName: user.name,
        item, amount, movieId: body.movieId ?? null, status: 'pending',
        createdAt: new Date().toISOString(),
      };
      await updateDb((db) => { db.orders.push(order); });

      let notificationSent = false;
      const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env;
      if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
        const message = [
          '<b>New ABA payment request</b>',
          `Customer: ${escapeHtml(user.name)} (${escapeHtml(user.email)})`,
          `Item: ${escapeHtml(item)}`, `Amount: ${escapeHtml(amount)}`,
          `Order: <code>${order.id}</code>`, `Claim code: <code>${order.claimCode}</code>`,
          'Status: Pending. Verify the deposit in ABA before approving.',
        ].join('\n');
        try {
          const result = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: 'HTML' }),
          });
          notificationSent = result.ok;
        } catch { /* The order remains available in the admin queue. */ }
      }
      paymentAttempts.set(ip, Date.now());
      return json(response, 201, { orderId: order.id, claimCode: order.claimCode, status: order.status, item, movieId: order.movieId, notificationSent });
    }

    if (request.method === 'GET' && url.pathname === '/api/payment-status') {
      const user = await getUser(request);
      if (!user) return json(response, 401, { error: 'Log in to check this payment.' });
      const { orderId, claimCode } = Object.fromEntries(url.searchParams);
      if (!orderId || !claimCode) return json(response, 400, { error: 'Order and claim code are required.' });
      const db = await loadDb();
      const order = db.orders.find((entry) => entry.id === orderId && entry.claimCode === claimCode && entry.userId === user.id);
      if (!order) return json(response, 404, { error: 'Order not found for this account.' });
      return json(response, 200, { status: order.status, item: order.item, movieId: order.movieId });
    }

    if (url.pathname.startsWith('/api/admin/')) {
      const adminPassword = process.env.ADMIN_PASSWORD;
      if (!adminPassword || !safeEqual(request.headers['x-admin-password'], adminPassword)) return json(response, 401, { error: 'Admin password is incorrect or missing.' });
      const db = await loadDb();
      if (request.method === 'GET' && url.pathname === '/api/admin/analytics') {
        const now = Date.now();
        const recentViews = (db.movieViews || []).filter((entry) => now - entry.viewedAt < 7 * 24 * 60 * 60 * 1000);
        const viewsByMovie = new Map();
        for (const entry of db.movieViews || []) {
          viewsByMovie.set(entry.movieId, (viewsByMovie.get(entry.movieId) || 0) + 1);
        }
        const approvedOrders = db.orders.filter((order) => order.status === 'approved');
        return json(response, 200, {
          totalViews: (db.movieViews || []).length,
          viewsLast7Days: recentViews.length,
          uniqueViewersLast7Days: new Set(recentViews.map((entry) => entry.userId)).size,
          pendingOrders: db.orders.filter((order) => order.status === 'pending').length,
          approvedOrders: approvedOrders.length,
          topMovies: [...viewsByMovie.entries()]
            .map(([movieId, views]) => ({ movieId, views }))
            .sort((first, second) => second.views - first.views)
            .slice(0, 10),
        });
      }
      if (request.method === 'GET' && url.pathname === '/api/admin/orders') {
        return json(response, 200, db.orders.slice().reverse().map(({ userId: _userId, ...order }) => order));
      }
      const match = url.pathname.match(/^\/api\/admin\/orders\/([\w-]+)\/approve$/);
      if (request.method === 'POST' && match) {
        const order = db.orders.find((entry) => entry.id === match[1]);
        if (!order) return json(response, 404, { error: 'Order not found.' });
        order.status = 'approved';
        order.approvedAt = new Date().toISOString();
        let access = db.entitlements.find((entry) => entry.userId === order.userId);
        if (!access) {
          access = { userId: order.userId, vip: false, movieIds: [] };
          db.entitlements.push(access);
        }
        if (order.movieId == null) access.vip = true;
        else if (!access.movieIds.includes(order.movieId)) access.movieIds.push(order.movieId);
        await updateDb((latest) => {
          const index = latest.orders.findIndex((entry) => entry.id === order.id);
          if (index >= 0) latest.orders[index] = order;
          const entitlementIndex = latest.entitlements.findIndex((entry) => entry.userId === access.userId);
          if (entitlementIndex >= 0) latest.entitlements[entitlementIndex] = access;
          else latest.entitlements.push(access);
        });
        return json(response, 200, { status: order.status });
      }
      return json(response, 404, { error: 'Not found.' });
    }

    if (request.method === 'GET' && !url.pathname.startsWith('/api/')) {
      const distDir = resolve(process.cwd(), 'dist');
      const pathname = decodeURIComponent(url.pathname);
      let requestedFile = pathname === '/' ? resolve(distDir, 'index.html') : resolve(distDir, `.${pathname}`);
      if (requestedFile !== distDir && !requestedFile.startsWith(`${distDir}${sep}`)) return json(response, 400, { error: 'Invalid path.' });
      try {
        let contents;
        try { contents = await readFile(requestedFile); }
        catch {
          if (url.pathname.includes('.')) throw new Error('Static file not found');
          requestedFile = resolve(distDir, 'index.html');
          contents = await readFile(requestedFile);
        }
        const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon' };
        response.writeHead(200, { 'Content-Type': types[requestedFile.slice(requestedFile.lastIndexOf('.'))] || 'application/octet-stream' });
        return response.end(contents);
      } catch {
        return json(response, 404, { error: 'Not found.' });
      }
    }

    return json(response, 404, { error: 'Not found.' });
  } catch {
    return json(response, 400, { error: 'The request could not be completed.' });
  }
});

const port = Number(process.env.PORT || process.env.TELEGRAM_SERVER_PORT || 3002);
server.listen(port, process.env.PORT ? '0.0.0.0' : '127.0.0.1', () => console.log(`Cinema account server listening on port ${port}`));
