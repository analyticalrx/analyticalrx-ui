# Role dashboard data plan

Reviewed on October 3, 2026. This plan maps the documented product to the existing backend role names and to database tables defined in repository SQL. It is a design deliverable; it does not change application behavior, create database tables, or connect dashboards to live data.

## Findings and source precedence

Build seven business dashboards plus tenant-admin and internal-platform-admin workspaces. Keep existing role names. Phase 1 should present safe event/payment aggregates, source freshness, and explicit empty or unavailable states. Add work management, compliance documents, CRM, and accounting widgets after their tables and feeds exist.

The unified [PRD](../../analytical-rx-documentation/prd/product-requirements-document.md) is the product planning authority. The [API contracts](../../analytical-rx-documentation/architecture/ui-api-contracts.md), [service design](../../analytical-rx-documentation/architecture/data-platform-service-design.md), and [RBAC standard](../../analytical-rx-documentation/architecture/role-based-access-control-standard.md) supply implementation detail, but their role names and identity model differ from current code.

The two PowerPoint decks contain 23 slides in total. Their slide text and speaker notes were inspected:

- [Airtable product alignment](../../analytical-rx-documentation/presentations/airtable-product-alignment.pptx), slides 3–5: operations, compliance, finance, Rx, growth, vendors, and the original role dashboard expectations. Slide 8 sequences data foundation before workflows and advanced insights.
- [Client demo](../../analytical-rx-documentation/presentations/analyticalrx-client-demo-phase1-phase2.pptx), slides 2, 8–10: owner, operations, finance, compliance, outreach, payer, and drug views. Its Phase 2 analytics narrative differs from the unified PRD's workflow-first Phase 2; do not treat both as simultaneous commitments.
- [Word teammate guide](../../analytical-rx-documentation/team-setup/analyticalrx-teammate-setup-guide.docx): repository access and SSH setup only. It adds no dashboard metrics or database tables.

Other reviewed sources include Airtable tables/interfaces/automation analysis, ingestion designs, database dictionary/review guides, SQL schema and migration files, diagram sources and dashboard mockup definitions, operations notes, and task drafts. Screenshots and rendered diagrams are reference designs, not evidence of populated tables. No live database inspection was performed.

## Role coverage without renaming

| Existing backend role | Documentation equivalent | Dashboard purpose | Suggested UI path |
| --- | --- | --- | --- |
| OWNER | OWNER_EXECUTIVE | Portfolio performance and store comparison | /owner (existing) |
| BOOKKEEPER | BOOKKEEPER_FINANCE | Payments, financial exceptions, period reporting | /bookkeeper (existing) |
| TECHNICIAN | TECHNICIAN | Assigned-store operational status and future assigned tasks | /technician (existing) |
| STORE_MANAGER | STORE_MANAGER | Assigned-store performance and exceptions | /store_manager |
| PHARMACIST | PHARMACIST | Verification and pharmacy work status | /pharmacist |
| COMPLIANCE_ADMIN | COMPLIANCE_ADMIN | Ingestion quality, retention and future compliance obligations | /compliance_admin |
| BUSINESS_DEVELOPMENT | BUSINESS_DEVELOPMENT | Safe prescriber trends and future Doctor CRM | /business_development |
| TENANT_ADMIN | TENANT_ADMIN | Tenant users, access assignments and audit | /tenant_admin |
| INTERNAL_PLATFORM_ADMIN | INTERNAL_PLATFORM_ADMIN | Platform tenant registry and safe administrative health | /internal_platform_admin |

The frontend now supports all nine listed roles and retains every verified supported role. Multi-role users have a workspace selector. Dashboard data remains disconnected; optional sample previews use fictional fixtures. The draft user-form values technician, book_keeper, and store_manager remain unchanged; book_keeper is a form value and must be mapped explicitly to backend BOOKKEEPER during eventual integration.

The user-requested owner user-management draft screen remains an intentional product exception. Documentation separates owner business visibility from TENANT_ADMIN user-management permission. This plan does not revoke the owner screen or silently give it real backend write permissions. The backend currently grants user-management permissions to TENANT_ADMIN, not OWNER.

Roles are additive in the documented access model. The frontend retains all supported verified roles. Integration with current /me permissions remains future work. A person with multiple permitted dashboards should have a workspace selector. Internal platform access must stay separate from customer business access.

