# UI change log — 7 October 2026

This document records the responsiveness and task-management work completed in this chat, plus the follow-up investigation of the missing stylesheet message. It describes the current implementation, its validation, and the requirements for future UI changes.

## Scope and folder restrictions

All edits were made inside `C:\analytical_rx\UI`. The backend task controllers, models, services, and documentation were read as references. No edits were made to `data-platform` or `analytical-rx-documentation`.

Existing authentication, dashboards, workflow previews, and user draft features were retained. The task module adds backend writes for task creation, status updates, and comments. Dashboard, workflow, and user-administration previews continue to use their existing preview behavior.

## Shared responsiveness

Added `app/responsive.css` and imported it after the existing shared styles in `app/layout.tsx`.

- Added safe-area spacing and dynamic viewport heights for phone and tablet layouts.
- Kept browser zoom enabled and exported a device-width viewport with `viewportFit: "cover"`.
- Made headings, long names, descriptions, filters, and action groups wrap within available space.
- Adapted dashboard metric grids, user-management columns, workflow layouts, dialogs, and login cards to narrow screens and landscape orientation.
- Used 16px form controls on touch devices and small screens to avoid iOS input-focus zoom.
- Enlarged primary touch controls to at least 44px and added visible keyboard focus styles.
- Kept wide tables scrollable inside their panels. Their scroll regions are keyboard focusable and have accessible labels.
- Added `position: relative` to `.table-scroll` to contain absolutely positioned screen-reader text that was causing document overflow in Chromium and WebKit.
- Reduced navigation transitions when reduced motion is requested.

Navigation switches to a drawer at widths of 1024px or less. Opening the drawer locks background scrolling while preserving the previous scroll position, makes the main content inert, moves focus into the drawer, and traps Tab navigation. Escape closes it. Closing restores body styles and focus to the menu button on compact layouts. Resizing to desktop closes the drawer.

Shared layout breakpoints include 1280px, 1180px, 1024px, 780px, 520px, and 360px. Task-specific breakpoints are described below.

## Task management screens

Added **Tasks** to the navigation of all nine supported role workspaces. The section renders inside the existing role page; it does not introduce a separate task page URL. Moving between list, creation, and detail views focuses the section heading and scrolls to the top.

### List and filters

- Load visible tasks from the backend.
- Filter on the server by pharmacy and status.
- Search loaded task titles, descriptions, IDs, pharmacies, and assignee IDs locally.
- Filter the loaded result by assigned-to-me or created-by-me.
- Show open, overdue, blocked, and completed counts for the loaded result.
- Show priority, due date, assignee, pharmacy, and status on each task card.
- Provide refresh, reset, loading, empty, error, and retry states.
- Explain the backend's 100-task result limit; show a limit notice when the result reaches 100.

### Creation

The form accepts a required title, pharmacy, and existing assignee user ID; optional description and due date/time; and a priority of Low, Medium, High, or Urgent. Medium is the default.

**Assign to me** fills the verified current user's ID. There is no searchable assignee-directory API, so assignment uses a numeric user ID. The backend validates that the assignee is active and has task access to the chosen pharmacy. Creation is disabled when accessible pharmacies cannot be loaded or none are available.

Title, description, and comment limits match the backend: 200, 4000, and 2000 characters respectively. IDs must be positive, safe JavaScript integers. Local due dates are converted to ISO timestamps with an offset expressed as UTC. Validation errors preserve form values. Submission disables form controls to prevent duplicate requests. A successful creation opens the new task's detail view.

### Details and status

Details show the description, pharmacy, priority, assignee, creator, due date, created/updated dates, and completed date when present. Other users are identified by user ID because the backend does not supply their display names in task responses. The current user is shown by name.

Supported statuses are `TODO`, `IN_PROGRESS`, `BLOCKED`, `COMPLETED`, `SKIPPED`, and `CANCELED`. Update controls require effective `task.update` permission and either assignment to the current user or an Owner/Store Manager role. Completed, skipped, and canceled tasks are closed and cannot be reopened.

A successful status update replaces the displayed task with the backend response and refreshes the list. A closed-task conflict (HTTP 409) reloads details while keeping the error visible. A manual detail refresh is also available.

### Comments

Details load the chronological comment thread and provide comment creation for users with `task.comment`. Successful posting clears the draft, shows confirmation, and reloads the conversation to include concurrent team updates. Comment loading failures have a separate retry action. Users without comment permission see a read-only message.

