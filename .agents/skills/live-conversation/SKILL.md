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

## 5. Validation
Run the pre-flight skill validator (`npm run validate:skills`, governed by `skill-engineering`) in Windows PowerShell before finalizing any changes to this skill.
