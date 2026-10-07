# AnalyticalRx UI

For the completed responsiveness and task-management work, see the [UI change log — 7 October 2026](docs/ui-change-log-2026-10-07.md). It includes the file inventory, API coverage, role permissions, verification results, limitations, and future responsiveness requirements.

AnalyticalRx UI is the frontend for a multi-tenant pharmacy operations platform. It lets users sign in through the Data Platform backend and opens a workspace based on the verified role in their JWT. Owners can view portfolio dashboards, explore the workflow studio, and prepare individual or bulk user additions.

The project uses Next.js 16.3.1 (App Router), React 19, TypeScript, and `jose` for server-side JWT verification. Authentication is connected to the backend. Dashboards default to unavailable states with optional, clearly labeled sample previews. Workflows and user administration remain frontend previews.

## Main components

| Component / folder | Purpose |
| --- | --- |
| `app/layout.tsx` | Shared page layout, global styles, and authentication provider. |
| `app/login/page.tsx`, `components/login-form.tsx` | Login screen with tenant key, email, and password. |
| `components/auth-provider.tsx` | Manages login, tab session restoration, expiry, and sign-out. |
| `app/[role]/page.tsx`, `components/role-workspace.tsx` | Role-specific pages and redirects to the user's verified workspace. |
| `components/pharmacy-os.tsx` | Main navigation, dashboards, pharmacy filters, and owner workflow studio. |
| `components/user-management.tsx` | Owner/tenant-admin form, CSV upload/review, and searchable draft user list. |
| `components/task-management.tsx` | Live task list, creation, details, status updates, and comments, available from every role's navigation. |
| `lib/tasks.ts`, `app/api/tasks/` | Task contracts, validation, and authenticated backend forwarding. |
| `app/api/me/`, `app/api/pharmacies/` | Current effective permissions and accessible pharmacy choices. |
| `lib/user-management.ts` | User validation, CSV parsing, duplicate detection, and allowed assignment roles. |
| `public/samples/users.csv` | Downloadable example for bulk user import. |
| `app/api/auth/` | Frontend server routes for backend login/logout and bearer session verification. |
| `lib/auth/session.ts` | Verifies JWT signatures and claims and extracts user/tenant context. |
| `lib/auth/backend.ts` | Resolves the backend API URL from server configuration. |
| `lib/auth/types.ts`, `lib/types.ts` | Session, role, dashboard, and workflow types. |
| `lib/data.ts` | Role labels and sample workflow definitions. |
| `app/globals.css` | Shared styling and responsive layouts. |
| `tests/` | Authentication, dashboard rendering/filtering, and CSV/user-validation tests. |

`app/page.tsx` redirects to `/login`. The former `/dev-login` page also redirects to the real login screen; its API no longer creates preview identities.

## Run locally

### Prerequisites

- Node.js 20.9.0 or newer and npm, as required by the installed Next.js package.
- A running Data Platform backend, normally at `http://127.0.0.1:8080`.
- An existing tenant and active user account with a supported role.
- The same JWT signing secret, issuer, and audience used by the backend.
- AWS CLI and access to Secrets Manager if retrieving the signing secret from AWS.

The backend needs its database connection and SSM tunnel running separately. See [backend setup](../data-platform/README.md). The UI itself does not need database credentials.

### 1. Install dependencies

In Windows Command Prompt:

```bat
cd /d C:\analytical_rx\UI
npm ci
```

### 2. Configure the UI

On first setup, create `.env.local` from `.env.example`. If `.env.local` already exists, update it rather than overwriting its settings.

```bat
copy .env.example .env.local
```

Use these settings for the current Spring Boot backend:

```dotenv
DATA_PLATFORM_API_URL=http://127.0.0.1:8080
AUTH_JWT_ISSUER=analyticalrx-api
AUTH_JWT_AUDIENCE=analyticalrx-frontend
AUTH_JWT_SECRET_ENCODING=base64
AUTH_ROLE_CLAIM=roles
AUTH_NAME_CLAIM=display_name
AUTH_STORE_CLAIM=store_id
```

Leave `AUTH_JWKS_URL` unset for this HMAC-based backend. Supply the backend's Base64 signing secret as `JWT_SIGNING_SECRET` in the frontend terminal, or as `AUTH_JWT_SECRET` in the ignored `.env.local`. `JWT_SIGNING_SECRET` takes precedence. The decoded secret must be at least 32 bytes; keep it server-side and never use a `NEXT_PUBLIC_` prefix.

### 3. Retrieve the existing AWS signing secret

Run this in the same Command Prompt that will start the UI:

```bat
set "AWS_PROFILE=vishnu-analyticalrx"
set "AWS_REGION=us-east-1"

for /f "delims=" %S in ('aws secretsmanager get-secret-value --region us-east-1 --secret-id analytical-rx/phase1/dev/jwt-signing-secret --query SecretString --output text') do set "JWT_SIGNING_SECRET=%S"

if defined JWT_SIGNING_SECRET (echo JWT secret loaded) else (echo JWT secret missing)
```

