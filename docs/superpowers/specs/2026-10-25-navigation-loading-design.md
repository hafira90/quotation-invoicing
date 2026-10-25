# Navigation Loading Feedback Design

## Intent

Give authenticated users visible circular feedback when an in-app route is waiting on the server or a form/action is doing asynchronous work, without implying that instant local interactions are loading.

## Goals

- Show an accessible circular spinner in the authenticated page area while route content loads.
- Show a spinner and busy state on buttons while their form action is pending.
- Show loading feedback for existing asynchronous quotation, customer, and product actions.
- Keep menus, dialog toggles, and other local-only clicks responsive without a false loading indicator.

## Non-goals

- No blocking full-screen overlay or artificial delay on every click.
- No new progress-bar dependency or navigation library.
- No change to the underlying data actions or route behavior.

## Approaches

1. Add route-level loading UI only. This follows Next.js conventions, but misses form submissions and mutations that stay on the same route.
2. Combine an authenticated route `loading.tsx` with pending-state spinners on form and async-action controls. This uses Next.js/React pending signals already present in the app and is the recommended choice.
3. Add a global click listener that shows a spinner for every click. This cannot reliably tell local interactions from asynchronous work and can leave stale indicators, so it is not suitable.

## Behavior and constraints

- Place the route fallback at `src/app/(app)/loading.tsx`, so authenticated route content can stream while the shared app shell remains in place.
- Extend the shared Button with an explicit loading prop. Existing form components already track their own submit state and spinner.
- Wire the existing async quotation actions and customer/product status actions to visible loading feedback.
- Use accessible status/busy attributes; preserve existing success and error feedback.
- Do not install dependencies.

## Verification

- Unit-test server-rendered loader markup and the shared Button loading state.
- Run the focused test, TypeScript check, lint on changed files, and production build.
