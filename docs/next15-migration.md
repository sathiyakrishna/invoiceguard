# Next.js 15.5 migration plan (not started)

**Why:** `next@14.2.35` is the last 14.x release. `npm audit` still reports 23 advisories on it (2 critical, 8 high) whose fixes exist only in 15.5.x or later: Server Components and Server Actions denial of service, SSRF (WebSocket upgrades, rewrites, custom-server Server Actions), the image-optimizer and Windows-host remote code execution, and others. `15.5.28` (the `backport` dist-tag) is above every fixed-in version the audit listed (the highest is 15.5.24). Re-run `npm audit` before starting; the list changes.

**Target:** `next@15.5.x` (exact pin). Not 16: it also renames `middleware.ts` to `proxy.ts` and is a larger jump.

Install with the pinned npm (`packageManager` in `package.json`, npm 10.9.9) so the lockfile stays valid for CI.

## 1. Bump and see what breaks
1. `npm install next@15.5.28 --save-exact`. Keep `react` and `react-dom` at 18.3.1 first: 15.5's peer range still allows `^18.2`.
2. `npx tsc --noEmit`, `npm test`, `npm run build` (CI runs the build on Linux; local builds fail on Windows at `/opengraph-image`).
3. Run the app and click through: landing, login, queue, a review page, dashboard (including the Excel download), settings, upload.
4. If React 18 causes problems, move to `react@19` and `react-dom@19` with `@types/react` and `@types/react-dom` 19.

## 2. Async request APIs (sync access still works in 15, with a dev warning; fix it now or it breaks in 16)
- `lib/supabase/server.ts`: `cookies()` becomes `await cookies()`, so `createClient()` and `requireUser()` become async. About 17 files call them (all `app/api/**` routes, the `(app)` pages and layout, `app/auth/callback`, `middleware.ts` does not use them). Add `await` at each call site.
- `searchParams` is a Promise in `app/(app)/dashboard/page.tsx`, `app/(app)/queue/page.tsx` and `app/login/page.tsx`. `queue/page.tsx` also passes `searchParams` to a helper.
- `params` is a Promise in `app/(app)/queue/[id]/page.tsx`, `app/api/explain/[id]/route.ts` and `app/api/flags/[id]/route.ts`.
- The codemod does most of this: `npx @next/codemod@canary next-async-request-api .`. Review its diff and resolve any `UnsafeUnwrapped` casts it leaves.

## 3. React 19 follow-ups (only if you upgrade React)
- `app/login/LoginForm.tsx`: `useFormState` becomes `useActionState` (the old name still works but is deprecated).
- Check `useFormStatus` use in `SettingsButtons.tsx` and the login form.

## 4. Checked and not affected
- Caching defaults (`fetch` and GET route handlers no longer cached): routes are `force-dynamic` or read cookies; the only server `fetch` is to OpenAI.
- `middleware.ts` is unchanged in 15. `geo`/`ip` on `NextRequest`, `experimental-edge`, `next/font`, Speed Insights and `@next/font` are not used.
- `images: { unoptimized: true }` and the `webpack` alias in `next.config.mjs` keep working.
- Node 22 satisfies `^18.18 || >=20`.

## 5. Done when
- `tsc`, tests and CI (including `npm run build`) pass, `npm ci --dry-run` passes with npm 10.9.9 for a Linux target, and `npm audit` shows no remaining `next` advisories.
- Signed-in smoke test passes, including the account deletion dialog and the Excel download.
