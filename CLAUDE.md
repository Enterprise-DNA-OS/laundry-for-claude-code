# Laundry for Claude Code: operating instructions

## Who this is for

The demo is Harbour Laundry, a fictional dry cleaner with NZ and AU stores. Jo runs the plant and the morning delivery. Replace this context with the real business before using its records. Priorities: keep promised dates, match every garment to a tag, prevent unfinished deliveries and resolve claims.

## One path for each job

| Ask | Command |
|---|---|
| The order book | `/orders` |
| One ticket and its history | `/order` |
| Customer list | `/customers` |
| Count and tag incoming garments | `/intake` |
| Today in the plant | `/production` |
| Finish a garment check | `/quality-check` |
| Uncollected work | `/rack-check` |
| Pickup and delivery commitments | `/delivery-run` |
| Customer garment claims | `/claims` |
| Care, claims and chemical records | `/compliance` |
| Late, uncollected and overdue | `/attention` |
| Monday laundry review | `/weekly-review` |
| Draft a collection reminder | `/draft-pickup` |
| Add a business record | `/add` |
| Record an order event | `/log` |
| Bring CleanCloud records across | `/import` |
| Take a portable backup | `/export` |
| Order value and recorded balances | `/metrics` |
| Ten questions from the records | `/questions` |
| Make this laundry system yours | `/customise` |
| Add a read-only report | `/new-view` |
| Prepare tickets, tags and manifests | `/documents` |

## Rules

Read from `scripts/laundry.mjs` before answering. `--json` works everywhere. Names match without case sensitivity; ambiguous matches list candidates and exit 1. Use an id after resolving it.

Draft only. Never send, process a payment, dispose of clothing or infer a legal remedy. Never delete records without an explicit instruction. Keep imports, backups and generated documents private. The output files contain personal data.

Amounts are integer cents with the store's currency. The order balance is a recorded POS snapshot. The CLI does not accept payments. Dates are ISO dates, assessed against each store's timezone. Set the AU store's actual timezone at creation.

Read `docs/compliance.md` for the limits and sources of each check. Blank care records must be inspected, not guessed. Ready orders require a checked piece count and rack location. Record physical collection or delivery only after it happened.

Use `DATA_DIR` for a fresh embedded database. `DATABASE_URL` selects a private PostgreSQL database. Do not seed production. One process at a time for embedded mode. Share a managed database for a team, with restricted database roles and operator access set up by its owner. This is not a public web service or a tenant isolation system.

Every schema change is a new migration under `supabase/migrations/`. Run `npm test` before committing. Commands live only in `.claude/commands/`; AGENTS.md points here for other coding agents.

Built and run for businesses through Omni by Enterprise DNA: https://enterprisedna.co/omni/book?offer=replace-software&utm_medium=github&utm_campaign=cleancloud
