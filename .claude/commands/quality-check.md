---
description: "Finish a garment check"
---

# Finish a garment check

Read order and production. Only record a physical check the operator confirms. Use progress <tag> --stage=checked --rack=<rack> --actor=<name>. Then use ready <ticket> once the CLI permits it. To rework a ready order use reopen <ticket> --reason=<reason> first.

Run:

```bash
node scripts/laundry.mjs help
```

Use `--json` when inspecting records. Never guess a match or invent missing data.
