---
name: tool-engineering
description: Develop, test, and maintain custom Model Context Protocol (MCP) servers, CLI tools, and deterministic automation utilities in src/tools/.
---

# Tool Engineering (MCP Servers & Custom Tooling)

This skill governs the architecture, development, testing, and lifecycle of custom Model Context Protocol (MCP) servers and developer tools in `src/tools/`.

## 1. Directory Structure & Architecture
Custom MCP servers and developer tools live under `src/tools/`:
- Entrypoint: `src/tools/<tool-name>.ts` (e.g. `src/tools/unified-analytics.ts`).
- Package entry: Configured in `package.json` under `"bin"` or `"scripts"` (e.g. `"bin": { "mcp-unified-analytics": "./src/tools/unified-analytics.ts" }`).
- Client registration: Configured in `.agents/mcp_config.json` for IDE and agent orchestration.

## 2. MCP Server Implementation Standard
Build MCP servers using the official TypeScript SDK (`@modelcontextprotocol/sdk`):
- **Transport**: Standard I/O (`StdioServerTransport`) for local, zero-overhead process spawning.
- **Strict Validation with Zod**: Every tool parameter must declare a robust Zod schema with `.describe(...)` comments so LLMs understand input constraints.
- **Error Handling**: Gracefully catch runtime errors, format actionable diagnostic messages, and return structured text/JSON payloads.
- **Stateless & Resilient**: Tools should be stateless, idempotent where applicable, and respect transient Windows file locks.

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const server = new Server({ name: "my-tool", version: "1.0.0" }, { capabilities: { tools: {} } });

// Register tool listing and call handlers with Zod schemas...
```

## 3. Rule $\rightarrow$ Tool Promotion Protocol
- **Trigger**: When an agent task or quality check requires repetitive multi-step shell commands, complex regex parsing, or heavy token consumption, it must be promoted from a prompt rule to a tool.
- **Design Process**:
  1. Specify the tool as a system RFC in `backlog/system/` (see `backlog-management`).
  2. Implement the tool in `src/tools/` or script in `src/scripts/`.
  3. Wire the tool command in `package.json`.
  4. Register the MCP server in `.agents/mcp_config.json`.
  5. Reduce the corresponding instructions in agent skills to lean invocations.

## 4. Pre-Flight Validation
Ensure new tools compile cleanly and pass architecture validation:
```powershell
npm run lint
npm run typecheck
npm run validate:architecture
```
