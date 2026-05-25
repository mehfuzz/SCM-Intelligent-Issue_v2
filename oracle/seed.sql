-- Oracle seed data for SCM Intelligent Issue Portal
-- Run AFTER oracle/schema.sql. Safe to re-run.
-- Password hash below = bcrypt('demo123', 10) — computed by bcryptjs.

-- ============================================================================
-- Users
-- ============================================================================
MERGE INTO app_users dst
USING (SELECT 'u1' id FROM dual) src ON (dst.id = src.id)
WHEN NOT MATCHED THEN INSERT (id,name,email,password_hash,must_change_password,role,department,avatar_initials)
  VALUES ('u1','Ravi Kumar','ravi.kumar@airtel.in','$2a$10$zMJQ.Vfe6Yin9zQKcEdCmOpbDXXSnuyag2bAKihREN4Fj0.6wr1Wu',0,'Submitter','SCM Operations','RK');

MERGE INTO app_users dst
USING (SELECT 'u2' id FROM dual) src ON (dst.id = src.id)
WHEN NOT MATCHED THEN INSERT (id,name,email,password_hash,must_change_password,role,department,avatar_initials)
  VALUES ('u2','Priya Sharma','priya.sharma@airtel.in','$2a$10$zMJQ.Vfe6Yin9zQKcEdCmOpbDXXSnuyag2bAKihREN4Fj0.6wr1Wu',0,'COE Admin','SCM Center of Excellence','PS');

MERGE INTO app_users dst
USING (SELECT 'u3' id FROM dual) src ON (dst.id = src.id)
WHEN NOT MATCHED THEN INSERT (id,name,email,password_hash,must_change_password,role,department,avatar_initials)
  VALUES ('u3','Amit Singh','amit.singh@airtel.in','$2a$10$zMJQ.Vfe6Yin9zQKcEdCmOpbDXXSnuyag2bAKihREN4Fj0.6wr1Wu',0,'POC Owner','Procurement Tech','AS');

MERGE INTO app_users dst
USING (SELECT 'u4' id FROM dual) src ON (dst.id = src.id)
WHEN NOT MATCHED THEN INSERT (id,name,email,password_hash,must_change_password,role,department,avatar_initials)
  VALUES ('u4','Neeta Rao','neeta.rao@airtel.in','$2a$10$zMJQ.Vfe6Yin9zQKcEdCmOpbDXXSnuyag2bAKihREN4Fj0.6wr1Wu',0,'Leadership','SCM Leadership','NR');

MERGE INTO app_users dst
USING (SELECT 'u5' id FROM dual) src ON (dst.id = src.id)
WHEN NOT MATCHED THEN INSERT (id,name,email,password_hash,must_change_password,role,department,avatar_initials)
  VALUES ('u5','System Admin','admin@airtel.in','$2a$10$zMJQ.Vfe6Yin9zQKcEdCmOpbDXXSnuyag2bAKihREN4Fj0.6wr1Wu',0,'System Admin','IT Platform','SA');

MERGE INTO app_users dst
USING (SELECT 'u6' id FROM dual) src ON (dst.id = src.id)
WHEN NOT MATCHED THEN INSERT (id,name,email,password_hash,must_change_password,role,department,avatar_initials)
  VALUES ('u6','Kushal Soni','kushal.soni@airtel.in','$2a$10$zMJQ.Vfe6Yin9zQKcEdCmOpbDXXSnuyag2bAKihREN4Fj0.6wr1Wu',0,'POC Owner','SCM CoE','KS');

MERGE INTO app_users dst
USING (SELECT 'u7' id FROM dual) src ON (dst.id = src.id)
WHEN NOT MATCHED THEN INSERT (id,name,email,password_hash,must_change_password,role,department,avatar_initials)
  VALUES ('u7','Shikha Aggarwal','shikha@airtel.in','$2a$10$zMJQ.Vfe6Yin9zQKcEdCmOpbDXXSnuyag2bAKihREN4Fj0.6wr1Wu',0,'POC Owner','SCM CoE','SA');

