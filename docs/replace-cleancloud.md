# Bring CleanCloud order records across

This imports customer records and order headers, not the whole CleanCloud POS. Keep the POS and payment terminal in place until the replacement work you actually need has been verified.

## Export from CleanCloud

CleanCloud documents **Settings > Metrics > Data Export > Customers**. Export customers and orders for one store and the required date range. Your user needs the Export Data permission. CleanCloud describes downloadable Excel exports, so save each relevant worksheet as UTF-8 CSV if it arrives as a workbook. Keep identifiers as text and dates as YYYY-MM-DD. Check decimal amounts in the store's currency.

Sources reopened 6 October 2026:

- [Customer export path](https://cleancloudapp.com/updates/279)
- [Data export permissions](https://cleancloudapp.com/updates/631)
- [Order and customer export capability](https://www.cleancloudapp.com/features)
- [Additional order export details](https://www.cleancloudapp.com/blog/cleancloud-feature-round-up)
- [Help centre](https://intercom.help/cleancloudsupport/en)

The public pages confirm the export path and capabilities but do not specify a complete, current CSV header contract. The files in `examples/cleancloud/` are synthetic mapping fixtures, not an account export. Inspect your real headers before importing. There is no claim of validation against a live CleanCloud account.

## Start a clean business database

Use a new DATA_DIR instead of the demo database. In Bash set `export DATA_DIR=./.data/business`; in PowerShell set `$env:DATA_DIR='./.data/business'`. Leave DATABASE_URL unset for embedded mode.

```bash
npm run migrate
node scripts/laundry.mjs add store --name="My Laundry" --country=NZ --timezone=Pacific/Auckland
node scripts/laundry.mjs import cleancloud --customers=customers.csv --orders=orders.csv --store="My Laundry" --dry-run
node scripts/laundry.mjs import cleancloud --customers=customers.csv --orders=orders.csv --store="My Laundry"
```

After header mapping, customers and orders load in one command. A dry run executes the same validation in a rolled-back transaction. Any invalid record rolls back the whole import. One command is the loading step; checking an unfamiliar export and completing garment details still takes operator work.

## Column mapping

| Record | Required fields | Optional fields |
|---|---|---|
| Customer | Customer ID, Name | Email, Phone, Address |
| Order | Order ID, Customer ID, Order Number (falls back to Order ID), Created Date, Due Date, Status, Total | Paid Amount, Service, Notes |

The importer recognises the common header aliases listed in `scripts/laundry.mjs`. Supply `--map=mapping.json` for different headers. Copy `examples/cleancloud/mapping.json` and use the exact header text. Dates must be ISO dates; convert localised dates in the export before loading. Money must be an unadorned decimal with at most two places. Unknown status labels fail instead of guessing. Add a `statuses` map from the actual lower-case label to received, processing, ready, collected or cancelled after reviewing its meaning.

Identifiers are namespaced by store and source. Reimporting updates matching customers and order headers. Source fields replace current values, including status. Do not replay old exports over live work. Export a backup and review changes first. Ready and collection dates remain unknown because this import does not map those dates. Raw order columns are retained as source data for inspection.

## What still needs work

Garments, heat-seal barcodes, tags, rack assignments, photographs, care labels, delivery routes, invoices, subscriptions, payment credentials, marketing consent, staff permissions and message history do not carry over through this header importer. Recorded paid amounts are imported as snapshots, never payment instructions. No automated notifications run.

For an active imported ticket, read the source order and add its real garments. If its status is ready, use `reopen <ticket> --reason="Verify imported garment detail"`, then add and check the garments before marking it ready again. Do not invent garment counts from order totals.

## Reconcile and switch the order workflow

Compare customer and ticket counts, each store's totals and recorded balances, and several individual source tickets. Check each active ticket's count, tag, rack and promise date. Run production, rack-check, delivery-run and compliance. Run both systems together for a complete collection and delivery cycle. Only retire the parts whose records and working process you have verified.

`node scripts/laundry.mjs export --out=exports/laundry-backup.json` writes all nine record collections. Create exports/ first. It refuses to overwrite an existing file. Use managed PostgreSQL backups for production recovery; the JSON export is a portable record copy, not an automated restore command.

Enterprise DNA maps the real export, builds the additional workflows and runs the installed version through Omni by Enterprise DNA. One setup fee, then a retainer.
