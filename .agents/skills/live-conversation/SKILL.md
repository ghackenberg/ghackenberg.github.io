---
name: live-conversation
description: Keep the primary agent maximally available as a lightweight conversational control plane during live voice or interactive sessions while delegating all execution to autonomous background subagents.
---

# Live Conversation (Lightweight Conversational Control Plane)

Load this skill during live voice or rapid interactive conversations to preserve low-latency responsiveness and prevent context saturation in the primary session.

## 1. Conversational Control Plane Only
- **Stay Maximally Responsive**: The primary agent focuses exclusively on listening, clarifying intent, aligning on decisions, and giving brief, spoken-friendly status updates.
- **Zero Heavy Local Execution**: NEVER perform heavy file edits, multi-file code changes, deep research sweeps, or long-running builds directly in the primary conversation.
- **Zero Polling**: After dispatching background work, conclude your turn and stay available for the user; rely on reactive notifications when subagents report back.

## 2. Immediate Subagent Delegation (Background Staff)
- **Delegate Immediately**: Route all file mutations, coding, research, asset generation, and verification tasks to background workers via `invoke_subagent`.
- **Nested Orchestration When Needed**: For multi-step or multi-skill initiatives, dispatch a dedicated coordinator subagent (`define_subagent` with `EnableSubagentTools: true` and `EnableWriteTools: true`) so complex orchestration stays off the main conversational thread.
- **Reuse Active Workers**: When following up on an active worker's scope, send instructions via `send_message` rather than spawning duplicate subagents.

## 3. Context Hygiene & Autonomous Workers
- **Full Autonomy**: Instruct every subagent to execute end-to-end autonomously—reading relevant skills, resolving minor issues, and coordinating sub-workers if needed—without bouncing trivial decisions back to the main thread.
- **Compact Status Contract**: Require every subagent to return **only a 2–4 line status summary** covering:
  1. Outcome (completed / blocked).
  2. Changed files (paths).
  3. Verification result (commands run and pass/fail).
  4. Blocking question (only if user input is strictly required).
- **Lean Main Memory**: Keep raw logs, large diffs, and exhaustive file dumps inside subagent contexts so the primary conversation remains fast and uncluttered.

## 4. Fast Feedback Loops vs. Final Gate
During rapid live iteration, prioritize speed while maintaining safety in Windows PowerShell (use `;` for command sequencing, never Bash `&&`):
- **Fast Targeted Checks (Live Iteration)**: Instruct subagents to run fast targeted checks (`npm run lint`, `npm run typecheck`, plus relevant domain or color linters) after edits.
- **Full Release Gate (Finalize / Pre-Merge)**: Reserve the full verification suite (`npm run verify`, governed by `build-engineering`) for when the user is satisfied or ready to finalize.

## 5. Distributed CPU & AI Load Scheduling
When orchestrating multiple background tasks, designate a **Scheduler / Coordinator Agent** to govern both local machine load and AI concurrency, and enforce distributed CPU-aware self-throttling across all workers:
- **Pre-Flight CPU Gate (Mandatory Before Heavy Commands)**: Before launching any **Heavy** local command, every agent MUST check local CPU load in Windows PowerShell:
  ```powershell
  (Get-CimInstance Win32_Processor).LoadPercentage
  ```
  and verify no other Node/Astro build is active. If CPU load exceeds 75% or another heavy build is running, defer and re-check via `schedule` (`DurationSeconds`) instead of running concurrently.
- **Single Heavy-Job Rule**: Run at most **1 CPU-heavy verification or build process** at a time while a local dev server is running; queue subsequent heavy verifications sequentially.
- **AI Concurrency Throttling**: Limit parallel subagent fan-out to only what is genuinely needed, avoiding speculative or redundant background workers.

### Script Cost Classification

| Tier | Typical Runtime | Concurrency Policy | Scripts |
| :--- | :--- | :--- | :--- |
| **Light** | `<3s` | Safe to run freely | `validate:skills`, `lint:domains`, `lint:colors`, `lint:styles`, `lint:svgs`, `validate:citations:syntax` |
| **Medium** | `10–30s` | Limit parallel overlap | `lint`, `typecheck`, `lint:posts` |
| **Heavy** | `60–240s` | Strictly serialized (max 1 active; CPU check required) | `validate:vis`, `astro build`, `npm run verify` |

## 6. Validation
Run the pre-flight skill validator (`npm run validate:skills`, governed by `skill-engineering`) in Windows PowerShell before finalizing any changes to this skill.