MERGE INTO app_users dst
USING (SELECT 'u8' id FROM dual) src ON (dst.id = src.id)
WHEN NOT MATCHED THEN INSERT (id,name,email,password_hash,must_change_password,role,department,avatar_initials)
  VALUES ('u8','Rajesh Kansal','rajesh.kansal@airtel.in','$2a$10$zMJQ.Vfe6Yin9zQKcEdCmOpbDXXSnuyag2bAKihREN4Fj0.6wr1Wu',0,'Submitter','Infra Procurement','RK');

MERGE INTO app_users dst
USING (SELECT 'u9' id FROM dual) src ON (dst.id = src.id)
WHEN NOT MATCHED THEN INSERT (id,name,email,password_hash,must_change_password,role,department,avatar_initials)
  VALUES ('u9','Akram Raza','akram.raza@airtel.in','$2a$10$zMJQ.Vfe6Yin9zQKcEdCmOpbDXXSnuyag2bAKihREN4Fj0.6wr1Wu',0,'Submitter','Material Management','AR');

COMMIT;

-- ============================================================================
-- Tickets (sample Issue Log)
-- ============================================================================
MERGE INTO tickets dst USING (SELECT 'SCM-SOW-001' id FROM dual) src ON (dst.id=src.id)
WHEN NOT MATCHED THEN INSERT (
  id,title,module,sub_process,function,category,description,
  submitted_by,submitted_by_id,submitted_at,assigned_to,assigned_to_id,
  status,priority,people_affected,frequency,hours_lost_per_week,cost_savings,compliance_risk,
  sla_response_hours,sla_resolution_hours,sla_elapsed_hours,sla_state,sla_days_open,
  coe_effort_days,suggested_solution,supporting_evidence,notes,brd_status,brd_id,tags)
VALUES (
  'SCM-SOW-001','Manual / Avoidable Step','SOW','SOW Review & Approval','Material Management','Process Issues',
  'Manual SOW validation causes 3–5 day delays before vendor onboarding can begin.',
  'Akram Raza','u9',TIMESTAMP '2026-04-10 09:00:00 +00:00','Kushal Soni','u6',
  'In Progress','P1',4,'Daily',18,150000,'No',
  8,72,96,'breached',33,
  12,'Auto-route SOW to predefined validator pool with rule-based pre-checks.',
  'https://airtel.sharepoint.com/scm/sow-delay-evidence.pdf','','Pending',null,
  '["sow","manual"]');

MERGE INTO tickets dst USING (SELECT 'SCM-VND-002' id FROM dual) src ON (dst.id=src.id)
WHEN NOT MATCHED THEN INSERT (
  id,title,module,sub_process,function,category,description,
  submitted_by,submitted_by_id,submitted_at,assigned_to,assigned_to_id,
  status,priority,people_affected,frequency,hours_lost_per_week,cost_savings,compliance_risk,
  sla_response_hours,sla_resolution_hours,sla_elapsed_hours,sla_state,sla_days_open,
  coe_effort_days,suggested_solution,tags)
VALUES (
  'SCM-VND-002','Handoff Failure','Vendor Onboarding','Vendor Verification','Infra','Process Issues',
  'Vendor verification done via email chains with no tracking or acknowledgement.',
  'Ravi Kumar','u1',TIMESTAMP '2026-04-12 10:00:00 +00:00','Amit Singh','u3',
  'POC Assigned','P2',6,'Weekly',12,90000,'No',
  24,120,72,'at-risk',12,
  5,'Build structured handoff form with digital acknowledgement.',
  '["vendor","onboarding"]');

MERGE INTO tickets dst USING (SELECT 'SCM-CON-003' id FROM dual) src ON (dst.id=src.id)
WHEN NOT MATCHED THEN INSERT (
  id,title,module,sub_process,function,category,description,
  submitted_by,submitted_by_id,submitted_at,
  status,priority,people_affected,frequency,hours_lost_per_week,cost_savings,compliance_risk,
  sla_response_hours,sla_resolution_hours,sla_elapsed_hours,sla_state,sla_days_open,tags)
