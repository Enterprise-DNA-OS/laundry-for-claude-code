#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { getDb, REPO_ROOT } from "./lib/db.mjs";
import { parseCsv, pick } from "./lib/csv.mjs";
import { table } from "./lib/format.mjs";

export const HELP = `Laundry for Claude Code
Reads: stores | customers | orders | order <ticket> | production | rack-check
       delivery-run [name] | claims | substances | compliance | attention | metrics | questions [1..10]
Writes:
  add store --name= --country=NZ|AU [--timezone=]
  add customer --name= --email= --phone= --address=
  add order --ticket= --customer= --store= --due=YYYY-MM-DD [--received=YYYY-MM-DD] [--total=18.50] [--service=]
  add garment --order= --tag= --description= --care= --condition=
  add run --name= --store= --on=YYYY-MM-DD --driver=
  add stop --run= --order= --sequence=1 --kind=pickup|delivery --address=
  add claim --order= --issue= --follow-up=YYYY-MM-DD
  add substance --store= --name= [--location=] [--quantity=] [--hazard=] [--sds=] [--review=YYYY-MM-DD]
  amend-garment <tag> [--care=] [--condition=] [--description=]
  progress <tag> --stage=received|cleaning|pressing|checked|reclean [--rack=] [--actor=]
  ready <ticket> | collect <ticket> | reopen <ticket> --reason= | complete-stop <id-prefix>
  resolve-claim <id-prefix> --remedy= | review-substance <name> --sds= --review=YYYY-MM-DD
  log <ticket> --actor= --note=
Drafts: draft-pickup <ticket> | weekly-review
Import: import cleancloud --customers=customers.csv --orders=orders.csv --store= [--map=mapping.json] [--dry-run]
Backup: export --out=backup.json
All commands accept --json. Prices use decimal amounts; the database stores integer cents.
No payments are processed and no messages are sent.`;
const TABLES = [
  "stores",
  "customers",
  "orders",
  "garments",
  "runs",
  "stops",
  "claims",
  "substances",
  "activities",
];
export function argsOf(argv) {
  const pos = [],
    f = {};
  for (const a of argv) {
    if (a.startsWith("--")) {
      const [k, ...v] = a.slice(2).split("=");
      if (k in f) throw Error(`Repeated --${k}`);
      f[k] = v.length ? v.join("=") : true;
    } else pos.push(a);
  }
  return { pos, f };
}
const required = (v, n) => {
  if (typeof v !== "string" || !v.trim()) throw Error(`Required ${n}`);
  return v.trim();
};
export function date(v, n) {
  v = required(v, n);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(v) ||
    Number.isNaN(Date.parse(v + "T12:00:00Z")) ||
    new Date(v + "T12:00:00Z").toISOString().slice(0, 10) !== v
  )
    throw Error(`Invalid ${n}: use YYYY-MM-DD`);
  return v;
}
export function cents(v) {
  if (!/^\d+(\.\d{1,2})?$/.test(String(v)))
    throw Error("Amount must be nonnegative decimal with at most two places");
  const [a, b = ""] = String(v).split(".");
  const n = Number(a) * 100 + Number(b.padEnd(2, "0"));
  if (!Number.isSafeInteger(n) || n > 2147483647)
    throw Error("Amount out of range");
  return n;
}
const integer = (v) => {
  if (!/^[1-9]\d*$/.test(String(v))) throw Error("Expected positive integer");
  return Number(v);
};
async function transaction(db, fn, dry = false) {
  await db.exec("begin");
  try {
    const r = await fn();
    await db.exec(dry ? "rollback" : "commit");
    return r;
  } catch (e) {
    await db.exec("rollback");
    throw e;
  }
}
export async function resolve(db, t, ref, col = "name") {
  required(ref, `${t} reference`);
  if (!TABLES.includes(t) || !["name", "ticket", "tag", "id"].includes(col))
    throw Error("Invalid lookup");
  let r = await db.query(
    `select * from ${t} where lower(${col}::text)=lower($1) or id::text=$1`,
    [ref],
  );
  if (!r.length)
    r = await db.query(
      `select * from ${t} where position(lower($1) in lower(${col}::text))>0 or starts_with(id::text,lower($1)) order by ${col}`,
      [ref],
    );
  if (r.length !== 1) {
    const e = Error(
      r.length
        ? `Ambiguous ${t}: ${r.map((x) => `${x.id} ${x[col]}`).join("; ")}`
        : `No ${t} matching ${ref}`,
    );
    e.candidates = r.map((x) => ({ id: x.id, name: x[col] }));
    throw e;
  }
  return r[0];
}
const today = async (db, store) =>
  (
    await db.query(
      "select (now() at time zone timezone)::date as day from stores where id=$1",
      [store],
    )
  )[0].day;
