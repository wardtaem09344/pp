# Main flows and acceptance checks

## Baseline inspected before editing
- The archive renders an Arabic RTL sign-in screen, with a signup toggle.
- There is no backend in the original repository; authentication and all `/api` calls fail.
- Source-inspected intended flows: chat history/search/pin/rename/archive/delete, message edit/regenerate, language/theme settings, chat/agent mode, image attachments, file preview/download, admin.
- Baseline git commit: 404a9d6.

## Authentication
- Create an account with a valid email and password (minimum 10 characters).
- Expect a Free account, never owner privileges; wrong password fails.
- Log out and verify protected API endpoints return 401.
- Reload works through the secure session cookie on a standalone host; a cookie-blocking iframe may require login again. Visitor IDs are not authentication.

## Plans
- Open the profile menu, then Upgrade plan.
- Expect Free, Plus, Pro, Ultra comparison, actual daily usage, no fake checkout.
- Only an owner can assign plans. Direct API attempts by ordinary users must fail.
- Exhausted quotas and blocked modes/models/tools must be enforced by the server.

## Chat
- Without a configured model: submitting a message displays a clear provider-not-configured message, without invented assistant output or quota consumption.
- With a test provider: chat creates messages and history, reloads, supports rename/pin/archive/search, and edits/regenerates without cross-user leakage.
- Production provider round-trip is a separate check and cannot be inferred from test fixtures.

## Agent
- Switch Chat -> Agent -> Chat using the visible tabs.
- A permitted agent task exposes real strategy, profile, status, execution evidence, tool outcomes, and downloads.
- Free is gated; Plus/Pro/Ultra enforce different step, feature, concurrency and resource ceilings.
- Cancel stops further work. Interrupted runs can be explicitly resumed.
- Missing tools/providers are reported, never simulated.
- Compare routing evaluations for factual, debugging, research, artifact, data, mixed-domain, and Arabic tasks.

## Other retained controls
- Exercise new chat, sidebar, profile, settings, Arabic/English, light/dark, history search, temporary chat and library.
- Unsupported image generation must report unavailable, not show a pretend generated image.
- File download and ZIP must enforce ownership and safe paths.
- Desktop 1440px -> mobile 375px -> desktop; inspect initial view and dense plan modal.
- Check page errors and console failures after changes and after deployment.

## Deployment
- Deploy actual source, backend, and static bundle.
- Inspect returned hosted URL in a fresh browser context.
- Permanent infrastructure needs production API credentials and durable database configuration.
- Do not call a static preview a working production agent.

## Execution record: 2026-10-23

- Automated regression: 62 tests passed on Python 3.11 and 3.14 after dependency upgrades and the SSE terminal-event fix. JavaScript syntax checks and Python compilation passed.
- Dependency audit: 22 resolved dependencies, no known vulnerabilities reported at check time. This does not cover vendored frontend code or constitute an independent security review.
- Browser: synthetic QA account signup, restored session after reload, Free plan display, all four plan columns on desktop, provider-not-configured error and Free agent rejection.
- Browser: Chat/Agent toggle, Arabic -> English -> Arabic, light -> dark -> light, new chat, temporary toggle in both directions, library empty state, Free memory gate, model menu's honest unconfigured state, runs empty state, and logout.
- Browser: desktop -> 375px mobile -> desktop; real horizontal mouse-wheel scrolling reached the Plus/Pro/Ultra columns; no document overflow at 1440x700. Page-error listener recorded no JavaScript page errors.
- Search modal opened and accepted input; full populated history search, edit/regenerate, and archive/pin flows are covered by API regression tests, not signed off against a live model in the browser.
- Owner plan management, workflow evidence, actual artifact tools, cancel/resume protection and cross-user access are covered by deterministic API/tool tests. Production-model UI success remains unverified.
- Expected HTTP 403 (Free agent) and 503 (missing provider) are intentional failure states, not a successful live AI round trip.
- Independent security reviewer failed to complete. Vercel deployment returned 403 and reconnection failed; database and corrected provider credentials remain unavailable.
- Final uploaded preview opened in a fresh browser context: APEX title, explicit unconfigured-provider/storage notice, synthetic account signup, all four plan headings, and logout passed with no page errors. Do not infer durable hosting from a working sandbox preview.
- Initial GitHub runs exposed a final-event streaming race in the artifact pipeline. The fix drains persisted events before closing SSE and writes terminal state only after final evidence. The artifact regression now requires both evaluation and done events.
