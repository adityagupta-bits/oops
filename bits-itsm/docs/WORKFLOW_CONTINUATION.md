# Workflow continuation checkpoint

## Verified on 22 November 2026

- Original project has 49 changed/untracked paths. Preserve unrelated work.
- Password-file PostgreSQL authentication succeeds without exposing credentials.
- Backup: `C:\Users\ASUS\BITSolve-backups\bitsolve-phase1-20261122-033631.dump`.
- Backup restored with `pg_restore --exit-on-error` into `bitsolve_restore_verify_20261122033926`.
- Restored database contains 4 incidents and 11 successful Flyway history entries.
- Original database/schema untouched by this continuation.
- Restoration is verified; Flyway checksum validation is NOT yet verified.

## Next implementation step: Phase 1

Implement custom catalog service identity end to end before exposing creation UI. Current classifier calls `ItService.valueOf(entry.getCode())` and silently skips custom codes; reclassification accepts an enum too. Adding catalog rows alone cannot provide working custom services.

Relevant files: `incident/CatalogService.java`, `incident/CatalogEntry.java`, `incident/Incident.java`, `incident/IncidentData.java`, `incident/IncidentService.java`, `classification/IncidentClassificationService.java`, `api/AdminManagementController.java`, and `frontend/src/AdminManagement.jsx`.

Preserve legacy service enum mappings and historical records with an additive catalog reference if needed. Validate any migration on the restored database first. Administrator must explicitly choose criticality before activating a service. Do not enable the original eight services or classify original incidents without administrator choices.

Finish Service Setup, custom creation, classification correction and assignment retry, then focused API/database tests before advancing through the remaining requested phases.

## Test tooling

- Java 25 available at `D:\IntelliJ IDEA 2026.2.1\jbr`; set JAVA_HOME for the command process.
- Use backend `mvnw.cmd`; standalone mvn is not on PATH.
- PostgreSQL 18 binaries: `C:\Program Files\PostgreSQL\18\bin`.
- Frontend `npm test` previously passed 10 tests; `npm run build` passed.
- NotificationServiceTest previously passed 11 tests. These are prior results, not a complete regression of the requested phases.
- Never print password-file contents or credentials.

## Outstanding scope

All requested phases remain unaccepted end to end: service setup/classification; reported urgency; priority/assignment configuration; reassignment; technician management; persistent chat; SLA countdown and breach behavior; incident details; analytics; notifications; Knowledge Base removal; UI polish. Existing partial implementations must be inspected and reused. No new feature implementation or migration was completed in this continuation.