VALUES (
  'SCM-CON-003','Contract Renewal Alerts Missing','Contract','Contract Renewal','COE','Visibility Gap',
  'No automated alerts for contracts expiring in 30/60/90 days causing last-minute renewals.',
  'Priya Sharma','u2',TIMESTAMP '2026-04-14 11:00:00 +00:00',
  'Triaged','P2',8,'Monthly',5,200000,'No',
  24,168,24,'on-track',4,'["contract","alerts"]');

MERGE INTO tickets dst USING (SELECT 'SCM-PO-004' id FROM dual) src ON (dst.id=src.id)
WHEN NOT MATCHED THEN INSERT (
  id,title,module,sub_process,function,category,description,
  submitted_by,submitted_by_id,submitted_at,assigned_to,assigned_to_id,
  status,priority,people_affected,frequency,hours_lost_per_week,cost_savings,compliance_risk,
  sla_response_hours,sla_resolution_hours,sla_elapsed_hours,sla_state,sla_days_open,
  coe_effort_days,tags,brd_id,brd_status)
VALUES (
  'SCM-PO-004','3-Way Match Failure — Duplicate Payments','PO','PO/GRN Reconciliation','IT','Compliance & Risk',
  'PO/GRN 3-way match not enforced in ERP, leading to duplicate payments.',
  'Shikha Aggarwal','u7',TIMESTAMP '2026-04-15 09:00:00 +00:00','Shikha Aggarwal','u7',
  'Pending Validation','P0',10,'Daily',20,500000,'Yes',
  4,24,18,'on-track',20,
  15,'["po","grn","compliance"]','BRD-004','Approved');

COMMIT;

-- ============================================================================
-- BRD
-- ============================================================================
MERGE INTO brds dst USING (SELECT 'BRD-004' id FROM dual) src ON (dst.id=src.id)
WHEN NOT MATCHED THEN INSERT (id,ticket_id,title,status,version,sections,versions)
VALUES (
  'BRD-004','SCM-PO-004','BRD — PO/GRN 3-way Match Enforcement','Approved','v1.1',
  '{"Background":"Four confirmed duplicate-payment cases traced to PO/GRN mismatches in Q1.","Objective":"Eliminate duplicate payments via enforced 3-way match in ERP.","Scope":"PO module — Invoice matching only.","Functional Requirements":"1. Block invoice payment if PO/GRN/Invoice qty/value mismatch.\n2. Daily exception report to AP.\n3. Audit log for every override.","Acceptance Criteria":"• Zero duplicate payments in 30-day window.\n• 100% exception coverage in daily report.","Risks & Dependencies":"Oracle EBS patch level; finance team training."}',
  '[{"v":"v1.0","at":"2026-04-16T09:00:00Z","by":"AI Draft"},{"v":"v1.1","at":"2026-04-17T11:20:00Z","by":"Varun Mehta"}]'
);

COMMIT;

-- ============================================================================
-- Audit log
-- ============================================================================
INSERT INTO audit_log (id,ticket_id,at,actor_id,actor_name,action,field,before_val,after_val)
  SELECT SYS_GUID_TO_CHAR(),'SCM-SOW-001',TIMESTAMP '2026-04-10 09:00:00 +00:00','u9','Akram Raza','Issue submitted',null,null,null FROM dual
  WHERE NOT EXISTS (SELECT 1 FROM audit_log WHERE ticket_id='SCM-SOW-001' AND action='Issue submitted');

-- Use a helper function for UUID — Oracle 19c+:
-- Actually use RAWTOHEX(SYS_GUID()) for UUID-like values
DECLARE
  PROCEDURE ins_audit(p_tid VARCHAR2, p_ts TIMESTAMP WITH TIME ZONE, p_aid VARCHAR2, p_an VARCHAR2, p_act VARCHAR2, p_fld VARCHAR2, p_bv VARCHAR2, p_av VARCHAR2) IS
  BEGIN
    INSERT INTO audit_log (id,ticket_id,at,actor_id,actor_name,action,field,before_val,after_val)
    VALUES (LOWER(RAWTOHEX(SYS_GUID())),p_tid,p_ts,p_aid,p_an,p_act,p_fld,p_bv,p_av);
  END;
