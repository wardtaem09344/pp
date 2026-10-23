# APEX implementation map

## Baseline

The original repository at commit `404a9d6` contained a README and `_bundle (3).zip`. The archive contained a vanilla JavaScript frontend and rendering libraries. It called `/api/chat`, authentication, admin, chat-storage and file-download endpoints, but did not include their implementations or provider credentials. The original ZIP is preserved, unchanged, as a versioned baseline.

## Layer responsibilities

| Layer | Implementation | Real behavior |
|---|---|---|
| Intent and operating profiles | `server/strategy.py` | Bilingual, multi-label routing with evidence-based limitations and versioned strategy selection |
| Orchestration | `server/engine.py` | Variable tool loop, no forced universal plan sequence, bounded model steps, time budget, cancellation and checkpoint persistence |
| Task decomposition | `server/tools.py`, `task_nodes` | Incremental dependency graph updates, cycle detection and real tool-result references required for completion |
| Provider adapters | `server/provider.py` | Native Gemini function calls, ai-seek SSE with validated JSON tool-request protocol, optional OpenAI-compatible adapter |
| Available capabilities | `ToolRegistry.inventory()` | Actual schemas, risk levels, permissions, idempotency and timeouts; unavailable tools are not advertised |
| Tool execution | `server/tools.py` | Restricted arithmetic, task-local files, exact edits, file validators, allowlisted HTTPS retrieval, configured Brave Search |
| Permissions | `server/auth.py`, `server/plans.py`, route guards | Opaque sessions, owner-only administration, tenant scoping, atomic quota/concurrency reservations and per-iteration model/tool permissions |
| Memory | `memories`, retrieval in `engine.py`, `/api/memory` | Explicit preferences/project memory, scoped validated observations, provenance/confidence/version, selective retrieval, opt-in and deletion |
| Durable state | `server/db.py` | Additive schema; SQLite development or independently managed PostgreSQL production |
| Evaluation | `tests/`, runtime evaluation events | Deterministic routing/regression cases plus execution-derived tool failures, token usage when reported, latency and actual validation evidence |
| UI and observability | `app/app.js`, `app/apex.css` | Plan comparison/usage, run list, cancel/resume, evidence viewer, memory management, admin plan assignment |
| Deployment | `vercel.json`, `api/index.py`, `Dockerfile` | Serverless-request-scoped execution or single-worker long-lived hosting; no fake durable background workers |

## Dynamic execution examples

- A greeting routes to direct completion without a plan or invented tool activity.
- A debugging request selects a hypothesis-driven profile; its tool loop is free to inspect, test assumptions, patch, or stop on missing capabilities.
- An artifact request can create files and use actual parsers. A structure check does not imply a browser run.
- A mixed research/code/deployment task composes profiles, but explicitly blocks deployment because no authorized deployment connector exists in the hosted agent.
- A complex dependency graph can branch and merge. It cannot complete nodes with missing dependencies or fabricated evidence identifiers.

The strategy module is a transparent heuristic baseline, not a claim of universal semantic classification. Domain instructions guide the model, while permissions and execution facts remain enforced in code.

## Persistence and recovery

Each run stores objective, routing decision, model/context, completed tool results, current model messages, progress and evidence outside temporary model context. File artifacts and tool-call outcomes are stored independently of browser state. A restart marks unfinished long-lived-worker runs interrupted; Pro/Ultra users may explicitly resume eligible runs.

Model histories retain governing constraints and the current objective. Compaction preserves complete tool-call/result groups rather than orphaning results. The database and files remain the authority when context has been compressed.

Tool-call idempotency prevents duplicate successful operations on replay. An uncertain non-idempotent edit requires inspection rather than blind retry. Pending mixed tool batches that do not form a complete provider conversation are blocked for manual review; they are not advertised as fully automatic crash recovery.

## Safety boundary

External pages, files, retrieved preferences and model outputs are untrusted data. The agent cannot add a tool by naming it, use a model outside its plan, elevate a role through preferences, use a URL visitor identifier as authentication, access another user's files, or create a successful execution event from prose alone.

Network retrieval is limited to administrator-approved HTTPS domains, public resolved addresses, text/JSON responses, explicit size/time limits and no automatic redirects. Deployment, email, purchases, shell and browser tools are absent. Adding them requires a real adapter plus independently enforced permission and approval rules.

## Measurability

The repository contains representative Arabic/English routing cases and functional fixtures exercising the real orchestration and tool paths. Provider fixtures test protocol translation, not remote model intelligence. Runtime evaluation records actual tools and resource counters; monetary cost is explicitly not estimated when pricing evidence is absent.

The changes establish infrastructure for controlled evaluation. They do not prove a numerical quality improvement over the original app: the original backend was missing and a paired live-model baseline could not be run from that archive.

## Remaining infrastructure-dependent capabilities

Production needs a managed database, valid provider credentials in the hosting platform, verified account/model access, and backups. Longer autonomous jobs need an external queue and worker service; real parallel specialists need actual worker infrastructure and integration tests. Payment processing needs a verified payment provider and signed webhook path. Image generation, browser automation, shell execution and additional document formats require real adapters, not extra prompt text.
