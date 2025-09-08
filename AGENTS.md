# Agent Guidelines for hidayattaufiqur.dev

## Build Commands
- **Development**: `npm run dev` (astro dev --host)
- **Build**: `npm run build` (astro build)
- **Preview**: `npm run preview` (astro preview)
- **Lint**: `npm run lint` (eslint .)
- **Lint Fix**: `npm run lint:fix` (eslint . --fix)

## Code Style Guidelines

### Framework & Language
- **Vue 3** with Composition API using `<script setup>`
- **TypeScript** with strict mode enabled
- **Astro** for static generation with server output

### Imports & Modules
- Use path aliases: `@/*` for `src/*`
- Group imports: external libraries first, then internal modules
- Import Vue composables from `@vueuse/core`

### Naming Conventions
- **Components**: PascalCase (e.g., `Header.vue`, `ListPosts.vue`)
- **Functions**: camelCase (e.g., `getPosts`, `sortPostsByDate`)
- **Types**: PascalCase with descriptive names
- **Files**: kebab-case for components, camelCase for utilities

### TypeScript
- Use explicit types for function parameters and return values
- Leverage Astro's content collections with proper typing
- Enable `strictNullChecks` for null safety

### Styling
- **UnoCSS** with custom shortcuts defined in `uno.config.ts`
- Use semantic class names and custom shortcuts (e.g., `nav-link`, `text-main`)
- Dark mode support with `dark:` prefixes
- Iconify icons with `i-` prefix

### Error Handling
- Use optional chaining (`?.`) for safe property access
- Type guard functions for runtime type checking
- Graceful fallbacks for DOM queries

### Accessibility
- Include `aria-label` attributes for interactive elements
- Use semantic HTML elements
- Proper focus management for dynamic content

### Git Workflow
- Pre-commit hooks run linting via `lint-staged`
- Use conventional commit messages
- Draft posts excluded from production builds