Use your configured AWS profile if it differs. This retrieves the stored secret; it does not create a new one. Use `%%S` in a `.bat` file. Environment variables set in another terminal are not inherited by this terminal.

PowerShell alternative:

```powershell
cd C:\analytical_rx\UI
$env:AWS_PROFILE = 'vishnu-analyticalrx'
$env:JWT_SIGNING_SECRET = aws secretsmanager get-secret-value `
  --region us-east-1 `
  --secret-id analytical-rx/phase1/dev/jwt-signing-secret `
  --query SecretString --output text
```

### 4. Start and sign in

```bat
npm run dev
```

Open [http://localhost:3000/login](http://localhost:3000/login), or use the port printed in the terminal. Enter the tenant key (for example, `analyticalrx-dev`) and an existing backend user's email/password. The UI does not seed accounts. Owners can access **Administration → User management** after login.

Restart the UI after changing environment settings. To run a production build locally, use `npm run build` followed by `npm start`, with the same environment configuration.

Existing cookie-preview configurations must be replaced with the settings in `.env.example`; old development signing secrets will not verify backend tokens. No real signing secret is committed.

## Bearer login and role routing

The login form posts tenantKey, email, and password to `POST /api/auth/login`. This server route requires a nonempty tenant key and forwards the credentials to `POST /api/v1/auth/login`, verifies the returned JWT signature, issuer, audience, expiry, subject, and issued-at claims, then returns the bearer token and a safe user projection.

The browser stores the access token in sessionStorage for the current tab. On reload it sends `Authorization: Bearer <token>` to `GET /api/auth/session` and waits for server verification before rendering a workspace. It never chooses a role by decoding an unverified token. Signing secrets never reach the browser.

Verified backend `roles` and `display_name` claims drive the workspace:

| JWT role | Page | Workspace |
| --- | --- | --- |
| OWNER | /owner | Portfolio dashboard, automation controls, and user management |
| BOOKKEEPER | /bookkeeper | Financial dashboard |
| TECHNICIAN | /technician | Operations activity and work readiness |
| STORE_MANAGER | /store_manager | Store operations and exceptions |
| PHARMACIST | /pharmacist | Prescription activity and clinical readiness |
| COMPLIANCE_ADMIN | /compliance_admin | Source health and compliance readiness |
| BUSINESS_DEVELOPMENT | /business_development | Prescriber activity and growth readiness |
| TENANT_ADMIN | /tenant_admin | Tenant administration and user drafts |
| INTERNAL_PLATFORM_ADMIN | /internal_platform_admin | Tenant registry and platform setup metadata |

Role matching is case-insensitive. All supported roles in the verified JWT are retained. The initial workspace follows the order above; multi-role users can select any granted workspace in the sidebar. Visiting an ungranted role URL redirects to the primary verified workspace. Accounts with no supported role receive an access error. / and /dev-login lead to /login.

Expiry clears the local token and returns to login. Sign out clears the local session immediately and sends the bearer token through `POST /api/auth/logout` to the backend logout endpoint. The current backend logout endpoint does not revoke JWTs.

The server proxy avoids requiring browser CORS access to Spring Boot. For an asymmetric identity provider, configure `AUTH_JWKS_URL` instead of a shared secret. Claim paths are configurable using `AUTH_ROLE_CLAIM`, `AUTH_NAME_CLAIM`, and `AUTH_STORE_CLAIM`.

## Verification

- `npm run typecheck`
- `npm test`: real JWT verification and auth route tests using an isolated backend response
- `npm run build`
- `GET /api/health`: deployment health check

### Responsive browser checks

The shared responsive styles in `app/responsive.css` cover phone, tablet,
landscape, and desktop layouts. They include safe-area spacing, dynamic viewport
heights, 44px touch controls, readable mobile inputs, wrapping filters, and
horizontal scrolling inside tables. Browser zoom remains enabled. Navigation
switches to a drawer at 1024px; the drawer manages focus, Escape, background
scrolling, and resizing back to desktop.

Run the browser suite against a production build:

```sh
npm run test:responsive:install
npm run build
npm run test:responsive
```

Playwright checks Chromium and Firefox desktop layouts, Android Chromium,
and iPhone/iPad WebKit emulation. It covers all nine dashboards, record dialogs,
navigation, user forms and CSV previews, workflow actions, and widths from 320
to 2560 pixels. Authentication responses are intercepted within the test browser;
the suite does not require a backend, credentials, or JWT secrets. Browser
downloads stay in ignored `node_modules`; failure screenshots and traces stay
in ignored `test-results`. Emulation supplements physical device checks; it does
not reproduce every mobile keyboard or installed browser version.

## Troubleshooting

| Message / symptom | Check |
| --- | --- |
| Invalid email or password | The backend returned 401. Check the tenant key, account, password, and backend logs. |
| Cannot reach the sign-in service | Confirm the backend is running and `DATA_PLATFORM_API_URL` points to it. |
| Sign-in verification is not configured | Load a valid signing secret in the frontend's startup terminal. |
| The sign-in token could not be verified | Match the backend secret, Base64 encoding, issuer, and audience; restart the UI. |
| No supported dashboard role | The JWT must contain at least one of the nine supported roles listed above. |
| User management is missing | Sign in with an OWNER or TENANT_ADMIN account. |

User creation roles (`technician`, `book_keeper`, `store_manager`) are draft assignment values. They do not create backend accounts; book_keeper must eventually map to backend BOOKKEEPER.

## Current limits

### Task management

Choose **Tasks** in any role's navigation. This section connects to the existing
Data Platform APIs using the current bearer session; it is not a sample preview.
It provides:

- A task list with server-side pharmacy/status filters, local search, and
  assigned-to-me / created-by-me filters over the loaded result.
- Creation with title, description, pharmacy, existing assignee user ID,
  priority, and an optional due date/time. **Assign to me** uses the verified
  current user ID. A searchable assignee directory is not available in the backend.
- Task details with assignee, creator, priority, dates, and progress controls.
- Status updates for an assignee or owner/store manager with effective update
  permission. Completed, skipped, and canceled tasks cannot be reopened.
- A chronological comment thread and comment creation for permitted users.
- Loading, empty, permission, connection-error, and closed-task conflict states.

All task actions use same-origin UI server routes. These routes verify the JWT,
forward it to the backend, disable caching, validate mutation bodies, and avoid
forwarding client-supplied tenant/schema fields. The backend remains responsible
for current permissions, tenant scope, pharmacy access, and record visibility.
The UI reads `/api/v1/me` for effective permissions rather than treating the
selected dashboard role as an authorization grant. Expired API sessions clear
the tab token and return to login.

| UI route | Backend route | Methods |
| --- | --- | --- |
| `/api/tasks` | `/api/v1/tasks` | GET, POST |
| `/api/tasks/{id}` | `/api/v1/tasks/{id}` | GET |
| `/api/tasks/{id}/status` | `/api/v1/tasks/{id}/status` | PATCH |
| `/api/tasks/{id}/comments` | `/api/v1/tasks/{id}/comments` | GET, POST |
| `/api/me` | `/api/v1/me` | GET |
| `/api/pharmacies` | `/api/v1/pharmacies` | GET |

The current backend grants task access to owners, store managers, pharmacists,
technicians, bookkeepers, and business development. Technicians cannot create
tasks. Tenant admin, compliance admin, and internal platform admin can open the
Tasks section but see an access message unless backend permissions are granted.
No backend authorization changes are made by this UI implementation.

Lists are limited to the backend's first 100 visible tasks; summaries and local
filters describe that loaded result. There is no pagination or task deletion API.
Dates display in the device time zone; creation converts local due dates to ISO
timestamps. Numeric IDs must fit JavaScript's safe integer range; unsafe IDs are
rejected instead of silently rounded. Unit tests exercise the real UI forwarding
routes with a mocked backend. Browser tests exercise all six task contracts and
responsive task screens across Chromium, Firefox, and mobile WebKit emulation.

### Preview modules

Owners and tenant admins can open **Administration → User management** to add draft users individually or upload a CSV. Supported assignment roles are `technician`, `book_keeper`, and `store_manager`. The page provides a downloadable sample, optional passwords, validation, duplicate checks, and a review step before batch import. Drafts remain in memory while navigating the workspace and disappear on reload/sign-out. No user accounts are created and no passwords are persisted or sent to the backend. The displayed tenant context comes from the verified JWT's `tenant_id` claim. Backend user administration and password reset remain future work.

Dashboard APIs are not connected. Cards show unavailable values until APIs are integrated. Choose **Show sample data** to explore fictional records with date, entity, status, and search filters, sorting, charts, and record details. Sample previews reset when switching roles. Future workflow, inventory, clinical, CRM, and accounting modules explain their missing data. The workflow studio is labeled as a sample preview; publishing is disabled. Task creation, status updates, and comments use live backend APIs; dashboard, workflow, and user-administration previews do not write to the backend.

`lib/dashboards.ts` defines the nine layouts and sample records; `components/role-dashboard.tsx` renders the shared dashboard; `app/dashboard.css` supplies responsive styling. The table-to-role mapping and future data requirements are in [the dashboard data plan](docs/role-dashboard-data-plan.md).

Every future data route must verify the bearer token and enforce tenant/pharmacy permissions server-side. Role URL redirects and hidden controls are presentation rules. The browser-held token is available to same-origin JavaScript; avoid untrusted scripts and keep tokens out of logs.

Before real pharmacy data is used, implement tenant-scoped dashboard APIs, pharmacy mapping from /api/v1/me, audit events, reviewed security controls, and durable workflow execution.
