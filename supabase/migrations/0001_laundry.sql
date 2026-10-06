create table stores (
 id uuid primary key default gen_random_uuid(), name text not null unique,
 country text not null check(country in ('NZ','AU')), currency text not null check(currency in ('NZD','AUD')),
 timezone text not null default 'Pacific/Auckland', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table customers (
 id uuid primary key default gen_random_uuid(), external_id text unique, name text not null check(length(trim(name))>0),
 email text not null default '', phone text not null default '', address text not null default '', notes text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table orders (
 id uuid primary key default gen_random_uuid(), external_id text unique, ticket text not null unique,
 customer_id uuid not null references customers, store_id uuid not null references stores,
 status text not null default 'received' check(status in ('received','processing','ready','collected','cancelled')),
 service text not null default 'dry-clean', received_on date not null default current_date, due_on date not null,
 ready_on date, collected_on date, total_cents integer not null default 0 check(total_cents>=0),
 paid_cents integer not null default 0 check(paid_cents>=0 and paid_cents<=total_cents),
 notes text not null default '', source_data jsonb not null default '{}',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(due_on>=received_on), check(ready_on is null or ready_on>=received_on),
 check(collected_on is null or collected_on>=received_on)
);
create table garments (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references orders, tag text not null unique,
 description text not null, care_label text not null default '', condition_in text not null default '',
 stage text not null default 'received' check(stage in ('received','cleaning','pressing','checked','reclean')),
 rack text not null default '', checked_by text not null default '', notes text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table runs (
 id uuid primary key default gen_random_uuid(), name text not null unique, store_id uuid not null references stores,
 run_on date not null, driver text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table stops (
 id uuid primary key default gen_random_uuid(), run_id uuid not null references runs, order_id uuid not null references orders,
 sequence integer not null check(sequence>0), kind text not null check(kind in ('pickup','delivery')),
 address text not null check(length(trim(address))>0), completed_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(run_id,sequence), unique(run_id,order_id,kind)
);
create table claims (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references orders,
 issue text not null, opened_on date not null default current_date, follow_up_on date not null,
 status text not null default 'open' check(status in ('open','resolved')),
 remedy text not null default '', resolved_on date,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(status<>'resolved' or (length(trim(remedy))>0 and resolved_on is not null))
);
create table substances (
 id uuid primary key default gen_random_uuid(), store_id uuid not null references stores, name text not null,
 location text not null default '', max_quantity text not null default '', hazard_class text not null default '',
 sds_reference text not null default '', sds_review_on date,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(store_id,name)
);
create table activities (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references orders, actor text not null,
 note text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create function touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=clock_timestamp(); return new; end $$;
do $$ declare t text; begin foreach t in array array['stores','customers','orders','garments','runs','stops','claims','substances','activities'] loop
 execute format('create trigger touch_updated_at before update on %I for each row execute function touch_updated_at()',t); end loop; end $$;
create index orders_due on orders(status,due_on);
create index garments_order on garments(order_id);
create index activities_order on activities(order_id);
create index claims_order on claims(order_id);
create view v_order_board as
 select o.id,o.ticket,c.name as customer,s.name as store,s.currency,o.service,o.status,o.received_on,o.due_on,o.ready_on,
 o.total_cents,o.paid_cents,o.total_cents-o.paid_cents as balance_cents,
 (select count(*)::integer from garments g where g.order_id=o.id) as pieces,
 (select count(*)::integer from garments g where g.order_id=o.id and (g.stage<>'checked' or g.checked_by='' or g.rack='')) as unfinished,
 greatest(0,(now() at time zone s.timezone)::date-o.due_on) as days_late,
 case when o.ready_on is not null then greatest(0,(now() at time zone s.timezone)::date-o.ready_on) else 0 end as days_on_rack
 from orders o join customers c on c.id=o.customer_id join stores s on s.id=o.store_id;
create view v_production as
 select g.id,g.tag,o.ticket,c.name as customer,s.name as store,o.due_on,g.description,g.stage,g.rack,g.care_label,g.condition_in,g.checked_by
 from garments g join orders o on o.id=g.order_id join customers c on c.id=o.customer_id join stores s on s.id=o.store_id
 where o.status not in ('collected','cancelled');
create view v_run_manifest as
 select st.id,r.name as run,r.run_on,r.driver,st.sequence,st.kind,o.ticket,c.name as customer,st.address,
 o.status,(select count(*)::integer from garments g where g.order_id=o.id) as pieces,
 o.total_cents-o.paid_cents as balance_cents,s.currency,
 case when st.kind='delivery' and o.status<>'ready' and st.completed_at is null then 'NOT READY' else '' end as warning,st.completed_at
 from stops st join runs r on r.id=st.run_id join orders o on o.id=st.order_id join customers c on c.id=o.customer_id join stores s on s.id=o.store_id;
create view v_attention as
 select id,ticket,customer,store,'late production'::text as reason,days_late as days from v_order_board where status in ('received','processing') and days_late>0
 union all select id,ticket,customer,store,'uncollected over 7 days',days_on_rack from v_order_board where status='ready' and days_on_rack>=7
 union all select b.id,b.ticket,b.customer,b.store,'claim follow-up overdue', (now() at time zone s.timezone)::date-cl.follow_up_on
 from claims cl join orders o on o.id=cl.order_id join stores s on s.id=o.store_id join v_order_board b on b.id=o.id where cl.status='open' and cl.follow_up_on<(now() at time zone s.timezone)::date
 union all select id,ticket,customer,store,'imported order needs garment detail',0 from v_order_board where pieces=0 and status not in ('collected','cancelled');
create view v_compliance as
 select g.id,'CARE-RECORD'::text as rule,s.country,s.name as store,g.tag as record,'Record care label and intake condition before processing'::text as finding,'operating control'::text as basis
 from garments g join orders o on o.id=g.order_id join stores s on s.id=o.store_id where o.status not in ('collected','cancelled') and (g.care_label='' or g.condition_in='')
 union all select cl.id,'CLAIM-FOLLOWUP',s.country,s.name,o.ticket,'Review overdue customer remedy follow-up','operating control'
 from claims cl join orders o on o.id=cl.order_id join stores s on s.id=o.store_id where cl.status='open' and cl.follow_up_on<(now() at time zone s.timezone)::date
 union all select x.id,'NZ-SDS',s.country,s.name,x.name,'Obtain and make the safety data sheet accessible','statutory record'
 from substances x join stores s on s.id=x.store_id where s.country='NZ' and x.sds_reference=''
 union all select x.id,'NZ-INVENTORY',s.country,s.name,x.name,'Complete location, maximum quantity and hazard classification','statutory record'
 from substances x join stores s on s.id=x.store_id where s.country='NZ' and (x.location='' or x.max_quantity='' or x.hazard_class='')
 union all select x.id,'SDS-REVIEW',s.country,s.name,x.name,'Check the supplier for the current safety data sheet','operating control'
 from substances x join stores s on s.id=x.store_id where x.sds_review_on is null or x.sds_review_on<(now() at time zone s.timezone)::date;