## Table inventory and what availability means

“Defined” below means present in repository DDL, not confirmed populated or compatible with the running database. API availability is a separate requirement. The current backend implements authentication and /me; role dashboard endpoints are still a proposed contract.

Tenant-owned tables from [canonical SQL](../../analytical-rx-documentation/schemas/mvp_canonical_event_schema.sql):

| Table | Grain and useful fields | Dashboard use |
| --- | --- | --- |
| tenant | One tenant master; tenant_key, display_name, status | Organization label and canonical tenant resolution |
| pharmacy | One source pharmacy; pharmacy_key, display_name, status, state_code | Authorized pharmacy selectors and store labels |
| pharmacy_event | One canonical event per ingestion_event_id; business_date, event_timestamp, source_system, canonical_event_type, rx/claim/fulfillment/queue/refill/verification statuses, fill_reference_token, drug_id, prescriber_npi, monetary fields, quality/enrichment states | Activity, operational state projections, safe trends, conditional finance metrics |
| event_payment | Payment rows per pharmacy event/payer sequence; payment_type, payer_id, billed_amount, paid_amount, patient_responsibility_amount, copay_paid_amount, payment_status | Payment split and payer summaries |
| payer | Source payer dimension; payer_name, payer_type, BIN/PCN | Approved payer labels and grouping |
| drug | Source drug dimension; NDC, drug_name, generic_name, strength, form, drug_class | Approved drug labels and grouping; no inventory or acquisition cost |
| ingestion_event | One source ingestion attempt/event; status, received_at, queued_at, processed_at, failure_code, phi_suppression_status, idempotency_key | Source health, failed/duplicate/enrichment counts and processing timestamps |
| raw_payload_archive | Restricted archive metadata; received_at, retention_until, payload_size_bytes | Backend-calculated retention summaries only |
| source_rx_reference | Restricted source RxNo/RefillNo and matching tokens | Backend lookup/reconciliation only; never a normal UI data source |

Control-plane tables expected by current backend code and its simplified migration:

- tenant_registry: tenant identity, public key, trusted schema mapping and status.
- app_user: user identity, display_name, email, status, permissions_version, last_login_at.
- user_role, role_definition, role_permission, permission_definition: assigned roles and permissions.
- user_pharmacy_access: active pharmacy_key assignments for a user and tenant.
- app_access_audit_event, permission_audit_event: intended access and permission history; writers and actual event population must be verified.

The documentation's control-plane SQL instead uses user_tenant_access, user_role_assignment, and user_role_pharmacy_scope, with UUID identities. Current Java code uses numeric identity fields and a different assignment model. The backend migration also needs reconciliation with the pulled code. Before implementation, inspect actual database DDL and settle identity types and scope semantics; do not run these competing schema files as interchangeable migrations.

## Dashboard specifications

### OWNER

| Widget | Tables and fields | Calculation / dependency |
| --- | --- | --- |
| Pharmacy count and comparison | pharmacy; pharmacy_event.pharmacy_id, business_date | Include authorized active stores with zero events using a left join |
| Event activity and trend | pharmacy_event.canonical_event_type, business_date | Count events by day/type; label as events, not prescriptions filled |
| Distinct fill activity | pharmacy_event.fill_reference_token | Count distinct tenant/pharmacy/source/fill keys for the agreed lifecycle event; show coverage for missing tokens |
| Recorded payment summary | event_payment.paid_amount, payment_type; pharmacy_event | Use an agreed deduplicated financial grain; label recorded payments rather than recognized revenue |
| Rejection/reversal activity | pharmacy_event.canonical_event_type, reversal_flag, claim_status | Define event counts separately from current unresolved claims |
| Store/source exceptions and freshness | ingestion_event; pharmacy_event.data_quality_status, enrichment_status | Scoped aggregate warnings and processed-data freshness |

Layout: portfolio filters, four KPI cards, event/payment trend, store comparison table, data-quality action list. Gross profit, EBITDA, KPI targets, task completion, vaccines, OTC sales and compliance scores remain unavailable until their inputs exist. No fixed percentage estimates.

### STORE_MANAGER

Sources: pharmacy, pharmacy_event, ingestion_event; limited payment aggregates only if explicitly authorized by backend policy. The current migration does not grant STORE_MANAGER finance.summary.read, so the documented payment widget is conditional.

