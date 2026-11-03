# DeepSeek Harness on Render

This repository also contains the original source bundle under `deepseek-harness-source/`. The deployment image deliberately builds the upstream DeepSeek Harness repository at the pinned commit:

- Upstream: https://github.com/deepseek-ai/deepseek-harness
- Commit: `ce7073d51254c26cd63b22a60835b8f948deb447`
- Version: `0.2.2-alpha.2`

## Deploy

Create a Render **Docker Web Service** from this repository's `main` branch. The included `render.yaml` is the Blueprint equivalent. The free plan is selected for temporary/testing use; free services can sleep when idle and are not intended for always-on operation.

Render supplies `PORT` and `RENDER_EXTERNAL_URL`. The entrypoint discovers the container's concrete IP address, binds to it (not a wildcard address), and trusts the public Render hostname for browser Host checks.

## Credentials

Do not commit API keys. Add `DEEPSEEK_API_KEY` as a secret environment variable in Render if the application requires it, or configure the provider in the application. `PUBLIC_URL` is optional; when unset, the entrypoint uses `RENDER_EXTERNAL_URL`.

## Runtime notes

The free service has ephemeral storage. Local sessions and workspace files may be lost when the instance restarts or is redeployed. This configuration does not add a persistent disk or claim that the service remains awake.
