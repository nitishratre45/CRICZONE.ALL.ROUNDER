# Proxy hardening and regression tests

## Run the tests

Use Node.js 20 or newer:

```bash
node --experimental-default-type=module --test tests/proxy.test.mjs
```

The tests cover HTTPS host allowlisting, private-IP rejection, HLS child/key/segment rewriting, DASH manifest/template rewriting, byte-range forwarding, redirect rejection, and HEAD responses.

## Cloudflare Pages environment

Configure these values for the Pages project before production rollout:

- `PROXY_ALLOWED_HOSTS`: comma-separated exact trusted host roots not already in the built-in list. Add only stream/CDN hosts actually observed in the approved Sony playlist. Do not add broad shared hosts such as `pages.dev` or `workers.dev`.
- `PROXY_ALLOWED_ORIGINS`: comma-separated exact browser origins allowed to call the proxy. Defaults include `https://criczone.pages.dev`, `https://criczone.online`, and `https://www.criczone.online`.
- `PROXY_RATE_LIMIT`: bind a Cloudflare KV namespace with this exact binding name to enable shared best-effort per-IP rate counters (90 requests per 60-second bucket).

KV is eventually consistent and its get/put increment is not atomic. For robust production abuse protection, replace this with a Durable Object rate limiter and add Cloudflare WAF/rate-limiting rules. Without the KV binding, the code uses an isolate-local fallback that is not globally reliable.

## Rollout checks still required

The repository previously had its GitHub Actions workflows removed, so these tests are not currently wired to CI. Run the command above locally or add a dedicated test workflow if CI is re-enabled.

Before production rollout, verify the actual playlist's child-hostnames and add only those hosts to `PROXY_ALLOWED_HOSTS`. Then test a real HLS master/variant playlist, AES key request if used, media segment, DASH MPD, Shaka Player playback, HLS.js playback, seek/range requests, and signed URL expiry. The committed tests are deterministic regression tests; they do not prove that a third-party live stream is currently available or that every provider-specific DASH manifest is compatible.
