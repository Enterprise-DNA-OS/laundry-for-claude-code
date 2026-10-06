---
description: "Pickup and delivery commitments"
---

# Pickup and delivery commitments

List stops in sequence and flag NOT READY. No route optimisation, navigation or live location is claimed. Add run and add stop build a manifest. Use complete-stop only after the operator confirms the actual pickup or delivery.

Run:

```bash
node scripts/laundry.mjs delivery-run $ARGUMENTS
```

Use `--json` when inspecting records. Never guess a match or invent missing data.