### Task layout

Added `app/tasks.css`, scoped to task components. It supplies responsive task cards, summary grids, filters, forms, facts, and the comments panel. Details stack at 1180px or less; task cards adapt at 780px; forms and filters stack at 520px. Controls use readable mobile sizing, touch targets, focus indicators, and wrapping for long content.

## API integration and authentication

Added same-origin Next.js API routes for all six task operations and two supporting context endpoints.

| Method | UI route | Backend route | Screen use |
| --- | --- | --- | --- |
| GET | `/api/tasks` | `/api/v1/tasks` | Task list and pharmacy/status filters |
| POST | `/api/tasks` | `/api/v1/tasks` | Create task |
| GET | `/api/tasks/{id}` | `/api/v1/tasks/{id}` | Task details |
| PATCH | `/api/tasks/{id}/status` | `/api/v1/tasks/{id}/status` | Change status |
| GET | `/api/tasks/{id}/comments` | `/api/v1/tasks/{id}/comments` | Read comments |
| POST | `/api/tasks/{id}/comments` | `/api/v1/tasks/{id}/comments` | Add comment |
| GET | `/api/me` | `/api/v1/me` | Effective permissions and current user |
| GET | `/api/pharmacies` | `/api/v1/pharmacies` | Accessible pharmacy choices |

`lib/auth/proxy.ts` verifies the bearer JWT before forwarding to the configured `DATA_PLATFORM_API_URL`. It forwards the same bearer token, disables caching, rejects redirects, and applies a 10-second upstream timeout. Mutation validators retain only supported fields; list forwarding retains only pharmacy/status filters. Client-supplied tenant/schema fields are not forwarded.

The proxy maps backend 400, 401, 403, 404, 409, and 429 responses to actionable messages. Other failures return 502 without exposing raw backend errors. An unconfirmed write instructs the user to refresh before trying again.

`components/auth-provider.tsx` now exposes a stable `apiFetch` helper for local API routes, with bearer and JSON headers. A 401 clears the tab token and returns to login. Effective permissions come from `/api/me`; selecting a dashboard role does not grant API permissions. The backend remains authoritative for tenant scope, pharmacy visibility, and authorization.

## Role availability and backend limits

The following reflects the backend's current role grants. Effective permissions returned for a particular user take precedence, including combined permissions for users with multiple roles.

| Role | Tasks navigation | Read | Create | Update/comment |
| --- | --- | --- | --- | --- |
| Owner | Yes | Yes | Yes | Yes, with update eligibility rules |
| Store Manager | Yes | Yes | Yes | Yes, with update eligibility rules |
| Pharmacist | Yes | Yes | Yes | Status updates for own assignments; comments permitted |
| Technician | Yes | Yes | No | Status updates for own assignments; comments permitted |
| Bookkeeper | Yes | Yes | Yes | Status updates for own assignments; comments permitted |
| Business Development | Yes | Yes | Yes | Status updates for own assignments; comments permitted |
| Compliance Admin | Yes | No | No | No |
| Tenant Admin | Yes | No | No | No |
| Internal Platform Admin | Yes | No | No | No |

Accounts without task permissions see an access message and can check access again. Giving these roles actual API access requires backend permission changes, which were outside the authorized UI-only scope.

Other current limits:

- Lists return at most 100 tasks; there is no pagination API. Counts, search, and assignment filters describe only the loaded result.
- There are no task deletion, reassignment, title-editing, or description-editing endpoints in the supplied controller.
- Dates display in the device time zone.
- Unsafe numeric IDs in responses are rejected rather than silently rounded.
- Browser tests use mocked API responses; end-to-end writes against a running backend were not performed.
- Mobile emulation does not establish compatibility with every physical device, keyboard, or browser version.

## File inventory

Paths in this table are relative to `C:\analytical_rx\UI`.

