---
description: "Bring CleanCloud records across"
---

# Bring CleanCloud records across

Read docs/replace-cleancloud.md first. Inspect the actual export headers and map them. Create a store if needed, do a dry run, review the counts, then run import cleancloud with the same inputs without --dry-run. Source values replace matching records. Do not replay over active work without reviewing the differences. Never send exports elsewhere.

Run:

```bash
node scripts/laundry.mjs help
```

Use `--json` when inspecting records. Never guess a match or invent missing data.
