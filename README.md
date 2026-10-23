# Khmer AI Cinema

## Deploying the website and API

The frontend can be deployed to Vercel, but the account, Google sign-in, payment, and admin APIs run in `server/index.js`. Deploy that Node.js server separately and configure Vercel to proxy `/api/*` requests to it.

### 1. Deploy the API server to Render

1. Create a Render **Blueprint** from this repository and apply the existing `render.yaml`.
2. Wait for the `khmer-ai-cinema` web service to finish its first deploy. The Blueprint provisions a persistent disk for the SQLite database; keep that disk attached to retain accounts and payment records.
3. In the Render service environment, set `APP_URL` to the public Vercel website origin, for example `https://khmer-ai-cinema.vercel.app` (no trailing slash).
4. Set `ADMIN_PASSWORD` to a strong, private password. Configure the Google OAuth, email, and Telegram values if those features are needed.

### 2. Configure Vercel

1. Deploy this repository as a Vite project in Vercel. Use `npm run build` as the build command and `dist` as the output directory.
2. Add the environment variable `API_BACKEND_URL` to the Vercel project, set to the Render service origin, for example `https://khmer-ai-cinema.onrender.com` (no trailing slash).
3. Redeploy Vercel after setting the environment variable. The function in `api/[...path].js` forwards API requests, login cookies, and redirects to the Render server.

For Google sign-in, register this callback URL in the Google OAuth client:

```text
https://YOUR-VERCEL-DOMAIN/api/auth/google/callback
```

Set `APP_URL` on Render to the same Vercel origin. If `GOOGLE_REDIRECT_URI` is set, it must equal the callback URL above. Do not put credentials or passwords in this file or in frontend environment variables.

### Local development

Run `npm run dev` to start the API server and Vite frontend together. Vite proxies `/api` requests to the local API.
