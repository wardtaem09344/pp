# DeepSeek Harness on Render

This repository also contains the original source bundle under `deepseek-harness-source/`. The deployment image deliberately builds the upstream DeepSeek Harness repository at the pinned commit:

- Upstream: https://github.com/deepseek-ai/deepseek-harness
- Commit: `ce7073d51254c26cd63b22a60835b8f948deb447`
- Version: `0.2.2-alpha.2`

## Deploy

Create a Render **Docker Web Service** from this repository's `main` branch. The included `render.yaml` is the Blueprint equivalent. The free plan is selected for temporary/testing use; free services can sleep when idle and are not intended for always-on operation.

Render supplies `PORT` and `RENDER_EXTERNAL_URL`. The entrypoint discovers the container's concrete IP address, binds to it (not a wildcard address), and trusts the public Render hostname for browser Host checks.

## DeepSeek model connection

The pinned Harness build already includes its native DeepSeek Messages provider. It reads:

- `DEEPSEEK_API_KEY` — your provider-issued API key (set this as a secret in Render; never commit it).
- `DEEPSEEK_BASE_URL` — optional Messages-compatible API root. If omitted, Harness uses the official DeepSeek endpoint.

For this pinned adapter, the endpoint must speak **Anthropic Messages**. The adapter appends `/v1/messages` (and `/v1/files` for image uploads) to the configured root. Do not put an OpenAI Chat Completions URL or an unverified `/raw` Worker URL here. A gateway needs to explicitly document Messages compatibility before it can be used.

In Render, open the service's **Environment** settings and add `DEEPSEEK_API_KEY` as a secret. Leave `DEEPSEEK_BASE_URL` unset to use the official endpoint, or set it only to a verified Messages-compatible root. After changing environment variables, redeploy the service.

## Other supplied endpoints

The previously supplied `ai-seek` route is a private app protocol, not a documented Harness provider protocol. Its exposed session token must not be reused or committed. The image-generation Worker is a separate image API, not a chat-model provider. The Qwen and ChatDeep projects use their own site-specific APIs and session/anti-bot flows; they are not plug-and-play Harness model providers. They are deliberately not wired into the active model config until their supported public protocol and authentication are documented and verified.

## Credentials

Do not commit API keys, access tokens, cookies, or session files. Keep secrets in Render's Environment settings. `PUBLIC_URL` is optional; when unset, the entrypoint uses `RENDER_EXTERNAL_URL`.

## Runtime notes

The free service has ephemeral storage. Local sessions and workspace files may be lost when the instance restarts or is redeployed. This configuration does not add a persistent disk or claim that the service remains awake.
