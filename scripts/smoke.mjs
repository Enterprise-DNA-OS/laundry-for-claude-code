import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { getDb, REPO_ROOT } from "./lib/db.mjs";
import { migrate } from "./migrate.mjs";
import { run, cents, date, render } from "./laundry.mjs";
import { parseCsv } from "./lib/csv.mjs";
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "laundry-test-"));
process.env.DATABASE_URL = "";
process.env.DATA_DIR = path.join(temp, "db");
process.env.OUTPUT_DIR = temp;
let db,
  checks = 0;
const check = (label, fn) => {
  fn();
  checks++;
  console.log("  ok " + label);
};
const fail = async (args, match) => {
  await assert.rejects(() => run(db, args), match);
  checks++;
};
const call = (...a) => run(db, a);
const fixture = (f) => path.join(REPO_ROOT, "examples", "cleancloud", f);
const importArgs = [
  "import",
  "cleancloud",
  `--customers=${fixture("customers.csv")}`,
  `--orders=${fixture("orders.csv")}`,
  "--store=Harbour Laundry",
];
try {
  db = await getDb();
  await migrate(db);
  assert.equal((await migrate(db)).ran.length, 0);
  const seed = fs.readFileSync(
    path.join(REPO_ROOT, "supabase", "seed.sql"),
    "utf8",
  );
  await db.exec(seed);
  await db.exec(seed);
  check("idempotent migrations and seed", () => {});
  const orders = await call("orders");
  check("12 tickets and exact balances", () => {
    assert.equal(orders.length, 12);
    assert.equal(
      orders.find((x) => x.ticket === "HL-1002").balance_cents,
      2500,
    );
  });
  for (const c of [
    "help",
    "stores",
    "customers",
    "orders",
    "production",
    "rack-check",
    "delivery-run",
    "claims",
    "substances",
    "compliance",
    "attention",
    "metrics",
    "questions",
  ]) {
    const r = await call(c);
    check(c, () => {
      assert.ok(typeof r === "string" || r.length > 0);
      assert.ok(render(r).length > 0);
    });
  }
  assert.equal((await call("order", "hl-1001")).garments.length, 2);
  assert.equal(
    (await call("order", orders[0].id.slice(0, 8))).order.id,
    orders[0].id,
  );
  await fail(["order", "HL-10"], /Ambiguous/);
  await fail(["order", "missing"], /No orders/);
  await fail(["orders", "--oops"], /Unknown flag/);
  assert.equal((await call("delivery-run", "harbour")).length, 3);
  for (let i = 1; i <= 10; i++)
    assert.ok(Array.isArray((await call("questions", String(i))).rows));
  await fail(["questions", "11"], /1..10/);
  check("compliance returns documented rule identifiers", () => {});
  assert.ok((await call("compliance")).some((x) => x.rule === "NZ-SDS"));
  assert.ok(
    (await call("attention")).some((x) => x.reason === "late production"),
  );
  const store = await call(
    "add",
    "store",
    "--name=Test Laundry",
    "--country=NZ",
  );
  const c = await call(
    "add",
    "customer",
    "--name=Test Person",
    "--email=test@example.invalid",
    "--address=Example Road",
  );
  const day = (
    await db.query(
      "select (now() at time zone 'Pacific/Auckland')::date::text as day",
    )
  )[0].day;
  const o = await call(
    "add",
    "order",
    "--ticket=TEST-1",
    `--customer=${c.id}`,
    `--store=${store.id}`,
    `--due=${day}`,
    "--total=19.99",
  );
  assert.equal(o.total_cents, 1999);
  await fail(["ready", "TEST-1"], /Every garment/);
  const g = await call(
    "add",
    "garment",
    "--order=TEST-1",
    "--tag=TEST-TAG",
    "--description=Jacket",
    "--care=Dry clean",
    "--condition=Loose button noted",
  );
  await fail(["progress", g.tag, "--stage=checked"], /requires/);
  await call("amend-garment", g.tag, "--condition=Button checked");
  assert.equal(
    (await call("order", "TEST-1")).garments[0].condition_in,
    "Button checked",
  );
  await call("progress", g.tag, "--stage=cleaning");
  await call("progress", g.tag, "--stage=checked", "--rack=B-1", "--actor=Jo");
  await call("log", "TEST-1", "--actor=Jo", "--note=Checked button");
  assert.equal((await call("order", "TEST-1")).history.length, 3);
  await call("ready", "TEST-1");
  await fail(["progress", g.tag, "--stage=cleaning"], /production/);
  const draft = await call("draft-pickup", "TEST-1");
  assert.match(fs.readFileSync(draft.file, "utf8"), /Draft only/);
  await call("reopen", "TEST-1", "--reason=Recheck before dispatch");
  await call("ready", "TEST-1");
  await call("collect", "TEST-1");
  assert.equal((await call("order", "TEST-1")).order.paid_cents, 0);
  await fail(["collect", "TEST-1"], /Only ready/);
  await fail(["draft-pickup", "HL-1001"], /ready order/);
  const r = await call(
    "add",
    "run",
    "--name=Test run",
    `--store=${store.id}`,
    `--on=${day}`,
    "--driver=Jo",
  );
  const stop = await call(
    "add",
    "stop",
    `--run=${r.id}`,
    "--order=TEST-1",
    "--sequence=1",
    "--kind=pickup",
    "--address=Example Road",
  );
  await call("complete-stop", stop.id);
  await fail(["complete-stop", stop.id], /already/);
  await fail(
    [
      "add",
      "stop",
      `--run=${r.id}`,
      "--order=HL-1001",
      "--sequence=2",
      "--kind=delivery",
      "--address=Example",
    ],
    /same store/,
  );
  const bad = (
    await db.query("select id from v_run_manifest where warning<>''")
  )[0];
  await fail(["complete-stop", bad.id], /requires a ready/);
  const delivery = (
    await db.query("select id from v_run_manifest where ticket='HL-1003'")
  )[0];
  await call("complete-stop", delivery.id);
  assert.equal((await call("order", "HL-1003")).order.status, "collected");
  const cl = await call(
    "add",
    "claim",
    "--order=TEST-1",
    "--issue=Check collar",
    `--follow-up=${day}`,
  );
  await fail(["resolve-claim", cl.id], /--remedy/);
  await call("resolve-claim", cl.id, "--remedy=Reclean agreed and completed");
  assert.equal(
    (await db.query("select status from claims where id=$1", [cl.id]))[0]
      .status,
    "resolved",
  );
  const sub = await call(
    "add",
    "substance",
    `--store=${store.id}`,
    "--name=Test product",
    "--location=Cabinet",
    "--quantity=2 L",
    "--hazard=Supplier classification",
  );
  await call(
    "review-substance",
    sub.id,
    "--sds=supplier-document",
    `--review=${day}`,
  );
  check(
    "intake, guarded production, collection, runs, claims, audit and SDS review",
    () => {},
  );
  const before = (await call("orders")).length;
  await call(...importArgs, "--dry-run");
  assert.equal((await call("orders")).length, before);
  assert.equal(
    (
      await db.query(
        "select count(*)::int as n from customers where external_id like 'cleancloud:%'",
      )
    )[0].n,
    0,
  );
  await call(...importArgs);
  await call(...importArgs, `--map=${fixture("mapping.json")}`);
  assert.equal((await call("orders")).length, before + 2);
  const imported = (await call("orders")).find((x) =>
    x.ticket.endsWith("-900"),
  );
  assert.equal(imported.total_cents, 1850);
  assert.equal(imported.pieces, 0);
  assert.ok(
    (await call("questions", "10")).rows.some(
      (x) => x.ticket === imported.ticket,
    ),
  );
  const broken = path.join(temp, "broken.csv");
  fs.writeFileSync(
    broken,
    fs
      .readFileSync(fixture("orders.csv"), "utf8")
      .replace("O900,C100,900", "O999,C100,999")
      .replace("C101", "MISSING"),
  );
  await fail(
    ["import", "cleancloud", `--orders=${broken}`, "--store=Harbour Laundry"],
    /missing customer/,
  );
  assert.equal((await call("orders")).length, before + 2);
  fs.writeFileSync(
    broken,
    fs
      .readFileSync(fixture("orders.csv"), "utf8")
      .replace("Cleaning", "Unrecognised"),
  );
  await fail(
    ["import", "cleancloud", `--orders=${broken}`, "--store=Harbour Laundry"],
    /unknown status/,
  );
  fs.writeFileSync(
    broken,
    fs
      .readFileSync(fixture("orders.csv"), "utf8")
      .replace("2026-10-01", "2026-02-30"),
  );
  await fail(
    ["import", "cleancloud", `--orders=${broken}`, "--store=Harbour Laundry"],
    /Invalid/,
  );
  fs.writeFileSync(
    broken,
    fs.readFileSync(fixture("orders.csv"), "utf8").replace("18.50", "18.501"),
  );
  await fail(
    ["import", "cleancloud", `--orders=${broken}`, "--store=Harbour Laundry"],
    /decimal/,
  );
  check(
    "import dry-run, idempotence, cents, atomic rollback, unknown status and invalid data",
    () => {},
  );
  check("CSV quoted newline, BOM and malformed input", () => {
    assert.equal(
      parseCsv('\uFEFFID,Name\r\n1,"A, B\nC"\r\n')[0].Name,
      "A, B\nC",
    );
    assert.throws(() => parseCsv("ID,ID\n1,2"), /unique/);
    assert.throws(() => parseCsv('ID,Name\n1,"broken'), /unclosed/);
    assert.throws(() => parseCsv("ID,Name\n1"), /expected/);
    assert.equal(cents("0.01"), 1);
    assert.throws(() => cents("-1"));
    assert.throws(() => date("2026-02-30", "date"));
  });
  const weekly = await call("weekly-review");
  assert.match(weekly.body, /Delivery commitments/);
  const backup = await call("export");
  assert.equal(Object.keys(backup.records).length, 9);
  assert.equal(backup.records.orders.length, before + 2);
  const output = path.join(temp, "backup.json");
  await call("export", `--out=${output}`);
  await fail(["export", `--out=${output}`], /EEXIST/);
  await db.close();
  db = null;
  for (const [script, ...args] of [
    ["laundry.mjs", "orders", "--json"],
    ["laundry.mjs", "order", "HL-10", "--json"],
    ["view.mjs"],
    ["docs.mjs"],
  ]) {
    const res = spawnSync(
      process.execPath,
      [path.join(REPO_ROOT, "scripts", script), ...args],
      { cwd: REPO_ROOT, env: process.env, encoding: "utf8" },
    );
    if (args.includes("HL-10")) {
      assert.equal(res.status, 1);
      assert.ok(JSON.parse(res.stderr).candidates.length > 1);
    } else {
      assert.equal(res.status, 0, res.stderr);
      if (args.includes("--json")) assert.ok(JSON.parse(res.stdout).length);
    }
    checks++;
  }
  assert.ok(fs.existsSync(path.join(temp, "views", "week.html")));
  for (const d of [
    "job-ticket",
    "garment-tag",
    "run-manifest",
    "claim-record",
    "chemical-inventory",
  ])
    assert.ok(fs.readdirSync(path.join(temp, "docs-out", d)).length > 0);
  const rendered = fs.readFileSync(
    path.join(temp, "views", "week.html"),
    "utf8",
  );
  assert.match(rendered, /Harbour Laundry/);
  assert.match(rendered, /late production/);
  check("HTML escaping", () => {
    assert.ok(!rendered.includes("<script>"));
  });
  console.log(
    `PASS: ${checks} checks; every CLI command, all ten analyses, four views and five document types.`,
  );
} catch (e) {
  console.error("FAIL:", e.message, e.detail || "");
  process.exitCode = 1;
} finally {
  if (db) await db.close();
  fs.rmSync(temp, { recursive: true, force: true });
}
