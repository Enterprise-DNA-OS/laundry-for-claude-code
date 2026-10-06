# Validation

This file records checks for the initial build. See the final commit and Actions runs for subsequent checks.

- Local runtime: Linux, Node 22, embedded PostgreSQL through PGlite.
- The smoke suite uses a temporary embedded database, or a temporary schema when TEST_DATABASE_URL is explicitly supplied, and renders outputs into a temporary directory.
- Windows and Linux CI is configured for Node 20 and 22. The PostgreSQL job supplies a disposable PostgreSQL 17 service. Verify each job against the recorded commit.
- No live CleanCloud account or actual customer export was used. Import fixtures are synthetic and header mapping requires review.
- The schema uses PostgreSQL-compatible SQL; a separate hosted PostgreSQL service was not exercised locally.

Initial Linux validation on 6 October 2026: `npm install`, `npm test` (42 checks), `npm run demo`, `npm run view` (four reports) and `npm run docs` (38 files across five types) passed. The week report was opened in Chromium and inspected. The landing-page copy passed the rebuild gate with nine sourced price figures and zero brand errors.
