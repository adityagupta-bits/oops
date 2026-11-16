# Verification

Run mvnw.cmd verify in backend, and npm.cmd test plus npm.cmd run build in frontend. The root README explains the opt-in disposable PostgreSQL test configuration. Migration tests also require CREATEDB permission on the disposable PostgreSQL server; they create and drop randomly named test databases, never the configured application database.

Unit/MVC tests cover user inheritance, validation, role boundaries, sessions/CSRF, lifecycle rules, priority thresholds, assignment eligibility, SLA boundaries, escalation, category rules, duplicates, event propagation and notification ownership.

PostgreSQL tests exercise real authentication, incident lifecycle/history, concurrent capacity checks, transfers/collaboration, privacy, saved deadlines, strategy switching, notification persistence, user/catalog management, reports and additive migration behavior.

Read backend/target/surefire-reports for current counts. Database tests are skipped unless BITSOLVE_DB_TESTS=true. Never point them at valuable records. Hosted HTTPS and external SMTP require separate verification; mocked SMTP and queued outbox records do not prove delivery.

Verified locally on 2026-11-16: 147 tests passed, zero failed, zero skipped using an isolated PostgreSQL 18 database; React production build passed. Headless browser workflows passed against the packaged application: reporting/assignment, transfers, collaboration, resolution/verification/closure, admin account/catalog/SLA edits, notification read/navigation, role checks, session restoration and mobile layout. Docker and Railway were not executed.

Gmail implementation verification (2026-11-16): 156 tests passed, zero failed/skipped on isolated PostgreSQL; frontend production build passed. SMTP was mocked. Added email coverage for the three events, reporter-only addressing, deduplication, uncommitted visibility, rollback, bounded failure retries, missing configuration, safe content and interrupted final-attempt recovery. No live Gmail message was sent.

Final corrections verification (2026-11-16): 165 backend tests passed, zero failed,
zero errors and zero skipped on a fresh disposable PostgreSQL 18 cluster. This
includes V1-to-V6 and V5-to-V6 upgrades preserving users, incident snapshots,
history and settings, plus explicit service-criticality validation. Five Node
API-client tests passed. React production build and executable JAR packaging passed.
Headless Chrome passed service configuration, assignment, transfers, collaboration,
administrator operations, four-strategy persistence, lifecycle, mobile layout,
session restoration and expiry-to-login without an auth/me loop. An initial browser
test attempt hit a selector race during table loading; the corrected wait passed.
No real SMTP, Docker build or Railway deployment was performed.

See [submission-draft.md](submission-draft.md) for diagram sources, 26 documented
test cases and three demonstration workflows requiring team review.