BEGIN
  ins_audit('SCM-SOW-001',TIMESTAMP '2026-04-10 09:01:00 +00:00',null,'System','Auto-prioritisation','Priority',null,'P1');
  ins_audit('SCM-SOW-001',TIMESTAMP '2026-04-11 10:15:00 +00:00','u2','Priya Sharma','Status change','Status','Submitted','Triaged');
  ins_audit('SCM-SOW-001',TIMESTAMP '2026-04-12 11:32:00 +00:00','u2','Priya Sharma','Assigned POC','Assigned To','—','Kushal Soni');
  ins_audit('SCM-SOW-001',TIMESTAMP '2026-04-13 09:00:00 +00:00','u6','Kushal Soni','Status change','Status','POC Assigned','In Progress');
  ins_audit('SCM-PO-004', TIMESTAMP '2026-04-15 09:00:00 +00:00','u7','Shikha Aggarwal','Issue submitted',null,null,null);
  ins_audit('SCM-PO-004', TIMESTAMP '2026-04-15 09:01:00 +00:00',null,'System','Priority Zero Override','Priority',null,'P0');
END;
/

COMMIT;

-- ============================================================================
-- Comments
-- ============================================================================
DECLARE
  PROCEDURE ins_comment(p_tid VARCHAR2, p_aid VARCHAR2, p_author VARCHAR2, p_role VARCHAR2, p_body VARCHAR2, p_ts TIMESTAMP WITH TIME ZONE) IS
  BEGIN
    INSERT INTO comments (id,ticket_id,author_id,author,author_role,body,at)
    VALUES (LOWER(RAWTOHEX(SYS_GUID())),p_tid,p_aid,p_author,p_role,p_body,p_ts);
  END;
BEGIN
  ins_comment('SCM-SOW-001','u2','Priya Sharma','COE Admin','Confirmed SLA breach; escalating to POC Owner.',TIMESTAMP '2026-04-12 11:30:00 +00:00');
  ins_comment('SCM-SOW-001','u6','Kushal Soni','POC Owner','Drafted workflow change. Will share BRD by EOD.',TIMESTAMP '2026-04-15 17:45:00 +00:00');
  ins_comment('SCM-PO-004','u2','Priya Sharma','COE Admin','P0 by compliance override — duplicate payment risk.',TIMESTAMP '2026-04-16 09:00:00 +00:00');
END;
/

COMMIT;

-- ============================================================================
-- Notifications
-- ============================================================================
DECLARE
  PROCEDURE ins_notif(p_uid VARCHAR2, p_type VARCHAR2, p_title VARCHAR2, p_msg VARCHAR2, p_tid VARCHAR2, p_ts TIMESTAMP WITH TIME ZONE, p_read NUMBER) IS
  BEGIN
    INSERT INTO notifications (id,user_id,type,title,message,ticket_id,at,read)
    VALUES (LOWER(RAWTOHEX(SYS_GUID())),p_uid,p_type,p_title,p_msg,p_tid,p_ts,p_read);
  END;
BEGIN
  ins_notif('u9','sla_breach','SLA Breached','SCM-SOW-001 has breached resolution SLA','SCM-SOW-001',TIMESTAMP '2026-04-13 09:00:00 +00:00',0);
  ins_notif('u8','assignment','New Assignment','SCM-PR-009 has been assigned to you','SCM-PR-009',TIMESTAMP '2026-04-24 09:35:00 +00:00',0);
  ins_notif('u9','comment','New Comment','Kushal Soni commented on SCM-SOW-001','SCM-SOW-001',TIMESTAMP '2026-04-15 17:45:00 +00:00',1);
  ins_notif('u1','validation','Validation Needed','SCM-VND-011 is ready for your validation','SCM-VND-011',TIMESTAMP '2026-04-25 14:00:00 +00:00',0);
  ins_notif('u8','sla_at_risk','SLA At Risk','SCM-VND-002 is approaching resolution SLA','SCM-VND-002',TIMESTAMP '2026-04-26 08:00:00 +00:00',0);
END;
/

COMMIT;
