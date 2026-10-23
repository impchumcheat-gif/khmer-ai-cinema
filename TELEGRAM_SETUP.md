# ABA payment review flow

This project uses personal KHQR, so ABA deposits are not verified automatically. Telegram messages are payment requests only; check the ABA transaction list before approving any request.

## Configure secrets

In the project root `.env`, set these values:

```env
TELEGRAM_BOT_TOKEN=your_private_bot_token
TELEGRAM_CHAT_ID=your_private_chat_id
ADMIN_PASSWORD=choose_a_long_private_password
RESEND_API_KEY=re_your_resend_api_key
EMAIL_FROM=Khmer AI Cinema <accounts@your-verified-domain.com>
APP_URL=http://localhost:5173
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
GOOGLE_REDIRECT_URI=http://localhost:5173/api/auth/google/callback
```

Keep the bot token, Resend API key and admin password private. `.env` is ignored by Git. Restart the app after changing it. For production, verify your sending domain in Resend and set `EMAIL_FROM` to an address on that domain. On Render, the app uses Render's public HTTPS URL for email links unless you set `APP_URL` explicitly.

## Customer account and payment flow

1. The customer creates an account with a name, email and password, then opens the one-hour verification link sent by email before signing in.
2. Paid films and VIP checkout require an account. Free films remain available without an account.
3. The payment request is linked to the signed-in account. The owner receives the account name/email, item, amount and order ID in Telegram when the bot is configured.
4. The customer pays using the personal KHQR and checks the request status from their signed-in browser.

## Admin flow

1. Open Admin from the app settings and enter `ADMIN_PASSWORD`.
2. Load payment requests.
3. Verify the amount and transaction in ABA yourself.
4. Approve only the matching request. The customer can then check their order status in the same browser and unlock the movie.

The API stores account password hashes, orders, sessions and access grants in the SQLite database at `server/data/app-data.sqlite`. Passwords and email action tokens are never stored as plain text. Existing `app-data.json` content is migrated on startup. The Render blueprint in `render.yaml` mounts a persistent disk at this folder and serves the built frontend and API together over Render HTTPS.

Customers can use “Forgot your password?” to receive a one-hour password reset link. Verification and reset links require `RESEND_API_KEY` and a verified `EMAIL_FROM` sender. To deploy, connect this repository to Render using its Blueprint flow, then enter the secrets marked `sync: false` in the Render dashboard. Create/verify your sender domain in Resend and use its sender address for `EMAIL_FROM`. Keep the persistent disk attached to the service so SQLite data survives deploys. Back up the database disk regularly.

## Google / Gmail sign-in

The “Continue with Gmail” button uses Google OAuth and asks the visitor to select a Google account. Create a Google OAuth client with application type **Web application** in Google Cloud Console. Add `http://localhost:5173` as an authorized JavaScript origin and `http://localhost:5173/api/auth/google/callback` as an authorized redirect URI for local development. Add the generated client ID and client secret to `.env`. For Render, add the site's HTTPS origin and `https://YOUR-RENDER-DOMAIN/api/auth/google/callback` to the OAuth client, then set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` in Render. The email must be verified by Google; matching verified email addresses connect to the same customer account.
