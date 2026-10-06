-- Imported ready dates remain unknown rather than appearing as zero days old.
create or replace view v_order_board as
 select o.id,o.ticket,c.name as customer,s.name as store,s.currency,o.service,o.status,o.received_on,o.due_on,o.ready_on,
 o.total_cents,o.paid_cents,o.total_cents-o.paid_cents as balance_cents,
 (select count(*)::integer from garments g where g.order_id=o.id) as pieces,
 (select count(*)::integer from garments g where g.order_id=o.id and (g.stage<>'checked' or g.checked_by='' or g.rack='')) as unfinished,
 greatest(0,(now() at time zone s.timezone)::date-o.due_on) as days_late,
 case when o.ready_on is not null then greatest(0,(now() at time zone s.timezone)::date-o.ready_on) else null::integer end as days_on_rack
 from orders o join customers c on c.id=o.customer_id join stores s on s.id=o.store_id;
