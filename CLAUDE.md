# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

See also `AGENTS.md` (repository guidelines: style, commit conventions, PR expectations). Key points are repeated here.

## Commands

- `npm run dev` — Turbopack dev server on http://localhost:3000 (needs `MONGODB_URI` in `.env`).
- `npm run build` — production build. Note: `next.config.ts` sets `typescript.ignoreBuildErrors` and `eslint.ignoreDuringBuilds`, so **a passing build does not mean the code type-checks**. Use `npx tsc --noEmit` to check types.
- `npm run lint` — ESLint (Next core-web-vitals + TypeScript).
- `npm run check-unused` — depcheck.

### Tests

There is no test script; tests use Node's built-in runner (`node:test`) in `tests/`:

- Unit (no server needed): `node --test tests/password-policy.test.mjs`
- Integration (`*.integration.mjs`) hit a running app over HTTP and **mutate data** (create/delete employees, change passwords, upload avatars). They require `TEST_BASE_URL` pointing at an isolated environment seeded with users `admin` and `gm` (password `test-only-password`). Never point them at production:
  `TEST_BASE_URL=http://localhost:3000 node --test tests/profile.integration.mjs`

## Architecture

Next.js 15 App Router + React 19, TypeScript strict, Tailwind v4, shadcn/ui primitives in `src/components/ui/`. UI text, comments and error messages are in Spanish.

### Data layer

- MongoDB via the native driver only: `connectDB()` in `src/lib/db.ts` returns a cached `Db` for database `escape_crm`. `mongoose` and `next-auth` are dependencies but unused.
- No models/schemas layer: route handlers call `db.collection("...")` directly and validate input with `zod` inline. Collections include `employees`, `profile_sessions`, `reservations`, `rooms`, `customers`, `coupons`, `uploads`, `work_schedules`.
- Validate route ids with a 24-hex check before `new ObjectId(...)` (see `safeObjectId` in `src/app/api/reservations/route.ts`).
- Employees are soft-deleted (`deletedAt`); queries must filter `deletedAt: { $exists: false }` and project out `password`.
- File uploads are stored base64 in the `uploads` collection and served by `GET /api/uploads/[id]` (not written to `public/uploads`).

### Auth (two cookies — important)

`POST /api/auth/login` sets:
1. `session_user` — non-httpOnly JSON (`id, name, email, role`). Readable/forgeable by the client; used only for UI (`header.tsx`, `dashboard/layout.tsx`) and coarse routing in root `middleware.ts` — **note: Next.js only loads middleware from `src/middleware.ts` when using a `src/` dir, so the root file is currently not active**; client layouts redirect to `/login`, but API routes are not protected unless they call `currentProfile()`.
2. `profile_session` — httpOnly random token, SHA-256 hashed in `profile_sessions` (`src/lib/profile-session.ts`). This is the trustworthy one.

Server-side authorization must use `currentProfile()` (+ `sameOrigin(request)` for mutations), never `session_user`. See the `admin()` helper in `src/app/api/employees/route.ts`. Integration tests explicitly check that forged `session_user` cookies are rejected. Many older routes (reservations, rooms, customers, coupons) do not yet check auth beyond middleware.

Roles, permissions and escapes: `src/lib/permissions.ts` (client-safe) defines the `Permission` list, what a `game_master` may do (view/create/edit reservations, notify customers, check-in), `employeeEscapes()` (employees have `escapes: ("Fobia" | "Action Gates")[]`; legacy `escape` string still read; an admin with none sees all) and `escapeOfRoom()` (room `escape` field, falling back to the room name). Server routes use `requireAccess(req, perm)`, `scopedRoomIds()` and `canUseRoom()` from `src/lib/access.ts` so every list/edit is limited to the user's escapes. Client pages read the session via `useSession()` (`src/components/session-provider.tsx`, filled by `dashboard/layout.tsx` from `GET /api/profile`), which also drives the sidebar and page guards (`canOpenPage`). Anonymous requests: `GET /api/rooms` returns all rooms and `GET /api/reservations?roomId=` returns only busy times (public booking wizard); everything else needs a session.

### Public booking vs. dashboard

- `/dashboard/*` — internal CRM (reservations calendar, rooms, customers, coupons, employees/check-in, profile). Pages are mostly client components fetching `/api/*`.
- `/bookings/*` and `/iframe/action-gates` — customer-facing booking wizard (`src/components/bookings.tsx`, `BookingWizard`) embedded for two venues, **Fobia** and **Action Gates**. Each page passes hard-coded room ObjectIds.
- `/cancelada` — landing after the emailed cancellation link `GET /api/reservations/[id]/cancel`.

### Reservations domain

- Rooms can have `linkedRooms` (physically shared spaces): availability/conflict checks query `roomId: { $in: [roomId, ...linkedRooms] }`.
- Status values: `pendiente | confirmada | cancelada`; calendar views exclude `cancelada`.
- Dates are built as UTC from `YYYY-MM-DD` + `HH:mm` (`toDateAtLocal`), i.e. wall-clock times stored as UTC — don't apply timezone conversion.
- Confirmation/cancellation emails are sent from the route handlers through `createMailer()` (`src/lib/mailer.ts`): Brevo HTTP API when `BREVO_API_KEY` (or an `xkeysib-` key in `SMTP_PASS`) is set, otherwise nodemailer SMTP with `SMTP_*`. See `.env.example`. Venue (Fobia vs Action Gates) is chosen by room name. Redirects use the absolute production URL `https://escaperoom-crm.vercel.app`.
- Coupons: `/api/coupons/validate` checks a code, `/api/coupons/use` consumes it.
- Prices: always go through `priceFor()` in `src/lib/pricing.ts` (room `priceTable` + optional `schedule.priceRules` per date/time). Editing can override with a manual paid price (`priceManual`, `priceNote`).

### Emails

- Every send goes through `sendLoggedEmail()` (`src/lib/email-log.ts`), which records it in `email_logs` (`trigger`: `auto` | `manual` | `newsletter`). Reservation templates for edit/manual sends live in `src/lib/reservation-emails.ts`; venue branding in `src/lib/venues.ts` (client-safe).
- Newsletter: `src/lib/newsletter.ts` (recipients, signed unsubscribe links) + `src/lib/newsletter-template.ts` (client-safe, used for live preview). Campaigns are stored in `email_campaigns`; opted-out customers have `newsletterOptOut: true` and must never be sent to.
- `/dashboard/emails` shows reservation emails (auto/manual) and the newsletter composer/history.

## Conventions

- Kebab-case component filenames, PascalCase components, `@/` alias for `src/`.
- Route-private components go in `_components/` next to the page.
- Commits: short Spanish summaries (e.g. `añadir cupones`).
