# UI tooling setup status

Status verified on 2026-10-03.

## shadcn

- Installed shadcn CLI 4.21.1 and prepared `components.json` for React/Vite, Tailwind 4, TypeScript, Lucide, and the existing `src/components/ui` directory.
- Added the existing `@/*` source alias to the root `tsconfig.json` so the CLI can discover it.
- Selected `new-york` with inline color utilities (`cssVariables: false`). The initial setup preserved existing components. The studio redesign now uses Astryx and its semantic Tailwind token bridge.
- Configured the Codex MCP server to run the project's installed shadcn CLI directly, avoiding a fresh npm download on every startup.
- MCP tools were verified after restarting Codex.

Sources inspected: [components.json](https://ui.shadcn.com/docs/components-json), [MCP](https://ui.shadcn.com/docs/mcp), through the official `shadcn-ui/ui` repository at revision `295a1f114a138f23b5dfee0e0c6812394dfeb90c`.

## UI UX Pro Max

- Installed at `C:/Users/Dizzy/.codex/skills/ui-ux-pro-max` from revision `09170eec67eefd46a7ae85de61b40c194020f997`.
- Read the upstream README and skill. The complete skill directory is `.claude/skills/ui-ux-pro-max` in [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill), revision `09170eec67eefd46a7ae85de61b40c194020f997`.
- Python is available at `C:/Python313/python.exe`. The installed local search script executes successfully.

## Astryx

- Installed `@astryxdesign/core`, `@stylexjs/stylex`, `@astryxdesign/theme-neutral`, and `@astryxdesign/cli` 0.6.5.
- Ran `astryx init --all`, which created `AGENTS.md` and `theme.template.ts`.
- Added the `npm run astryx -- <command>` project command.
- Configured the official remote MCP endpoint `https://astryx.atmeta.com/mcp`; verified after restart.
- The redesigned UI imports Astryx reset/styles through ordered CSS layers and uses a tenant theme from `src/app/theme.ts`.

## Playwright CLI

- Installed global `@playwright/cli` 0.1.22.
- Added the global npm binary directory to the user's `PATH`.
- The built-in Codex browser and Playwright CLI are separate browser-control options; both are available.

## Host installation history

- Browser control and approval-backed commands were verified during this redesign.
- Codex host configuration is external to this repository and may change independently. No further host configuration changes are required by this UI update.