Cards: store event activity, rejected claim events, pickup/delivery events, records needing review. Chart: activity by canonical type/day. Table: safe event exceptions with generated event ID, type, date and normalized status. Scope is the intersection of requested pharmacies and user_pharmacy_access; no unassigned-store comparison.

Filled counts require an approved rx_status mapping: the schema contains prescription_filed, which must not be treated as prescription_filled. Workload by employee, assigned tasks, inventory issues and task due dates need new operational tables.

### PHARMACIST

Sources: pharmacy_event, pharmacy, optionally drug for approved aggregate groups. Candidate fields: verification_status, queue_status, rx_status, refill_queue_status, claim_status and relevant canonical event types.

Cards: verification pending, rejected claim activity, completed verification events. Chart/table: normalized work-state summary for authorized stores. A claim_rejected event count is directly possible; a current blocked-work count needs a state projection and agreed definition. rph_verification_done is an observed event, not evidence that a user performed a new clinical action inside AnalyticalRx.

The daily/upcoming refill queue needs a durable refill_queue_item model. days_supply, date_dispensed and refill counts may seed candidates after source validation, but do not constitute a trustworthy clinical due date or an actionable queue by themselves. No clinical mutation buttons until backend actions exist.

### TECHNICIAN

Sources: pharmacy_event and pharmacy. Candidate fields: queue_status, fulfillment_status, picked_up_flag, verification_status, refill_queue_status. Show store work-state summaries and pickup/delivery activity where mappings are validated.

Cards: ready work, blocked work, completed activity, with each card marked partial/unavailable if state coverage is insufficient. “My assigned tasks,” overdue work and completed-by-me require task/assignee data, not pharmacy_event. Fridge temperature logs and SOP acknowledgments require their own tables. Technician views omit finance and pharmacist-only actions.

### BOOKKEEPER

Sources: pharmacy_event, event_payment, payer, pharmacy; optional drug for approved financial grouping.

| Widget | Inputs | Important qualification |
| --- | --- | --- |
| Recorded paid/billed amount | event_payment.paid_amount, billed_amount | One approved financial version per logical fill/claim; handle reversals and adjustments |
| Payment split | event_payment.payment_type | Separate insurance, cash, patient_pay and unknown; use left payer joins |
| Payer comparison | event_payment.payer_id → payer.id | Preaggregate payments; do not multiply event counts for multiple payer rows |
| Recorded amount due | pharmacy_event.amount_due | Latest approved financial state, not sum of all lifecycle snapshots; not AR aging |
| Tax/discount/fees | pharmacy_event tax_amount, discount_amount, dispensing_fee_amount, other_fee_amount | Only populated and reconciled fields; display coverage |
| Missing financial data | pharmacy_event.enrichment_status plus relevant null monetary fields | Null means unknown; do not coerce missing money to zero |
| Reversal/rejection activity | pharmacy_event canonical/claim status | Payer rejection attribution is unavailable if no reliable claim-to-payer link exists |

Gross profit and EBITDA need acquisition/COGS, DIR fees, payroll, rent and other operating costs. ingredient_cost_amount is not automatically acquisition cost. Deposits, cash reconciliation, payer receivable aging and monthly close require accounting/POS/settlement sources. Do not retain the current demo's 31% profit or 12% EBITDA formulas as real metrics.

### COMPLIANCE_ADMIN

Sources: ingestion_event; safe backend aggregate of raw_payload_archive; permission_audit_event and app_access_audit_event only where explicitly permitted. The current role has dashboard.compliance.read, not blanket permission to inspect all user data.

Cards: processed/failed/needs-enrichment records, PHI-filter failures, archives whose retention date has passed. Chart: ingestion status distribution. Tables: sanitized failure summaries and approved audit summaries. Fields: status, phi_suppression_status, failure_code, received_at, processed_at, retention_until. Raw payload references, arbitrary failure text, old_value/new_value and details JSON require an allowlisted server projection.

A passed retention date means deletion is due; it does not prove purge completed. “Retryable” cannot be inferred from status=failed alone: add an error classification/processing policy. License expirations, required compliance items, temperatures, document expirations and SOP completion are unavailable until new compliance tables exist.

### BUSINESS_DEVELOPMENT