async function audit(db, id, actor, note) {
  await db.query(
    "insert into activities(order_id,actor,note) values($1,$2,$3)",
    [id, actor, note],
  );
}
const Q = [
  [
    "Which late tickets still have unfinished pieces?",
    "select ticket,customer,store,days_late,unfinished from v_order_board where days_late>0 and unfinished>0 and status in ('received','processing') order by days_late desc,ticket",
  ],
  [
    "Which ready tickets have been on the rack for a week?",
    "select ticket,customer,store,days_on_rack,balance_cents,currency from v_order_board where status='ready' and days_on_rack>=7 order by days_on_rack desc,ticket",
  ],
  [
    "Which delivery stops promise an order that is not ready?",
    "select run,sequence,ticket,customer,warning from v_run_manifest where warning<>'' order by run_on,run,sequence",
  ],
  [
    "Which customers have repeated open garment claims?",
    "select c.name as customer,count(*)::integer as open_claims from claims cl join orders o on o.id=cl.order_id join customers c on c.id=o.customer_id where cl.status='open' group by c.id,c.name having count(*)>1 order by count(*) desc,c.name",
  ],
  [
    "Which pieces need another clean and when are they due?",
    "select tag,ticket,customer,description,due_on from v_production where stage='reclean' order by due_on,tag",
  ],
  [
    "Which active pieces lack care or intake condition records?",
    "select tag,ticket,customer,care_label,condition_in from v_production where care_label='' or condition_in='' order by ticket,tag",
  ],
  [
    "What recorded balance is tied up in each store and currency?",
    "select store,currency,status,count(*)::integer as tickets,sum(balance_cents)::bigint as balance_cents from v_order_board where status<>'cancelled' and balance_cents>0 group by store,currency,status order by store,status",
  ],
  [
    "Which customer remedy follow-ups are overdue?",
    "select ticket,customer,store,days from v_attention where reason='claim follow-up overdue' order by days desc,ticket",
  ],
  [
    "Which chemicals lack safety documents or inventory details?",
    "select rule,store,record,finding from v_compliance where rule in ('NZ-SDS','NZ-INVENTORY','SDS-REVIEW') order by store,record,rule",
  ],
  [
    "Which imported active tickets still need garment detail?",
    "select ticket,customer,store,status from v_order_board where pieces=0 and status not in ('collected','cancelled') order by ticket",
  ],
];
function dumpDraft(name, body) {
  const dir = path.resolve(process.env.OUTPUT_DIR || REPO_ROOT, "drafts");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name);
  fs.writeFileSync(file, body, { flag: "wx" });
  return { file, body };
}
const stamp = () => new Date().toISOString().replace(/[:.]/g, "-");

