# Verification

Run mvnw.cmd verify in backend and npm.cmd run build in frontend. The root README explains the opt-in disposable PostgreSQL test configuration.

Unit/MVC tests cover user inheritance, validation, role boundaries, sessions/CSRF, lifecycle rules, priority thresholds, assignment eligibility, SLA boundaries, escalation, category rules, duplicates, event propagation and notification ownership.

PostgreSQL tests exercise real authentication, incident lifecycle/history, concurrent capacity checks, transfers/collaboration, privacy, saved deadlines, strategy switching, notification persistence, user/catalog management, reports and additive migration behavior.

Read backend/target/surefire-reports for current counts. Database tests are skipped unless BITSOLVE_DB_TESTS=true. Never point them at valuable records. Hosted HTTPS and external SMTP require separate verification; a simulated outbox does not prove delivery.

Verified locally on 2026-11-16: 147 tests passed, zero failed, zero skipped using an isolated PostgreSQL 18 database; React production build passed. Headless browser workflows passed against the packaged application: reporting/assignment, transfers, collaboration, resolution/verification/closure, admin account/catalog/SLA edits, notification read/navigation, role checks, session restoration and mobile layout. Docker and Railway were not executed.

Gmail implementation verification (2026-11-16): 156 tests passed, zero failed/skipped on isolated PostgreSQL; frontend production build passed. SMTP was mocked. Added email coverage for the three events, reporter-only addressing, deduplication, uncommitted visibility, rollback, bounded failure retries, missing configuration, safe content and interrupted final-attempt recovery. No live Gmail message was sent.