Sources: pharmacy_event.prescriber_npi, pharmacy_id, business_date and pharmacy labels. Cards: unique known prescribers with qualifying activity, distinct qualifying fill activity, missing-prescriber coverage. Chart/table: prescriber activity over time by assigned store. Count qualified fills or explicitly label event counts to avoid inflating prescriptions from multiple lifecycle events.

The schema lacks prescriber names, office identity, representative assignment, visits, pitches, next-follow-up and relationship stages. Do not label an NPI aggregate as a Doctor CRM record. A trend after outreach is not proof of outreach-caused revenue. Office/representative joins require a new verified mapping. Finance values need explicit permission; BUSINESS_DEVELOPMENT currently has only its dashboard read permission.

### TENANT_ADMIN

Sources: tenant_registry, app_user, user_role, role_definition, role_permission, permission_definition, user_pharmacy_access; approved access/permission audit summaries. Tenant pipeline summaries can use ingestion_event if granted by policy.

Cards: active users, users without required pharmacy assignment, active role assignments, recent access/permission changes. Tables: users, roles, pharmacy assignments and audit history. Useful columns: user status, display name, email, assigned roles, pharmacy count, last_login_at when populated. Never return password hashes or secrets.

Do not flag an owner as unassigned merely because they have no user_pharmacy_access rows: establish whether tenant-wide business roles bypass explicit store assignments. Financial or clinical dashboards are not automatically included in admin scope. The current TENANT_ADMIN finance.summary.read grant is a code/documentation difference requiring a deliberate backend policy decision, not an assumed UI permission.

### INTERNAL_PLATFORM_ADMIN

Primary sources: control_plane.tenant_registry and explicitly permitted control-plane user/role/audit metadata. Cards: tenants by status, tenant onboarding/mapping issues, safe platform access failures. Table: public tenant key, display name, status and approved health summary.

The current role grants only platform.tenants.read/manage. Cross-tenant users and audit require additional explicit permissions despite the broader proposed API contract. Per-tenant ingestion counts should be computed behind a trusted backend aggregation service; no client schema names, arbitrary schema selection, or default cross-tenant pharmacy revenue/clinical access.

## Missing business tables and proposed models

These names are proposals, not existing PostgreSQL tables or migration instructions. Airtable's 19 table descriptions supply intent; they are not a live database dependency.

| Proposed model | Airtable / PRD reference | Minimum business fields | Dashboards unlocked |
| --- | --- | --- | --- |
| task, task_assignment, task_template | Tasks, Task Templates | tenant, pharmacy, title, assignee, category, priority, status, due_at, completed_at, source/workflow reference | Owner, store manager, pharmacist, technician |
| workflow_definition, workflow_run, workflow_action_result | Automations / PRD Phase 2A | scope, enabled state, scheduled time, run result, idempotency key, outputs | Admin, owner, operations |
| refill_queue_item | PRD Phase 2B | safe fill token, pharmacy, planned date, readiness, blocker, assignee, audit history | Pharmacist, technician, store manager |
| compliance_item, compliance_log, employee_license | Compliance Items/Logs, Employee Licenses | scope, responsible user, category, due/expiry date, log timestamp, measured value/unit, exception status | Compliance, manager, technician, owner summaries |
| document_metadata, sop, sop_version, sop_acknowledgment | Documents, SOPs, SOP Acknowledgments | permission class, secure object reference, version, expiry, required user, acknowledgment | Compliance, admin, staff |
| doctor_office, prescriber_office_mapping, doctor_visit, crm_follow_up | Doctor Offices/Visits / PRD Phase 2C | office, NPI mapping, pharmacy scope, rep, stage, visit/outcome, next action/due date | Business development, manager, owner summaries |
| financial_period, financial_period_cost | Financial Periods | revenue categories, COGS, DIR, payroll, rent, other expense, period status, provenance | Bookkeeper, owner |
| receivable_snapshot, settlement, deposit, close_checklist | AR Aging / finance requirements | payer, dates, aging buckets, posted/received money, match status, close steps | Bookkeeper |
| daily_sales_summary | Daily Sales | business date, pharmacy, Rx revenue, OTC revenue, vaccine count and validated sources | Owner, manager, finance |
| kpi_definition, kpi_target, kpi_actual | KPI Scorecard | metric, unit, direction, target, period, pharmacy, lineage | Owner, manager, finance |
| onboarding_step, vendor_contract | Onboarding Steps, Vendors | scope, owner, status/due date; contract value and renewal date | Admin, manager, optional owner summaries |