export async function run(db, argv) {
  const { pos, f } = argsOf(argv),
    [cmd = "help", ref] = pos;
  const allowed = {
    help: ["json"],
    stores: ["json"],
    customers: ["json"],
    orders: ["json"],
    order: ["json"],
    production: ["json"],
    "rack-check": ["json"],
    "delivery-run": ["json"],
    claims: ["json"],
    substances: ["json"],
    compliance: ["json"],
    attention: ["json"],
    metrics: ["json"],
    questions: ["json"],
    add: [
      "json",
      "country",
      "timezone",
      "name",
      "email",
      "phone",
      "address",
      "ticket",
      "customer",
      "store",
      "due",
      "received",
      "total",
      "service",
      "order",
      "tag",
      "description",
      "care",
      "condition",
      "on",
      "driver",
      "run",
      "sequence",
      "kind",
      "issue",
      "follow-up",
      "location",
      "quantity",
      "hazard",
      "sds",
      "review",
    ],
    "amend-garment": ["json", "care", "condition", "description"],
    progress: ["json", "stage", "rack", "actor"],
    ready: ["json", "actor"],
    collect: ["json", "actor"],
    reopen: ["json", "actor", "reason"],
    "complete-stop": ["json", "actor"],
    "resolve-claim": ["json", "remedy", "actor"],
    "review-substance": [
      "json",
      "sds",
      "review",
      "location",
      "quantity",
      "hazard",
    ],
    log: ["json", "actor", "note"],
    "draft-pickup": ["json"],
    "weekly-review": ["json"],
    import: ["json", "customers", "orders", "store", "map", "dry-run"],
    export: ["json", "out"],
  };
  if (!allowed[cmd]) throw Error(`Unknown command ${cmd}. Use help.`);
  for (const k of Object.keys(f))
    if (!allowed[cmd].includes(k)) throw Error(`Unknown flag --${k}`);
  for (const [k, v] of Object.entries(f)) {
    if (["json", "dry-run"].includes(k)) {
      if (v !== true) throw Error(`--${k} takes no value`);
    } else if (typeof v !== "string") throw Error(`--${k} requires =value`);
  }
  if (pos.length > 2)
    throw Error("Unexpected extra arguments; quote names containing spaces");
  if (!allowed[cmd]) throw Error(`Unknown command ${cmd}. Use help.`);
  for (const k of Object.keys(f))
    if (!allowed[cmd].includes(k)) throw Error(`Unknown flag --${k}`);
  if (cmd === "help") return HELP;
  const reads = {
    stores: "select * from stores order by name",
    customers:
      "select id,name,email,phone,address from customers order by name",
    orders: "select * from v_order_board order by due_on,ticket",
    production: "select * from v_production order by due_on,tag",
    "rack-check":
      "select ticket,customer,store,days_on_rack,balance_cents,currency,pieces from v_order_board where status='ready' order by days_on_rack desc,ticket",
    claims:
      "select cl.*,o.ticket from claims cl join orders o on o.id=cl.order_id order by cl.follow_up_on,cl.id",
    substances:
      "select x.*,s.name as store from substances x join stores s on s.id=x.store_id order by s.name,x.name",
    compliance: "select * from v_compliance order by store,rule,record",
    attention:
      "select ticket,customer,store,reason,days from v_attention order by days desc,ticket,reason",
    metrics:
      "select store,currency,status,count(*)::integer as tickets,sum(total_cents)::bigint as order_value_cents,sum(balance_cents)::bigint as balance_cents,sum(pieces)::integer as pieces from v_order_board group by store,currency,status order by store,status",
  };
  if (reads[cmd]) return db.query(reads[cmd]);
  if (cmd === "order") {
    const o = await resolve(db, "orders", ref, "ticket");
    return {
      order: o,
      garments: await db.query(
        "select * from garments where order_id=$1 order by tag",
        [o.id],
      ),
      claims: await db.query(
        "select * from claims where order_id=$1 order by opened_on",
        [o.id],
      ),
      history: await db.query(
        "select actor,note,created_at from activities where order_id=$1 order by created_at,id",
        [o.id],
      ),
    };
  }
  if (cmd === "delivery-run") {
    if (!ref)
      return db.query(
        "select * from v_run_manifest order by run_on,run,sequence",
      );
    const r = await resolve(db, "runs", ref);
    return db.query(
      "select * from v_run_manifest where run=$1 order by sequence",
      [r.name],
    );
  }
  if (cmd === "questions") {
    if (ref) {
      const n = integer(ref);
      if (n > 10) throw Error("Question must be 1..10");
      return { question: Q[n - 1][0], rows: await db.query(Q[n - 1][1]) };
    }
    const out = [];
    for (const [question, sql] of Q)
      out.push({ question, rows: await db.query(sql) });
    return out;
  }
  if (cmd === "add")
    return transaction(db, async () => {
      let rows;
      if (ref === "store") {
        const country = required(f.country, "--country");
        if (!["NZ", "AU"].includes(country))
          throw Error("Country must be NZ or AU");
        const zone =
          f.timezone ||
          (country === "NZ" ? "Pacific/Auckland" : "Australia/Melbourne");
        new Intl.DateTimeFormat("en", { timeZone: zone });
        rows = await db.query(
          "insert into stores(name,country,currency,timezone) values($1,$2,$3,$4) returning *",
          [
            required(f.name, "--name"),
            country,
            country === "NZ" ? "NZD" : "AUD",
            zone,
          ],
        );
      } else if (ref === "customer")
        rows = await db.query(
          "insert into customers(name,email,phone,address) values($1,$2,$3,$4) returning *",
          [
            required(f.name, "--name"),
            f.email || "",
            f.phone || "",
            f.address || "",
          ],
        );
      else if (ref === "order") {
        const c = await resolve(db, "customers", f.customer),
          s = await resolve(db, "stores", f.store);
        rows = await db.query(
          "insert into orders(ticket,customer_id,store_id,due_on,received_on,total_cents,service) values($1,$2,$3,$4,$5,$6,$7) returning *",
          [
            required(f.ticket, "--ticket"),
            c.id,
            s.id,
            date(f.due, "--due"),
            f.received ? date(f.received, "--received") : await today(db, s.id),
            cents(f.total || "0"),
            f.service || "dry-clean",
          ],
        );
      } else if (ref === "garment") {
        const o = await resolve(db, "orders", f.order, "ticket");
        if (!["received", "processing"].includes(o.status))
          throw Error("Add garments only to received or processing orders");
        rows = await db.query(
          "insert into garments(order_id,tag,description,care_label,condition_in) values($1,$2,$3,$4,$5) returning *",
          [
            o.id,
            required(f.tag, "--tag"),
            required(f.description, "--description"),
            f.care || "",
            f.condition || "",
          ],
        );
      } else if (ref === "run") {
        const s = await resolve(db, "stores", f.store);
        rows = await db.query(
          "insert into runs(name,store_id,run_on,driver) values($1,$2,$3,$4) returning *",
          [
            required(f.name, "--name"),
            s.id,
            date(f.on, "--on"),
            required(f.driver, "--driver"),
          ],
        );
      } else if (ref === "stop") {
        const r = await resolve(db, "runs", f.run),
          o = await resolve(db, "orders", f.order, "ticket");
        if (r.store_id !== o.store_id)
          throw Error("Run and order must belong to the same store");
        rows = await db.query(
          "insert into stops(run_id,order_id,sequence,kind,address) values($1,$2,$3,$4,$5) returning *",
          [
            r.id,
            o.id,
            integer(f.sequence),
            required(f.kind, "--kind"),
            required(f.address, "--address"),
          ],
        );
      } else if (ref === "claim") {
        const o = await resolve(db, "orders", f.order, "ticket");
        rows = await db.query(
          "insert into claims(order_id,issue,opened_on,follow_up_on) values($1,$2,$3,$4) returning *",
          [
            o.id,
            required(f.issue, "--issue"),
            await today(db, o.store_id),
            date(f["follow-up"], "--follow-up"),
          ],
        );
      } else if (ref === "substance") {
        const s = await resolve(db, "stores", f.store);
        rows = await db.query(
          "insert into substances(store_id,name,location,max_quantity,hazard_class,sds_reference,sds_review_on) values($1,$2,$3,$4,$5,$6,$7) returning *",
          [
            s.id,
            required(f.name, "--name"),
            f.location || "",
            f.quantity || "",
            f.hazard || "",
            f.sds || "",
            f.review ? date(f.review, "--review") : null,
          ],
        );
      } else throw Error("Unknown add type");
      return rows[0];
    });
  if (cmd === "amend-garment") {
    const g = await resolve(db, "garments", ref, "tag");
    return (
      await db.query(
        "update garments set care_label=$2,condition_in=$3,description=$4 where id=$1 returning *",
        [
          g.id,
          f.care ?? g.care_label,
          f.condition ?? g.condition_in,
          f.description ?? g.description,
        ],
      )
    )[0];
  }
  if (cmd === "progress")
    return transaction(db, async () => {
      const g = await resolve(db, "garments", ref, "tag");
      const [o] = await db.query(
        "select * from orders where id=$1 for update",
        [g.order_id],
      );
      if (!["received", "processing"].includes(o.status))
        throw Error("Order must be in production");
      const stage = required(f.stage, "--stage");
      if (
        stage === "checked" &&
        (!g.care_label || !g.condition_in || !(f.rack || g.rack) || !f.actor)
      )
        throw Error(
          "Checking requires care, intake condition, rack and --actor",
        );
      const r = await db.query(
        "update garments set stage=$2,rack=$3,checked_by=$4 where id=$1 returning *",
        [g.id, stage, f.rack ?? g.rack, stage === "checked" ? f.actor : ""],
      );
      await db.query("update orders set status='processing' where id=$1", [
        o.id,
      ]);
      await audit(db, o.id, f.actor || "operator", `${g.tag}: ${stage}`);
      return r[0];
    });
  if (cmd === "reopen")
    return transaction(db, async () => {
      const o = await resolve(db, "orders", ref, "ticket");
      if (!["ready", "received", "processing"].includes(o.status))
        throw Error("Only active orders can be reopened");
      await audit(
        db,
        o.id,
        f.actor || "operator",
        required(f.reason, "--reason"),
      );
      return (
        await db.query(
          "update orders set status='processing',ready_on=null where id=$1 returning *",
          [o.id],
        )
      )[0];
    });
  if (cmd === "ready" || cmd === "collect")
    return transaction(db, async () => {
      let o = await resolve(db, "orders", ref, "ticket");
      [o] = await db.query("select * from orders where id=$1 for update", [
        o.id,
      ]);
      const day = await today(db, o.store_id);
      if (cmd === "ready") {
        if (!["received", "processing"].includes(o.status))
          throw Error("Only production orders can become ready");
        const b = (
          await db.query("select * from v_order_board where id=$1", [o.id])
        )[0];
        if (b.pieces === 0 || b.unfinished > 0)
          throw Error(
            "Every garment needs a check, checker and rack before ready",
          );
        await db.query(
          "update orders set status='ready',ready_on=$2 where id=$1",
          [o.id, day],
        );
      } else {
        if (o.status !== "ready")
          throw Error("Only ready orders can be collected");
        await db.query(
          "update orders set status='collected',collected_on=$2 where id=$1",
          [o.id, day],
        );
      }
      await audit(
        db,
        o.id,
        f.actor || "operator",
        cmd === "ready"
          ? "Marked ready"
          : "Collected; payment status unchanged",
      );
      return (
        await db.query("select * from v_order_board where id=$1", [o.id])
      )[0];
    });
  if (cmd === "complete-stop")
    return transaction(db, async () => {
      const st = await resolve(db, "stops", ref, "id");
      const [o] = await db.query(
        "select * from orders where id=$1 for update",
        [st.order_id],
      );
      if (st.completed_at) throw Error("Stop already completed");
      if (st.kind === "delivery" && o.status !== "ready")
        throw Error("Delivery requires a ready order");
      if (st.kind === "delivery") {
        await db.query(
          "update orders set status='collected',collected_on=$2 where id=$1",
          [o.id, await today(db, o.store_id)],
        );
        await audit(
          db,
          o.id,
          f.actor || "operator",
          "Delivery completed; payment status unchanged",
        );
      }
      return (
        await db.query(
          "update stops set completed_at=now() where id=$1 returning *",
          [st.id],
        )
      )[0];
    });
  if (cmd === "resolve-claim")
    return transaction(db, async () => {
      const c = await resolve(db, "claims", ref, "id"),
        o = await resolve(db, "orders", c.order_id, "id");
      const remedy = required(f.remedy, "--remedy");
      const r = await db.query(
        "update claims set status='resolved',remedy=$2,resolved_on=$3 where id=$1 returning *",
        [c.id, remedy, await today(db, o.store_id)],
      );
      await audit(db, o.id, f.actor || "operator", `Claim resolved: ${remedy}`);
      return r[0];
    });
  if (cmd === "review-substance") {
    const s = await resolve(db, "substances", ref);
    return (
      await db.query(
        "update substances set sds_reference=$2,sds_review_on=$3,location=$4,max_quantity=$5,hazard_class=$6 where id=$1 returning *",
        [
          s.id,
          required(f.sds, "--sds"),
          date(f.review, "--review"),
          f.location ?? s.location,
          f.quantity ?? s.max_quantity,
          f.hazard ?? s.hazard_class,
        ],
      )
    )[0];
  }
  if (cmd === "log") {
    const o = await resolve(db, "orders", ref, "ticket");
    await audit(
      db,
      o.id,
      required(f.actor, "--actor"),
      required(f.note, "--note"),
    );
    return { ticket: o.ticket, logged: true };
  }
  if (cmd === "draft-pickup") {
    const o = await resolve(db, "orders", ref, "ticket");
    if (o.status !== "ready")
      throw Error("Pickup drafts require a ready order");
    const c = await resolve(db, "customers", o.customer_id, "id");
    return dumpDraft(
      `pickup-${o.id}-${stamp()}.md`,
      `# Draft only, not sent\n\nTo: ${c.name}\n\nYour order ${o.ticket} is ready for collection. Please contact the store to arrange collection.\n\nReview the ticket and customer details before sending.\n`,
    );
  }
  if (cmd === "weekly-review") {
    const a = await run(db, ["attention"]),
      m = await run(db, ["metrics"]),
      d = await run(db, ["delivery-run"]);
    return dumpDraft(
      `weekly-review-${stamp()}.md`,
      [
        "# Weekly laundry review",
        "Fictional data if running the demo. Draft only.",
        "## Attention",
        render(a),
        "## Orders and balances",
        render(m),
        "## Delivery commitments",
        render(d),
        "## Decisions",
        "Assign overdue tickets, contact overdue collections, verify delivery readiness and review unresolved claims.",
      ].join("\n\n"),
    );
  }
  if (cmd === "export") {
    const out = {
      format: "laundry-backup-v1",
      exported_at: new Date().toISOString(),
      records: {},
    };
    for (const t of TABLES)
      out.records[t] = await db.query(`select * from ${t} order by id`);
    if (f.out) {
      fs.writeFileSync(
        path.resolve(required(f.out, "--out")),
        JSON.stringify(out, null, 2) + "\n",
        { flag: "wx" },
      );
      return {
        file: path.resolve(f.out),
        counts: Object.fromEntries(
          TABLES.map((t) => [t, out.records[t].length]),
        ),
      };
    }
    return out;
  }
  if (cmd === "import") {
    if (ref !== "cleancloud") throw Error("Importer supports cleancloud");
    return importCleanCloud(db, f);
  }
}

