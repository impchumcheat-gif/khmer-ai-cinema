# Khmer AI Cinema

## Deploying the website and API

The frontend can be deployed to Vercel, but the account, Google sign-in, payment, and admin APIs run in `server/index.js`. Deploy that Node.js server separately and configure Vercel to proxy `/api/*` requests to it.

### 1. Deploy the API server to Render

1. Create a Render **Blueprint** from this repository and apply the existing `render.yaml`.
2. Wait for the `khmer-ai-cinema` web service to finish its first deploy. The persistent disk stores the SQLite database (accounts, payment records, and movie catalog). The current Blueprint uses a Starter web service and a 1 GB disk; check Render's current pricing before deploying. A free service without persistent storage can lose database changes after a restart or redeploy.
3. `APP_URL` and `GOOGLE_REDIRECT_URI` are preconfigured in `render.yaml` for `https://khmer-ai-cinema.vercel.app`. Change these values there if you use a different Vercel domain.
4. Set `ADMIN_PASSWORD` to a strong, private password. Configure `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and the email/Telegram values if those features are needed.

### 2. Configure Vercel

1. Deploy this repository as a Vite project in Vercel. Use `npm run build` as the build command and `dist` as the output directory.
2. Add the environment variable `API_BACKEND_URL` to the Vercel project, set to the Render service origin, for example `https://khmer-ai-cinema.onrender.com` (no trailing slash).
3. Redeploy Vercel after setting the environment variable. The function in `api/index.js` forwards API requests, login cookies, and redirects to the Render server. `vercel.json` rewrites all `/api/*` routes to that function.

For Google sign-in, register this callback URL in the Google OAuth client:

```text
https://YOUR-VERCEL-DOMAIN/api/auth/google/callback
```

Set `APP_URL` on Render to the same Vercel origin. If `GOOGLE_REDIRECT_URI` is set, it must equal the callback URL above. Do not put credentials or passwords in this file or in frontend environment variables.

### Poster catalog and Telegram delivery

Movies are stored in the Render SQLite database and are visible to every visitor. Admins can choose a JPEG, PNG, or WebP poster from their computer (up to 10 MB); poster images are stored on the Render persistent disk. A public HTTPS poster URL can also be used. Free movies can be marked **Free**; paid movies require a price. Movie videos are not uploaded or stored by the website.

Customers sign in, choose a movie, provide their Telegram username, and submit an ABA payment request. The owner verifies the payment manually in ABA, approves the order in Admin, sends the movie to the customer through Telegram, then marks the order as sent. The Telegram bot can notify the owner about new orders when `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are configured. Movie files are sent manually and are never uploaded to this website.

### Local development

Run `npm run dev` to start the API server and Vite frontend together. Vite proxies `/api` requests to the local API.
