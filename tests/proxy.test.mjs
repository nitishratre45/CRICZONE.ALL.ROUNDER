import test from "node:test";
import assert from "node:assert/strict";
import {
  allowedHosts,
  validateTarget,
  rewriteHlsPlaylist,
  rewriteDashManifest,
  onRequest
} from "../functions/api/proxy.js";

const hosts = allowedHosts({ PROXY_ALLOWED_HOSTS: "media.example.test" });

test("accepts only allowlisted HTTPS hostnames", () => {
  assert.equal(validateTarget("https://media.example.test/live.m3u8", hosts).hostname, "media.example.test");
  for (const url of [
    "http://media.example.test/live.m3u8",
    "https://not-allowed.example/live.m3u8",
    "https://user:pass@media.example.test/live.m3u8",
    "https://127.0.0.1/private",
    "https://192.168.1.10/private",
    "file:///etc/passwd"
  ]) assert.throws(() => validateTarget(url, hosts));
});

test("rewrites HLS child playlists, segments and URI attributes", () => {
  const input = [
    "#EXTM3U",
    '#EXT-X-KEY:METHOD=AES-128,URI="../keys/key.bin"',
    "#EXTINF:6.0,",
    "segments/one.ts"
  ].join("\n");
  const output = rewriteHlsPlaylist(input, "https://media.example.test/live/main.m3u8", "https://criczone.pages.dev/api/proxy");
  assert.match(output, /api\/proxy\?u=https%3A%2F%2Fmedia\.example\.test%2Fkeys%2Fkey\.bin/);
  assert.match(output, /api\/proxy\?u=https%3A%2F%2Fmedia\.example\.test%2Flive%2Fsegments%2Fone\.ts/);
});

test("rewrites DASH BaseURL and preserves template placeholders", () => {
  const input = '<MPD><BaseURL>chunks/</BaseURL><SegmentTemplate media="seg-$Number$.m4s" initialization="init.mp4"/></MPD>';
  const output = rewriteDashManifest(input, "https://media.example.test/path/manifest.mpd", "https://criczone.pages.dev/api/proxy");
  assert.match(output, /api\/proxy\?u=https%3A%2F%2Fmedia\.example\.test%2Fpath%2Fchunks%2F/);
  assert.match(output, /seg-\$Number\$\.m4s/);
  assert.match(output, /initialization="https:\/\/criczone\.pages\.dev\/api\/proxy\?u=/);
});

test("forwards byte ranges and preserves 206 response headers", async () => {
  const originalFetch = globalThis.fetch;
  let seenHeaders;
  globalThis.fetch = async (_url, init) => {
    seenHeaders = new Headers(init.headers);
    return new Response("partial", { status: 206, headers: {
      "Content-Type": "video/mp2t",
      "Content-Range": "bytes 0-6/100",
      "Accept-Ranges": "bytes"
    }});
  };
  try {
    const request = new Request("https://criczone.pages.dev/api/proxy?u=" + encodeURIComponent("https://media.example.test/chunk.ts"), {
      headers: { Range: "bytes=0-6", "CF-Connecting-IP": "203.0.113.9" }
    });
    const response = await onRequest({ request, env: { PROXY_ALLOWED_HOSTS: "media.example.test" } });
    assert.equal(response.status, 206);
    assert.equal(seenHeaders.get("Range"), "bytes=0-6");
    assert.equal(response.headers.get("Content-Range"), "bytes 0-6/100");
    assert.equal(response.headers.get("Accept-Ranges"), "bytes");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("blocks redirect to a hostname outside the allowlist", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, {
    status: 302,
    headers: { Location: "https://evil.example/steal" }
  });
  try {
    const request = new Request("https://criczone.pages.dev/api/proxy?u=" + encodeURIComponent("https://media.example.test/live.m3u8"));
    const response = await onRequest({ request, env: { PROXY_ALLOWED_HOSTS: "media.example.test" } });
    assert.equal(response.status, 502);
    assert.match(await response.text(), /Proxy upstream request failed/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("supports HEAD without returning a body", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => new Response(null, {
    status: 200,
    headers: { "Content-Type": "video/mp2t", "Content-Length": "1234" }
  });
  try {
    const request = new Request("https://criczone.pages.dev/api/proxy?u=" + encodeURIComponent("https://media.example.test/chunk.ts"), { method: "HEAD" });
    const response = await onRequest({ request, env: { PROXY_ALLOWED_HOSTS: "media.example.test" } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Content-Length"), "1234");
    assert.equal(await response.text(), "");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