const aliases = {
  customers: {
    id: ["Customer ID", "CustomerID", "ID"],
    name: ["Name", "Customer Name", "customerName"],
    email: ["Email", "customerEmail"],
    phone: ["Phone", "Telephone", "customerTel"],
    address: ["Address", "customerAddress"],
  },
  orders: {
    id: ["Order ID", "OrderID", "ID"],
    customer: ["Customer ID", "CustomerID"],
    ticket: ["Order Number", "Ticket", "Order ID", "OrderID", "ID"],
    received: ["Created Date", "Order Date", "Date"],
    due: ["Due Date", "Ready Date"],
    status: ["Status", "Order Status"],
    total: ["Total", "Final Total", "Total Price"],
    paid: ["Paid Amount", "Amount Paid"],
    service: ["Service", "Order Type"],
    notes: ["Notes", "Order Notes"],
  },
};
async function importCleanCloud(db, f) {
  if (!f.customers && !f.orders)
    throw Error("Provide --customers and/or --orders CSV");
  const store = await resolve(db, "stores", f.store);
  const map = f.map
    ? JSON.parse(fs.readFileSync(required(f.map, "--map"), "utf8"))
    : {};
  for (const group of Object.keys(map)) {
    if (!["customers", "orders", "statuses"].includes(group))
      throw Error(`Unknown mapping group ${group}`);
    if (
      typeof map[group] !== "object" ||
      map[group] === null ||
      Array.isArray(map[group])
    )
      throw Error("Mapping groups must be objects");
    if (group !== "statuses")
      for (const key of Object.keys(map[group]))
        if (!(key in aliases[group]))
          throw Error(`Unknown mapping field ${group}.${key}`);
  }
  const value = (r, group, key) => {
    const custom = map[group]?.[key];
    if (custom !== undefined) {
      if (typeof custom !== "string" || !(custom in r))
        throw Error(`Missing mapped column ${custom}`);
      return r[custom];
    }
    return pick(r, ...aliases[group][key]);
  };
  const customers = f.customers
      ? parseCsv(fs.readFileSync(required(f.customers, "--customers"), "utf8"))
      : [],
    orders = f.orders
      ? parseCsv(fs.readFileSync(required(f.orders, "--orders"), "utf8"))
      : [];
  if ((f.customers && !customers.length) || (f.orders && !orders.length))
    throw Error("CSV contains no records");
  const statusMap = {
    new: "received",
    received: "received",
    cleaning: "processing",
    processing: "processing",
    ready: "ready",
    collected: "collected",
    completed: "collected",
    cancelled: "cancelled",
    ...(map.statuses || {}),
  };
  const seenC = new Set(),
    seenO = new Set(),
    summary = {
      dry_run: !!f["dry-run"],
      customers: customers.length,
      orders: orders.length,
      warnings: [
        "Order exports do not create individual garment tags. Complete intake detail for active tickets.",
        "No card data, payments, notifications or driver tracking are imported.",
      ],
    };
  return transaction(
    db,
    async () => {
      for (const [i, r] of customers.entries()) {
        const id = required(
          value(r, "customers", "id"),
          `customer ID row ${i + 2}`,
        );
        if (seenC.has(id)) throw Error(`Duplicate customer ID ${id}`);
        seenC.add(id);
        await db.query(
          `insert into customers(external_id,name,email,phone,address) values($1,$2,$3,$4,$5) on conflict(external_id) do update set name=excluded.name,email=excluded.email,phone=excluded.phone,address=excluded.address`,
          [
            "cleancloud:" + store.id + ":" + id,
            required(
              value(r, "customers", "name"),
              `customer name row ${i + 2}`,
            ),
            value(r, "customers", "email"),
            value(r, "customers", "phone"),
            value(r, "customers", "address"),
          ],
        );
      }
      for (const [i, r] of orders.entries()) {
        const id = required(value(r, "orders", "id"), `order ID row ${i + 2}`);
        if (seenO.has(id)) throw Error(`Duplicate order ID ${id}`);
        seenO.add(id);
        const cid = required(
            value(r, "orders", "customer"),
            "order customer ID",
          ),
          c = await db.query("select id from customers where external_id=$1", [
            "cleancloud:" + store.id + ":" + cid,
          ]);
        if (c.length !== 1) throw Error(`Order ${id}: missing customer ${cid}`);
        const rawStatus = required(
            value(r, "orders", "status"),
            "order status",
          ).toLowerCase(),
          status = statusMap[rawStatus];
        if (
          ![
            "received",
            "processing",
            "ready",
            "collected",
            "cancelled",
          ].includes(status)
        )
          throw Error(
            `Order ${id}: unknown status ${rawStatus}; map it explicitly`,
          );
        const received = date(value(r, "orders", "received"), "order date"),
          due = date(value(r, "orders", "due"), "due date");
        const total = cents(required(value(r, "orders", "total"), "total")),
          paid = cents(value(r, "orders", "paid") || "0");
        // Header-level imports never assert a ready/collection date that the export did not supply.
        const ext = "cleancloud:" + store.id + ":" + id,
          ticket =
            "CC-" +
            store.name +
            "-" +
            required(value(r, "orders", "ticket"), "ticket");
        await db.query(
          `insert into orders(external_id,ticket,customer_id,store_id,status,received_on,due_on,total_cents,paid_cents,service,notes,source_data) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb) on conflict(external_id) do update set ticket=excluded.ticket,customer_id=excluded.customer_id,status=excluded.status,ready_on=null,collected_on=null,received_on=excluded.received_on,due_on=excluded.due_on,total_cents=excluded.total_cents,paid_cents=excluded.paid_cents,service=excluded.service,notes=excluded.notes,source_data=excluded.source_data`,
          [
            ext,
            ticket,
            c[0].id,
            store.id,
            status,
            received,
            due,
            total,
            paid,
            value(r, "orders", "service") || "unspecified",
            value(r, "orders", "notes"),
            JSON.stringify(r),
          ],
        );
      }
      return summary;
    },
    !!f["dry-run"],
  );
}
export function render(result) {
  if (typeof result === "string") return result;
  if (Array.isArray(result)) {
    if (!result.length) return "  (none)";
    if (result[0]?.question)
      return result.map((x) => x.question + "\n" + render(x.rows)).join("\n\n");
    const cols = Object.keys(result[0]).filter(
      (k) => !["id", "source_data"].includes(k),
    );
    return table(
      result,
      cols.map((key) => ({
        key,
        label: key.replace(/_cents$/, "").replaceAll("_", " "),
        width: 70,
        format: (v, row) =>
          v == null
            ? ""
            : key.endsWith("_cents")
              ? `${row.currency || ""} ${(Number(v) / 100).toFixed(2)}`.trim()
              : v instanceof Date
                ? v.toISOString()
                : typeof v === "object"
                  ? JSON.stringify(v)
                  : v,
      })),
    );
  }
  if (result?.question) return result.question + "\n" + render(result.rows);
  if (result?.order)
    return Object.entries(result)
      .map(([k, v]) => k + "\n" + render(Array.isArray(v) ? v : [v]))
      .join("\n\n");
  return JSON.stringify(result, null, 2);
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  let db;
  try {
    db = await getDb();
    const r = await run(db, process.argv.slice(2));
    console.log(
      process.argv.includes("--json") ? JSON.stringify(r, null, 2) : render(r),
    );
  } catch (e) {
    if (process.argv.includes("--json"))
      console.error(
        JSON.stringify({
          error: e.message,
          ...(e.candidates ? { candidates: e.candidates } : {}),
        }),
      );
    else console.error(e.message);
    process.exitCode = 1;
  } finally {
    if (db) await db.close();
  }
}
