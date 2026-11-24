#!/usr/bin/env node
/**
 * Approve existing Telegram channel join requests using MTProto (GramJS).
 *
 * Bot API cannot enumerate old pending requests. This utility must run with
 * the Telegram OWNER/ADMIN user account that can manage join requests.
 *
 * Dry run:  node tools/telegram-approve-pending.mjs
 * Approve all: node tools/telegram-approve-pending.mjs --all --confirm
 * Approve:  node tools/telegram-approve-pending.mjs --confirm
 *
 * Required environment:
 *   TG_API_ID       Telegram API ID from https://my.telegram.org
 *   TG_API_HASH     Telegram API hash from https://my.telegram.org
 *   TG_CHANNEL      @username or numeric channel ID
 * Optional:
 *   TG_SESSION      Saved GramJS StringSession (printed after first login)
 *   TG_DELAY_MS    Delay between approvals (default 1200ms)
 *   TG_LIMIT       Maximum requests to approve in this run (testing)
 */

import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import input from "input";

const apiId = Number(process.env.TG_API_ID);
const apiHash = process.env.TG_API_HASH;
const channelRef = process.env.TG_CHANNEL;
const delayMs = Math.max(800, Number(process.env.TG_DELAY_MS || 1200));
const limit = process.env.TG_LIMIT ? Math.max(1, Number(process.env.TG_LIMIT)) : Infinity;
const confirmed = process.argv.includes("--confirm");
const approveAll = process.argv.includes("--all");

if (!apiId || !apiHash || !channelRef) {
  console.error("Missing TG_API_ID, TG_API_HASH, or TG_CHANNEL environment variable.");
  process.exit(1);
}

const client = new TelegramClient(new StringSession(process.env.TG_SESSION || ""), apiId, apiHash, {
  connectionRetries: 5,
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function invokeWithFloodWait(request) {
  for (;;) {
    try {
      return await client.invoke(request);
    } catch (error) {
      const seconds = Number(error?.seconds || error?.message?.match(/FLOOD_WAIT_(\d+)/)?.[1] || 0);
      if (!seconds) throw error;
      console.warn(`Telegram rate limit: waiting ${seconds + 2}s before retry...`);
      await sleep((seconds + 2) * 1000);
    }
  }
}

await client.start({
  phoneNumber: async () => input.text("Telegram phone number: "),
  password: async () => input.text("Two-step verification password (if enabled): "),
  phoneCode: async () => input.text("Telegram login code: "),
  onError: (error) => console.error("Telegram login error:", error),
});

const savedSession = client.session.save();
if (!process.env.TG_SESSION) {
  console.log("\nLogin successful. Save this value privately as TG_SESSION (do not share it):\n");
  console.log(savedSession);
}

try {
  const peer = await client.getInputEntity(channelRef);
  const channel = await client.getEntity(channelRef);
  console.log(`\nChannel: ${channel.title || channel.username || channelRef}`);

  const pending = [];
  let offsetDate = 0;
  let offsetUser = new Api.InputUserEmpty();
  const seen = new Set();

  console.log("Reading existing pending join requests...");
  for (;;) {
    const page = await invokeWithFloodWait(new Api.messages.GetChatInviteImporters({
      peer,
      requested: true,
      offsetDate,
      offsetUser,
      limit: 100,
    }));

    const users = new Map((page.users || []).map((user) => [String(user.id), user]));
    const rows = page.importers || [];
    if (!rows.length) break;

    for (const row of rows) {
      const id = String(row.userId);
      if (!seen.has(id)) {
        seen.add(id);
        const user = users.get(id);
        if (user?.accessHash !== undefined) {
          pending.push({ userId: row.userId, accessHash: user.accessHash, date: row.date });
        } else {
          console.warn(`Skipped request ${id}: Telegram did not return an access hash.`);
        }
      }
    }

    const last = rows[rows.length - 1];
    const lastUser = users.get(String(last.userId));
    if (!lastUser || rows.length < 100) break;
    offsetDate = last.date;
    offsetUser = new Api.InputUser({ userId: lastUser.id, accessHash: lastUser.accessHash });
  }

  console.log(`Found ${pending.length} pending request(s).`);
  if (!confirmed) {
    console.log("DRY RUN ONLY — no requests were approved.");
    console.log("After checking the channel and count, rerun with --all --confirm to approve all pending requests.");
  } else if (approveAll) {
    await invokeWithFloodWait(new Api.messages.HideAllChatJoinRequests({ peer, approved: true }));
    console.log("Telegram accepted the bulk approval command for all pending requests on this channel.");
  } else {
    const batch = pending.slice(0, limit);
    let approved = 0;
    let failed = 0;
    console.log(`Starting sequential approval of ${batch.length} request(s)...`);

    for (let index = 0; index < batch.length; index++) {
      const item = batch[index];
      try {
        await invokeWithFloodWait(new Api.messages.HideChatJoinRequest({
          peer,
          userId: new Api.InputUser({ userId: item.userId, accessHash: item.accessHash }),
          approved: true,
        }));
        approved++;
      } catch (error) {
        failed++;
        console.error(`Failed user ${item.userId}:`, error?.message || error);
      }

      if ((index + 1) % 25 === 0 || index + 1 === batch.length) {
        console.log(`Progress: ${index + 1}/${batch.length} | approved: ${approved} | failed: ${failed}`);
      }
      if (index + 1 < batch.length) await sleep(delayMs);
    }

    console.log(`\nFinished. Approved: ${approved}; failed: ${failed}; scanned: ${pending.length}.`);
    if (pending.length > batch.length) {
      console.log(`Remaining scanned requests: ${pending.length - batch.length}. Run again to continue.`);
    }
  }
} finally {
  await client.disconnect();
}
