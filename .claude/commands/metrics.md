# Order value and recorded balances

Group by store, currency and status. Order value is not recognised revenue. Recorded balances are snapshots from the POS export, not settlement confirmation. Never combine currencies.

Run:

```bash
node scripts/laundry.mjs metrics
```

Use `--json` when inspecting records. Never guess a match or invent missing data.
