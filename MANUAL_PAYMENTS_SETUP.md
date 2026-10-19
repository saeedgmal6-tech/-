# Manual Orange Cash payments for Lahzetna

Each gift costs 20 EGP. Gifts remain unpublished until an administrator confirms the transfer.

## Required Vercel environment variables

Set these for **Production** (and Preview if you test previews):

- `ORANGE_CASH_NUMBER`: the Orange Cash receiving wallet number.
- `SUPABASE_SERVICE_ROLE_KEY`: the server-only service-role key from the Supabase project. Never prefix it with `VITE_` and never put it in frontend code.
- Existing `VITE_SUPABASE_URL` should point to the Supabase project.
- Existing `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `ADMIN_SESSION_SECRET` must be configured for the protected admin dashboard.

Optional Telegram notification:
- `TELEGRAM_BOT_TOKEN`: token from the Telegram BotFather bot you create.
- `TELEGRAM_CHAT_ID`: your Telegram chat ID. Start the bot and send it a message first; the bot cannot initiate a conversation until you do.

After changing environment variables, redeploy the Vercel project.

## Supabase

Run `supabase/payments.sql` in the Supabase SQL Editor. This migration adds the manual-review status and transaction reference to `gift_orders`. It does not publish any pending gift.

## How it works

1. The customer transfers 20 EGP to the configured Orange Cash number.
2. They enter the sender's phone number and transaction reference.
3. The server creates an `awaiting_review` order. It is not added to `gifts`.
4. If Telegram credentials are configured, a new-order message is sent.
5. In `/admin`, approve to publish the gift or reject to leave it unpublished.

Telegram alerts are optional; the pending order is always available in the protected admin dashboard.
