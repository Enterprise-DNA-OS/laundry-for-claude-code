# Laundry for Claude Code

The open-source laundry order system that is a database and a coding agent. Track garment intake, production, racks, claims and delivery runs. Created by Enterprise DNA.

| Do it yourself | We customise it | We run it for you |
|---|---|---|
| Free, MIT. Install and change it yourself. | Your fields, rules and CleanCloud data brought across. A counter screen or different stack can be scoped. | Installed, connected and operated through Omni by Enterprise DNA. One setup fee, then a retainer. |
| [Quick start](#quick-start) | [Get your version built](https://enterprisedna.co/omni/book?offer=replace-software&utm_medium=github&utm_campaign=cleancloud) | [Book a call](https://enterprisedna.co/omni/book?offer=replace-software&utm_medium=github&utm_campaign=cleancloud) |

Works with Claude Code, Codex, OpenCode or Cursor. Read [AGENTS.md](AGENTS.md) for the shared instructions.

## What this does

A dry cleaner's daily work is a chain of promises: what came in, what was counted, how it should be treated, where it sits and when the customer expects it back. This system keeps those records together. It refuses to mark a production order ready until every garment is checked, attributed to a checker and assigned a rack.

This is the order workflow. Keep your existing POS, payment terminal and machine controls. There is no customer app, offline driver app, live tracking, payroll, payment processing or automatic sending in the free version. Read [why no front end](docs/why-no-front-end.md).

## Quick start

Needs Node 20 or newer. Commands work in Windows PowerShell and Linux shells.

```bash
git clone https://github.com/Enterprise-DNA-OS/laundry-for-claude-code.git
cd laundry-for-claude-code
npm install
npm test
npm run demo
npm run view
npm run docs
```

The demo uses fictional records: two stores, six customers, twelve tickets, twenty-four pieces, a delivery run, two claims and two chemical records. Dates are relative to the day it is seeded so late work is visible. Repeating the seed does not overwrite changes.

Open `views/week.html`, `views/rack.html`, `views/runs.html` and `views/compliance.html`. Documents appear in `docs-out/`: job tickets, garment tags, delivery manifests, claim records and chemical inventories. Change `brand.json` for your business name, colours and logo. Use an absolute or hosted logo URL that the output files can resolve.

Open the folder in your coding agent and ask for `/production`, `/rack-check` or `/weekly-review`. Slash commands are recipes in `.claude/commands/`; other agents read the same files. Drafts stay in `drafts/` and nothing sends.

## The commands

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

## One CLI

```bash
node scripts/laundry.mjs help
node scripts/laundry.mjs order HL-1001 --json
node scripts/laundry.mjs attention
node scripts/laundry.mjs delivery-run "Harbour morning"
node scripts/laundry.mjs questions 3
node scripts/laundry.mjs log HL-1001 --actor=Jo --note="Customer confirmed collection tomorrow"
```

Names match case-insensitively and ids accept unique prefixes. Ambiguity lists candidates and exits 1. Every command accepts `--json`. Amounts are integer cents in storage and amounts entered on the command line are exact decimals. Reports keep store currencies separate. No exchange-rate conversion is implied. Metrics show order value, not recognised revenue.

## Ten questions from your records

Each question is implemented today by `questions <number>`. They can be changed to fit your operation. These are not a claim that the incumbent is unable to produce similar reports.

1. Which late tickets still have unfinished pieces?
2. Which ready tickets have been on the rack for a week?
3. Which delivery stops promise an order that is not ready?
4. Which customers have repeated open garment claims?
5. Which pieces need another clean and when are they due?
6. Which active pieces lack care or intake condition records?
7. What recorded balance is tied up in each store and currency?
8. Which customer remedy follow-ups are overdue?
9. Which chemicals lack safety documents or inventory details?
10. Which imported active tickets still need garment detail?

## Your first hour: ten things to ask for

1. Show today's production in promised-date order.
2. Find every late ticket with an unfinished piece.
3. List garments that need another clean.
4. Find care labels we have not recorded.
5. Show work left on the collection rack for a week.
6. Check today's delivery run for orders that are not ready.
7. Draft a collection reminder for a ready ticket.
8. Prepare the week's claim follow-ups.
9. Add a field for the customer's bag number with `/customise`.
10. Add a read-only report of recleans by service with `/new-view`.

## Bring CleanCloud records across

```bash
node scripts/laundry.mjs import cleancloud --customers=customers.csv --orders=orders.csv --store="Harbour Laundry" --dry-run
```

The importer loads customers and order headers after export mapping. Read [the replacement guide](docs/replace-cleancloud.md) before removing `--dry-run`. Actual garment detail and integrations need separate work. Sample CSVs are synthetic fixtures, not a vendor-certified export format.

## Use your own database

Embedded PGlite writes to `.data/db`. A fresh `DATA_DIR` creates a separate business database. Set `DATABASE_URL` in the environment or a private .env file to use PostgreSQL, then run `npm run migrate`. Both adapters use the same migrations and parameterised queries. Never seed a real business database. Only one embedded process should run at a time.

For a shared database, its owner sets access roles, TLS, private connectivity, backups and recovery. The scripts use the permissions of the supplied database user. There is no web login, per-user role manager or multi-tenant boundary in this base.

## Compliance records

`/compliance` checks care records, claim follow-ups and NZ chemical records, with separately labelled internal and statutory checks. [Sources and boundaries](docs/compliance.md) explain every rule. It flags missing evidence, not legal compliance. Demo substances are fictional. An operator verifies real supplier sheets and actual site holdings.

## Architecture and testing

Nine tables and five SQL views, one JavaScript CLI and the shared document renderer. UUID identifiers, created and updated timestamps, update triggers and relational constraints keep records consistent. No frontend framework or application server.

`npm test` migrates and seeds a temporary database, exercises all CLI commands and ten analyses, checks failed and repeated imports, validates ready/delivery transitions and renders four views and five document types. Tests use embedded mode by default and never use your DATABASE_URL. An explicit TEST_DATABASE_URL selects an isolated temporary schema for the same suite on PostgreSQL. GitHub Actions runs the same suite on Windows and Linux with Node 20 and 22. Local execution is recorded in docs/validation.md.

Every schema change is a new migration. Add a command recipe and a meaningful smoke assertion with each new workflow. Backups and draft output are gitignored. Keep real customer data out of issues and commits.

MIT licence. Built by Enterprise DNA. [Get your version built](https://enterprisedna.co/omni/book?offer=replace-software&utm_medium=github&utm_campaign=cleancloud).