Financial formulas require product confirmation of expense treatment. KPI ratios require defined denominators and zero-denominator handling. “New Rx patients” is unsupported by the current patient-free schema and should remain unavailable without an approved identity design.

## Query and metric rules

1. Resolve tenant context using authenticated state and tenant_registry. Control-plane IDs and canonical tenant IDs are not assumed equal; map using trusted tenant_key. Never accept database schema names from the client.
2. Match authorized pharmacy_keys from current /me to canonical pharmacy.pharmacy_key within the resolved tenant. Do not directly compare a control-plane numeric identifier with canonical UUIDs. Apply scope to every joined table.
3. Separate three grains: event activity (COUNT events), unique fill activity (distinct scoped tokens), and current work state (validated state projection as of a time). These are different metrics. An event stream is not a task queue.
4. State projection candidates partition by tenant, pharmacy, source and fill token; order by verified source timestamp with deterministic tie-breaking. Confirm whether events are complete snapshots or partial updates before relying on only the latest row. Missing tokens and unrecognized statuses remain excluded/unknown with coverage warnings.
5. A current state as of end date must consider earlier relevant events before applying a reporting start date. Otherwise older open work disappears. Historical activity uses the reporting window; live backlog and historical snapshots need separate labels.
6. Event/payment joins are one-to-many. Preaggregate payment rows at the chosen event/fill grain or use distinct event counts. Aggregate drug and payer reporting only after preventing duplicate lifecycle snapshots and payer fan-out.
7. Repeated payment values may be snapshots, not transactions. Establish charge/payment versioning, reversals, rebills, adjustments, and settlement rules before summing financial values. Do not invent signed reversal handling without a source contract.
8. Source business dates and tenant timezone govern reporting boundaries; ingestion received_at governs pipeline activity. Display processed-data freshness separately from receipt freshness. A failed latest event does not prove business data is fresh.
9. Use null + partial/unavailable status for missing inputs; zero only for a confirmed empty scoped result. Show coverage, freshness, and warnings for incomplete data. Failed queries are error states, not empty arrays.
10. Ingestion rows without a mapped pharmacy can appear in an authorized tenant-level admin quality count, but must not bypass pharmacy-scoped access. Sanitize failure descriptions and all audit JSON before exposing them.
11. Normal dashboards exclude source_rx_reference, original Rx/Refill numbers, raw payloads/references, password hashes, database schema names and credentials. Retention summaries use approved aggregates only.

## Frontend and API integration plan

Use the shared documented outer contract: dashboardId, title, public tenantKey, generatedAt, filters, dataFreshness, cards, charts, tables and warnings. Each card includes valueType/unit/currency and ok/partial/unavailable state. Render unavailable cards in place with an explanation.

Business routes proposed in documentation are `/api/v1/tenants/{tenantKey}/dashboards/{dashboard}` with owner, store-manager, pharmacist, technician, bookkeeper, compliance-admin and business-development suffixes. Tenant/internal admin use their dedicated admin APIs; no invented deployed endpoint is assumed.

The current /me returns user, tenantId, roles, permissions and pharmacyKeys; the documentation proposes a richer tenant/navigation structure. Adapt to the actual backend response first. A future tenant display-name/public-key projection is preferable to exposing schema metadata.

Implementation sequence:

1. Confirm database DDL, identity mapping, pharmacy scope and source status/financial semantics; establish an approved API response contract.
2. Build a reusable frontend dashboard renderer with empty/error/partial states and configurable role layouts. Extend login/routing for all existing backend roles; preserve current owner user-management behavior.
3. Connect owner and store-manager event activity, then pharmacist/technician status summaries once state mapping is approved. Mark disconnected metrics as unavailable, not live demo numbers.
4. Connect bookkeeper payment reporting after validating financial grain and reconciliation. Add compliance/admin source-health read models and approved control-plane projections.
5. Add safe business-development prescriber trends. Phase 2 task, refill, CRM, compliance and accounting modules follow only when their data models and permissions exist.

Validation: known fixtures with multiple events per fill, multiple payers per event, reversals, late events, missing tokens/amounts/NPI, empty stores, inactive users, multi-role users, and attempted unassigned-store/cross-tenant access. Assert dashboard responses never contain restricted fields. No database/API implementation is included in this document.
