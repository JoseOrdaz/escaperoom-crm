# Repository Guidelines

## Project Structure & Module Organization

This is a Next.js 15 App Router application using React 19 and TypeScript. Pages and layouts live in `src/app/`; API endpoints use `src/app/api/**/route.ts`. Shared and feature-specific React components live in `src/components/`, with reusable UI primitives in `src/components/ui/`. Database and utility code is in `src/lib/`; static files and uploaded images are in `public/` and `public/uploads/`. Authentication routing is handled by the root `middleware.ts`.

## Build, Test, and Development Commands

- `npm ci` installs the dependencies recorded in `package-lock.json`.
- `npm run dev` starts the Turbopack development server at `http://localhost:3000`.
- `npm run build` creates a production build; this script explicitly skips linting.
- `npm start` serves an existing production build.
- `npm run lint` runs ESLint; run it separately from the build.
- `npm run check-unused` checks for unused dependencies with depcheck.

## Coding Style & Naming Conventions

Follow the surrounding TypeScript and TSX style: two-space indentation, semicolons, and descriptive component and function names. Use PascalCase for React components and kebab-case for component filenames, such as `reservation-modal.tsx`. Keep Next.js route filenames such as `page.tsx`, `layout.tsx`, and `route.ts`. Use the `@/` alias for imports from `src/`. ESLint extends Next.js Core Web Vitals and TypeScript configurations; TypeScript runs in strict mode.

## Testing Guidelines

No test framework, test script, or coverage threshold is currently configured. For changes, run `npm run lint` and `npm run build`, then manually exercise the affected pages and API flows. If adding automated tests, document their setup and run command and place them near the behavior they cover.

## Commit & Pull Request Guidelines

Recent commits use short, descriptive Spanish summaries, for example `Ajustar enlaces` or `añadir cupones`. Follow that concise style and describe the change in the subject. Pull requests should explain the behavior changed, list verification performed, link any relevant issue, and include screenshots for visible UI changes.

## Configuration & Security

Set `MONGODB_URI` in a local environment file before exercising database-backed features. The database helper connects to `escape_crm`. Keep credentials out of commits and review changes to authentication, uploads, and customer data carefully.
