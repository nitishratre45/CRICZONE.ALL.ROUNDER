# Approve existing Telegram channel join requests

The Telegram Bot API webhook in `functions/api/telegram/ai.js` can approve **new** `chat_join_request` updates, but it cannot enumerate the channel's old pending requests. This utility uses Telegram's MTProto API through GramJS to handle requests that are already pending.

## Requirements

- The Telegram account used to sign in must be an administrator/owner of the channel and have permission to manage join requests.
- Create Telegram API credentials at https://my.telegram.org (API development tools).
- Node.js 18 or newer.

## Install

From the repository root:

```bash
npm install telegram input
```

## First login

Set the environment variables:

- `TG_API_ID`: API ID from my.telegram.org
- `TG_API_HASH`: API hash from my.telegram.org
- `TG_CHANNEL`: channel username (for example `@yourchannel`) or numeric channel ID

Then run:

```bash
node tools/telegram-approve-pending.mjs
```

The first run asks for your phone number, Telegram login code, and 2-step verification password if enabled. It prints a GramJS session string after login. Keep that string private and store it as `TG_SESSION` for later runs. Anyone with this session string may be able to access your Telegram account. Never commit it to GitHub or send it to anyone.

## Approve all existing pending requests

First run without flags to perform a dry run and inspect the pending count. Then, after confirming the channel is correct, run:

```bash
node tools/telegram-approve-pending.mjs --all --confirm
```

This invokes Telegram's MTProto bulk-approval method for all pending requests in the selected channel. It is not the same as the Bot API webhook and does not require the bot to receive the original join-request updates.

## Optional: sequential approval mode

To approve requests individually instead of using the bulk method:

```bash
node tools/telegram-approve-pending.mjs --confirm
```

Optional environment variables:

- `TG_DELAY_MS`: delay between individual approvals (default 1200ms; minimum 800ms)
- `TG_LIMIT`: maximum number of requests to approve in one sequential run

## Important

- The script defaults to dry-run mode. It will not approve anyone unless `--confirm` is supplied.
- `--all --confirm` approves every pending request in the selected channel, so verify the channel identity before running it.
- Telegram may impose temporary flood limits. The script waits and retries when Telegram returns a FloodWait.
- The script must be run on a trusted computer. Do not put `TG_API_HASH` or `TG_SESSION` in client-side code, Cloudflare Pages variables exposed to the browser, or a public repository.
