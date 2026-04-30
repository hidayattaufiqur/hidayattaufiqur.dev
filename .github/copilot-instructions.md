# Copilot Instructions for hidayattaufiqur.dev

Purpose: Provide repository-specific guidance for GitHub Copilot / Copilot CLI sessions so suggestions and automated edits align with project conventions.

---

## Build, test, and lint commands
- Development: `npm run dev` (starts Astro dev server on port 1977)
- Build: `npm run build` (runs `node scripts/gen-woff2.js && astro build && node scripts/postbuild.js`)
- Preview production build: `npm run preview` (runs `astro preview`)
- Lint: `npm run lint` (runs `eslint .`)
- Lint fix: `npm run lint:fix` (runs `eslint . --fix`)

Notes:
- To run a single test or script: this project doesn't include a test framework by default. For ad-hoc scripts, run `node scripts/<name>.js` (e.g., `node scripts/gen-woff2.js`).

---

## High-level architecture
- Framework: Astro (output: static) with Vue 3 SFC support via `@astrojs/vue`.
- Pages: `src/pages/` contains Astro page entries. Each page can import Vue components.
- Components: `src/components/` contains Vue SFC components (Composition API with `<script setup>`).
- Layouts: `src/layouts/` provide shared page scaffolding.
- Styling: UnoCSS (configured in `uno.config.ts`) used for utility classes and shortcuts. Iconify collections are bundled for predictable icon availability.
- Content: Markdown/MDX support via `@astrojs/mdx` with Shiki themes configured in `astro.config.ts`.
- Integrations & Build hooks:
  - `scripts/gen-woff2.js` converts fonts to woff2 before build.
  - `scripts/postbuild.js` runs after build for any post-processing.
- External data: Photography feature fetches images from Google Drive using environment variables typed in `src/env.d.ts` and referenced in `src/utils` and `src/pages/photography` (see `FEATURES.md` for details).

---

## Key conventions and patterns
- TypeScript strict mode and path alias: `@/*` → `src/*` (see `tsconfig.json`). Use explicit types where appropriate.
- Vue style: Composition API with `<script setup>` and PascalCase component names.
- File naming: Components use kebab-case filenames but export PascalCase names.
- UnoCSS shortcuts: Custom shortcuts in `uno.config.ts` (e.g., `nav-link`, `text-main`) are used widely—prefer them over ad-hoc utility classes.
- Icons: Use `i-` prefixed icon classes (Iconify) and prefer bundled collections (`simple-icons`, `logos`) to avoid runtime surprises.
- Linting hooks: `simple-git-hooks` + `lint-staged` auto-run `npm run lint:fix` on staged files. Keep lint rules intact to avoid failing pre-commit hooks.
- Fonts: The build process generates woff2 with `scripts/gen-woff2.js`; don't remove or bypass this step.
- Photography / Drive integration:
  - Public client-safe env vars: `PUBLIC_GOOGLE_API_KEY`, `PUBLIC_GOOGLE_DRIVE_FOLDER_ID` (documented in FEATURES.md).
  - Code expects Drive `thumbnailLink` and uses `=s600`/`=s1600` sizing; preserve URL parameter handling.
- No tests by default: Add test tooling explicitly if adding tests (prefer Vitest/Jest + appropriate config). There are no test scripts in package.json.

---

## Files and AI assistants to incorporate
- AGENTS.md: contains previous agent guidance — keep relevant instructions when composing AI actions.
- FEATURES.md: details photography and Drive integration behavior; copy essential env var names or behavior when modifying those features.

If other AI assistant configs are present, include their instructions (none of the listed files are present besides AGENTS.md). If adding new automation, update this file.

---

## Recommendations for Copilot sessions
- Respect existing npm scripts and build steps; do not remove `gen-woff2.js` or `postbuild.js` without matching behavior.
- When adding new scripts or CI, update `simple-git-hooks` and `lint-staged` accordingly.
- For changes affecting public client env vars, update `src/env.d.ts` and FEATURES.md.
- Use `@/*` imports to keep paths consistent.

---

Co-authored tooling note: this project uses `simple-git-hooks` and `lint-staged` to auto-fix lint errors on commit—ensure edits are lint-clean or include lint fixes in the same change.

---

Would you like assistance configuring any MCP servers (e.g., Playwright) for this project? If so, mention which kind of server you'd like to add.