| File | Change |
| --- | --- |
| `app/layout.tsx` | Import responsive/task styles and export viewport settings |
| `app/responsive.css` | New shared responsive and accessibility styles |
| `app/tasks.css` | New task-specific responsive styles |
| `components/pharmacy-os.tsx` | Drawer behavior, Tasks navigation/icon, breadcrumb, and section rendering |
| `components/role-dashboard.tsx` | Accessible, keyboard-focusable table scroll region |
| `components/user-management.tsx` | Accessible scroll regions for draft and CSV tables |
| `components/auth-provider.tsx` | Authenticated local API helper and 401 handling |
| `components/task-management.tsx` | New list, creation, detail, status, and comment views |
| `lib/types.ts` | Add Tasks to the workspace section type |
| `lib/tasks.ts` | New contracts, enums, validators, response parsers, permission/date helpers |
| `lib/auth/proxy.ts` | New authenticated backend forwarding and error handling |
| `app/api/me/route.ts` | New current-user context route |
| `app/api/pharmacies/route.ts` | New pharmacy route |
| `app/api/tasks/route.ts` | New list/create routes |
| `app/api/tasks/[id]/route.ts` | New detail route |
| `app/api/tasks/[id]/status/route.ts` | New status route |
| `app/api/tasks/[id]/comments/route.ts` | New comment routes |
| `tests/tasks.test.mjs` | Six new task validation, authorization, forwarding, and error tests |
| `tests/browser/responsive.spec.mjs` | Six shared responsive browser scenarios |
| `tests/browser/tasks.spec.mjs` | Six task browser scenarios, including all roles and API operations |
| `playwright.config.mjs` | Five browser/device projects and production preview server |
| `scripts/test-responsive.mjs` | Playwright launcher with project-local browser downloads |
| `package.json`, `package-lock.json` | Playwright dev dependency, browser scripts, and task unit-test inclusion |
| `.gitignore` | Ignore Playwright reports and test output |
| `README.md` | Usage, API mapping, permissions, responsiveness, and verification documentation |
| `docs/ui-change-log-2026-10-07.md` | This record of the completed changes |

## Verification completed

| Check | Recorded result |
| --- | --- |
| `npm test` | 21 tests passed, including six new task tests |
| `npm run typecheck` | Passed |
| `npm run build` | Passed, including the new API routes |
| `npm run test:responsive` | 60 tests passed: 12 scenarios across five browser/device projects |
| Final creation/detail visual check | Two additional tests passed in desktop Chromium and iPhone WebKit |
| `git diff --check` | Passed; Git emitted line-ending conversion warnings |

Browser projects: desktop Chromium, desktop Firefox, Android Chromium (Pixel 7 emulation), iPhone WebKit (iPhone 13 emulation), and iPad WebKit (iPad Mini emulation). Shared dashboard checks cover widths from 320px to 2560px; task checks cover 320px to 1920px, including portrait and landscape layouts. Screenshots were reviewed for desktop details and mobile creation/details.

The browser scenarios cover role visibility, filters/search, all six task API contracts, creation, status updates, comments, read-only access, missing pharmacies, retry states, closed-task conflicts, expired sessions, and existing responsive UI flows. Unit tests execute the UI forwarding routes with a mocked backend and real JWT verification.

Reproduce from the UI folder:

```sh
npm ci
npm run test:responsive:install
npm test
npm run typecheck
npm run build
npm run test:responsive
```

Browser downloads are kept in ignored `node_modules`. Screenshots and traces are kept in ignored `test-results`; reports are ignored as well. The browser suite starts a production preview on port 3100 and uses mocked authentication/API responses, so it does not need backend credentials.

## Missing stylesheet terminal message

The reported error was `Can't resolve './tasks.css'` at the import in `app/layout.tsx`. On investigation, `app/tasks.css` existed and the relative import matched. A request to `http://127.0.0.1:3000/login` returned HTTP 200 with login content and no matching module error.

The timing of file creation was the likely explanation, but the exact cause was not established. No source change was needed in that follow-up. Old terminal errors remain visible after successful compilation. If the error returns, verify the stylesheet exists, refresh the browser, and restart the UI development server with `Ctrl+C` followed by `npm run dev`.

## Requirements for future UI implementations

- Continue editing only `UI`; use the other two folders as read-only references.
- Preserve responsiveness in every new screen and component, including narrow phones, tablets, landscape layouts, and desktop widths.
- Reuse the shared viewport, safe-area, touch-size, input-size, wrapping, focus, and drawer conventions.
- Keep document overflow contained; wide tables should scroll within an accessible panel.
- Validate changed flows in Chromium, Firefox, and mobile WebKit emulation, and check physical devices where available.
- Use verified bearer API routes and effective backend permissions for future data integrations.

