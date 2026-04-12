AGENT INSTRUCTIONS

Use these agent instructions to help you win the hackathon.

- Use agent skills frequently
- Data hackathon with a curated business case. Final presentation due at April 14 2026 at 10am.
- Judges want real answers. Explain what you did why you chose it.
- Five minute presentation plus five minute Q&A. Three or four slides only. Make slides with Chronicle at https://chroniclehq.com

## App stack (repository)

- The demo app lives in `app/`: **Next.js + TypeScript** (no JavaScript-only source files for app logic; keep `tsconfig` strictness as the project already does).
- **Deployment target: Vercel.** Prefer `vercel.json` or `vercel.ts` project config and environment variables via Vercel when deploying this frontend.

## Vercel MCP (required for agent work on deploys and platform tasks)

This workspace registers the official **Vercel MCP** in `.cursor/mcp.json` (`https://mcp.vercel.com`).

When you work on anything involving **Vercel projects, deployments, domains, build or runtime logs, or Vercel documentation**, use the **Vercel MCP tools** first (e.g. list projects, get deployment, build logs, runtime logs, search docs). Do not guess platform behavior if the MCP can return current facts.

If the user has not completed OAuth, tell them once: open Cursor MCP settings, select the `vercel` server, and finish **Needs login** so tools are available.
