-- Fictional demo business. Relative dates keep the attention lists useful.
begin;
insert into stores (id,name,country,currency,timezone) values
('00000001-0000-4000-8000-000000000001','Harbour Laundry','NZ','NZD','Pacific/Auckland'),
('00000002-0000-4000-8000-000000000001','Southbank Laundry','AU','AUD','Australia/Melbourne')
on conflict do nothing;
insert into customers (id,external_id,name,email,phone,address,notes) values
('00000100-0000-4000-8000-000000000001','DEMO-C0','Aroha Bennett','demo0@example.invalid','','Demo address 0','Fictional demo record'),
('00000101-0000-4000-8000-000000000001','DEMO-C1','Harbour Lodge','demo1@example.invalid','','Demo address 1','Fictional demo record'),
('00000102-0000-4000-8000-000000000001','DEMO-C2','Harbour Dental','demo2@example.invalid','','Demo address 2','Fictional demo record'),
('00000103-0000-4000-8000-000000000001','DEMO-C3','Leo Martin','demo3@example.invalid','','Demo address 3','Fictional demo record'),
('00000104-0000-4000-8000-000000000001','DEMO-C4','Mia Chen','demo4@example.invalid','','Demo address 4','Fictional demo record'),
('00000105-0000-4000-8000-000000000001','DEMO-C5','Southbank Suites','demo5@example.invalid','','Demo address 5','Fictional demo record')
on conflict do nothing;
insert into orders (id,external_id,ticket,customer_id,store_id,status,service,received_on,due_on,ready_on,collected_on,total_cents,paid_cents,notes) values
('00000200-0000-4000-8000-000000000001','DEMO-O0','HL-1001','00000100-0000-4000-8000-000000000001','00000001-0000-4000-8000-000000000001','processing','dry-clean',current_date-8,current_date+(-5),null,null,1800,1800,'Demo ticket, inspect before using any instructions'),
('00000201-0000-4000-8000-000000000001','DEMO-O1','HL-1002','00000101-0000-4000-8000-000000000001','00000001-0000-4000-8000-000000000001','processing','linen',current_date-8,current_date+(-5),null,null,2500,0,'Demo ticket, inspect before using any instructions'),
('00000202-0000-4000-8000-000000000001','DEMO-O2','HL-1003','00000102-0000-4000-8000-000000000001','00000001-0000-4000-8000-000000000001','ready','linen',current_date-25,current_date+(-5),current_date-12,null,3200,0,'Demo ticket, inspect before using any instructions'),
('00000203-0000-4000-8000-000000000001','DEMO-O3','HL-1004','00000103-0000-4000-8000-000000000001','00000001-0000-4000-8000-000000000001','ready','dry-clean',current_date-25,current_date+(-5),current_date-12,null,3900,3900,'Demo ticket, inspect before using any instructions'),
('00000204-0000-4000-8000-000000000001','DEMO-O4','HL-1005','00000104-0000-4000-8000-000000000001','00000001-0000-4000-8000-000000000001','received','dry-clean',current_date-8,current_date+(2),null,null,4600,0,'Demo ticket, inspect before using any instructions'),
('00000205-0000-4000-8000-000000000001','DEMO-O5','HL-1006','00000105-0000-4000-8000-000000000001','00000002-0000-4000-8000-000000000001','collected','linen',current_date-25,current_date+(-5),current_date-12,current_date-2,5300,0,'Demo ticket, inspect before using any instructions'),
('00000206-0000-4000-8000-000000000001','DEMO-O6','HL-1007','00000100-0000-4000-8000-000000000001','00000001-0000-4000-8000-000000000001','processing','dry-clean',current_date-8,current_date+(1),null,null,6000,6000,'Demo ticket, inspect before using any instructions'),
('00000207-0000-4000-8000-000000000001','DEMO-O7','HL-1008','00000101-0000-4000-8000-000000000001','00000001-0000-4000-8000-000000000001','ready','linen',current_date-25,current_date+(2),current_date-12,null,6700,0,'Demo ticket, inspect before using any instructions'),
('00000208-0000-4000-8000-000000000001','DEMO-O8','HL-1009','00000102-0000-4000-8000-000000000001','00000001-0000-4000-8000-000000000001','received','linen',current_date-8,current_date+(3),null,null,7400,0,'Demo ticket, inspect before using any instructions'),
('00000209-0000-4000-8000-000000000001','DEMO-O9','HL-1010','00000103-0000-4000-8000-000000000001','00000001-0000-4000-8000-000000000001','processing','dry-clean',current_date-8,current_date+(1),null,null,8100,8100,'Demo ticket, inspect before using any instructions'),
('00000210-0000-4000-8000-000000000001','DEMO-O10','HL-1011','00000104-0000-4000-8000-000000000001','00000001-0000-4000-8000-000000000001','collected','dry-clean',current_date-25,current_date+(-5),current_date-12,current_date-2,8800,0,'Demo ticket, inspect before using any instructions'),
('00000211-0000-4000-8000-000000000001','DEMO-O11','HL-1012','00000105-0000-4000-8000-000000000001','00000002-0000-4000-8000-000000000001','cancelled','linen',current_date-8,current_date+(3),null,null,9500,0,'Demo ticket, inspect before using any instructions')
on conflict do nothing;
insert into garments (id,order_id,tag,description,care_label,condition_in,stage,rack,checked_by,notes) values
('00000300-0000-4000-8000-000000000001','00000200-0000-4000-8000-000000000001','TAG-100','Wool jacket','Check manufacturer label','Inspected at intake','checked','A-1','Jo','Button loose'),
('00000301-0000-4000-8000-000000000001','00000200-0000-4000-8000-000000000001','TAG-101','Cotton shirt','','Inspected at intake','cleaning','','','Button loose'),
('00000302-0000-4000-8000-000000000001','00000201-0000-4000-8000-000000000001','TAG-102','Linen bag 1','Check manufacturer label','','checked','A-2','Jo',''),
('00000303-0000-4000-8000-000000000001','00000201-0000-4000-8000-000000000001','TAG-103','Linen bag 2','Check manufacturer label','Inspected at intake','reclean','','',''),
('00000304-0000-4000-8000-000000000001','00000202-0000-4000-8000-000000000001','TAG-104','Linen bag 1','Check manufacturer label','Inspected at intake','checked','A-3','Jo',''),
('00000305-0000-4000-8000-000000000001','00000202-0000-4000-8000-000000000001','TAG-105','Linen bag 2','Check manufacturer label','Inspected at intake','checked','A-3','Jo',''),
('00000306-0000-4000-8000-000000000001','00000203-0000-4000-8000-000000000001','TAG-106','Wool jacket','Check manufacturer label','Inspected at intake','checked','A-4','Jo',''),
('00000307-0000-4000-8000-000000000001','00000203-0000-4000-8000-000000000001','TAG-107','Cotton shirt','Check manufacturer label','Inspected at intake','checked','A-4','Jo',''),
('00000308-0000-4000-8000-000000000001','00000204-0000-4000-8000-000000000001','TAG-108','Wool jacket','Check manufacturer label','Inspected at intake','checked','A-5','Jo',''),
('00000309-0000-4000-8000-000000000001','00000204-0000-4000-8000-000000000001','TAG-109','Cotton shirt','Check manufacturer label','Inspected at intake','cleaning','','',''),
('00000310-0000-4000-8000-000000000001','00000205-0000-4000-8000-000000000001','TAG-110','Linen bag 1','Check manufacturer label','Inspected at intake','checked','A-6','Jo',''),
('00000311-0000-4000-8000-000000000001','00000205-0000-4000-8000-000000000001','TAG-111','Linen bag 2','Check manufacturer label','Inspected at intake','checked','A-6','Jo',''),
('00000312-0000-4000-8000-000000000001','00000206-0000-4000-8000-000000000001','TAG-112','Wool jacket','Check manufacturer label','Inspected at intake','checked','A-7','Jo',''),
('00000313-0000-4000-8000-000000000001','00000206-0000-4000-8000-000000000001','TAG-113','Cotton shirt','Check manufacturer label','Inspected at intake','cleaning','','',''),
('00000314-0000-4000-8000-000000000001','00000207-0000-4000-8000-000000000001','TAG-114','Linen bag 1','Check manufacturer label','Inspected at intake','checked','A-8','Jo',''),
('00000315-0000-4000-8000-000000000001','00000207-0000-4000-8000-000000000001','TAG-115','Linen bag 2','Check manufacturer label','Inspected at intake','checked','A-8','Jo',''),
('00000316-0000-4000-8000-000000000001','00000208-0000-4000-8000-000000000001','TAG-116','Linen bag 1','Check manufacturer label','Inspected at intake','checked','A-9','Jo',''),
('00000317-0000-4000-8000-000000000001','00000208-0000-4000-8000-000000000001','TAG-117','Linen bag 2','Check manufacturer label','Inspected at intake','cleaning','','',''),
('00000318-0000-4000-8000-000000000001','00000209-0000-4000-8000-000000000001','TAG-118','Wool jacket','Check manufacturer label','Inspected at intake','checked','A-10','Jo',''),
('00000319-0000-4000-8000-000000000001','00000209-0000-4000-8000-000000000001','TAG-119','Cotton shirt','Check manufacturer label','Inspected at intake','cleaning','','',''),
('00000320-0000-4000-8000-000000000001','00000210-0000-4000-8000-000000000001','TAG-120','Wool jacket','Check manufacturer label','Inspected at intake','checked','A-11','Jo',''),
('00000321-0000-4000-8000-000000000001','00000210-0000-4000-8000-000000000001','TAG-121','Cotton shirt','Check manufacturer label','Inspected at intake','checked','A-11','Jo',''),
('00000322-0000-4000-8000-000000000001','00000211-0000-4000-8000-000000000001','TAG-122','Linen bag 1','Check manufacturer label','Inspected at intake','checked','A-12','Jo',''),
('00000323-0000-4000-8000-000000000001','00000211-0000-4000-8000-000000000001','TAG-123','Linen bag 2','Check manufacturer label','Inspected at intake','cleaning','','','')
on conflict do nothing;
insert into runs (id,name,store_id,run_on,driver) values
('00000400-0000-4000-8000-000000000001','Harbour morning','00000001-0000-4000-8000-000000000001',current_date,'Jo')
on conflict do nothing;
insert into stops (id,run_id,order_id,sequence,kind,address) values
('00000410-0000-4000-8000-000000000001','00000400-0000-4000-8000-000000000001','00000202-0000-4000-8000-000000000001',1,'delivery','Demo address 2'),
('00000411-0000-4000-8000-000000000001','00000400-0000-4000-8000-000000000001','00000200-0000-4000-8000-000000000001',2,'delivery','Demo address 0'),
('00000412-0000-4000-8000-000000000001','00000400-0000-4000-8000-000000000001','00000203-0000-4000-8000-000000000001',3,'delivery','Demo address 3')
on conflict do nothing;
insert into claims (id,order_id,issue,opened_on,follow_up_on) values
('00000500-0000-4000-8000-000000000001','00000201-0000-4000-8000-000000000001','Stain still visible after first clean',current_date-6,current_date-2),
('00000501-0000-4000-8000-000000000001','00000206-0000-4000-8000-000000000001','Check lining with customer',current_date-1,current_date+2)
on conflict do nothing;
insert into substances (id,store_id,name,location,max_quantity,hazard_class,sds_reference,sds_review_on) values
('00000600-0000-4000-8000-000000000001','00000001-0000-4000-8000-000000000001','Demo spot remover','','','','',null),
('00000601-0000-4000-8000-000000000001','00000001-0000-4000-8000-000000000001','Demo detergent','Cabinet B','20 litres','Use supplier classification','Demo placeholder: replace with supplier SDS',current_date+180)
on conflict do nothing;
insert into activities (id,order_id,actor,note) values
('00000700-0000-4000-8000-000000000001','00000200-0000-4000-8000-000000000001','Jo','Received and counted two items'),
('00000701-0000-4000-8000-000000000001','00000201-0000-4000-8000-000000000001','Jo','Received and counted two items'),
('00000702-0000-4000-8000-000000000001','00000202-0000-4000-8000-000000000001','Jo','Received and counted two items'),
('00000703-0000-4000-8000-000000000001','00000203-0000-4000-8000-000000000001','Jo','Received and counted two items'),
('00000704-0000-4000-8000-000000000001','00000204-0000-4000-8000-000000000001','Jo','Received and counted two items'),
('00000705-0000-4000-8000-000000000001','00000205-0000-4000-8000-000000000001','Jo','Received and counted two items'),
('00000706-0000-4000-8000-000000000001','00000206-0000-4000-8000-000000000001','Jo','Received and counted two items'),
('00000707-0000-4000-8000-000000000001','00000207-0000-4000-8000-000000000001','Jo','Received and counted two items'),
('00000708-0000-4000-8000-000000000001','00000208-0000-4000-8000-000000000001','Jo','Received and counted two items'),
('00000709-0000-4000-8000-000000000001','00000209-0000-4000-8000-000000000001','Jo','Received and counted two items'),
('00000710-0000-4000-8000-000000000001','00000210-0000-4000-8000-000000000001','Jo','Received and counted two items'),
('00000711-0000-4000-8000-000000000001','00000211-0000-4000-8000-000000000001','Jo','Received and counted two items')
on conflict do nothing;
commit;
