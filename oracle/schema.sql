-- Oracle Autonomous Database schema for SCM Intelligent Issue Portal
-- Compatible with Oracle DB 19c+ (ADB Always Free on Oracle Cloud)
-- Run this BEFORE seed.sql. Safe to re-run (uses IF NOT EXISTS guards).

-- ============================================================================
-- Users
-- ============================================================================
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE app_users (
      id                   VARCHAR2(50)  NOT NULL,
      name                 VARCHAR2(200) NOT NULL,
      email                VARCHAR2(200) NOT NULL,
      password_hash        VARCHAR2(300) NOT NULL,
      must_change_password NUMBER(1)     DEFAULT 0 NOT NULL,
      is_active            NUMBER(1)     DEFAULT 1 NOT NULL,
      role                 VARCHAR2(50)  NOT NULL,
      department           VARCHAR2(200),
      avatar_initials      VARCHAR2(10),
      created_at           TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP,
      CONSTRAINT pk_app_users PRIMARY KEY (id),
      CONSTRAINT uq_app_users_email UNIQUE (email),
      CONSTRAINT chk_users_mcp    CHECK (must_change_password IN (0,1)),
      CONSTRAINT chk_users_active CHECK (is_active IN (0,1)),
      CONSTRAINT chk_users_role   CHECK (role IN (''Submitter'',''COE Admin'',''POC Owner'',''Leadership'',''System Admin''))
    )';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;
END;
/

-- ============================================================================
-- Tickets
-- ============================================================================
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE tickets (
      id                   VARCHAR2(50)   NOT NULL,
      title                VARCHAR2(1000) NOT NULL,
      module               VARCHAR2(200)  NOT NULL,
      sub_process          VARCHAR2(200),
      function             VARCHAR2(200),
      category             VARCHAR2(200),
      description          CLOB,
      submitted_by         VARCHAR2(200),
      submitted_by_id      VARCHAR2(50),
      submitted_at         TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP,
      assigned_to          VARCHAR2(200),
      assigned_to_id       VARCHAR2(50),
      status               VARCHAR2(50)   DEFAULT ''Submitted'' NOT NULL,
      priority             VARCHAR2(10)   DEFAULT ''P3''        NOT NULL,
      people_affected      NUMBER(10,2)   DEFAULT 0,
      frequency            VARCHAR2(20)   DEFAULT ''Weekly'',
      hours_lost_per_week  NUMBER(10,2)   DEFAULT 0,
      cost_savings         NUMBER(15,2)   DEFAULT 0,
      compliance_risk      VARCHAR2(5)    DEFAULT ''No'',
      sla_response_hours   NUMBER(10,2)   DEFAULT 24,
      sla_resolution_hours NUMBER(10,2)   DEFAULT 168,
      sla_elapsed_hours    NUMBER(10,2)   DEFAULT 0,
      sla_state            VARCHAR2(20)   DEFAULT ''on-track'',
      sla_days_open        NUMBER(10)     DEFAULT 0,
      coe_effort_days      NUMBER(10,2)   DEFAULT 0,
      suggested_solution   CLOB,
      supporting_evidence  CLOB,
      notes                CLOB,
      related_ticket_id    VARCHAR2(50),
      parent_id            VARCHAR2(50),
      brd_id               VARCHAR2(50),
      brd_status           VARCHAR2(50),
      tags                 CLOB,
      created_at           TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP,
      updated_at           TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP,
      CONSTRAINT pk_tickets PRIMARY KEY (id),
      CONSTRAINT fk_tickets_sub  FOREIGN KEY (submitted_by_id) REFERENCES app_users(id) ON DELETE SET NULL,
      CONSTRAINT fk_tickets_asgn FOREIGN KEY (assigned_to_id)  REFERENCES app_users(id) ON DELETE SET NULL,
      CONSTRAINT chk_tickets_status   CHECK (status   IN (''Submitted'',''Triaged'',''POC Assigned'',''In Progress'',''Pending Validation'',''Closed'',''Reopened'')),
      CONSTRAINT chk_tickets_priority CHECK (priority IN (''P0'',''P1'',''P2'',''P3'')),
      CONSTRAINT chk_tickets_freq     CHECK (frequency IN (''Daily'',''Weekly'',''Monthly'',''Annual'',''Ad-hoc'')),
      CONSTRAINT chk_tickets_comp     CHECK (compliance_risk IN (''Yes'',''No'')),
      CONSTRAINT chk_tickets_sla      CHECK (sla_state IN (''on-track'',''at-risk'',''breached''))
    )';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;
END;
/

BEGIN
  EXECUTE IMMEDIATE '
    CREATE INDEX idx_tickets_sub   ON tickets(submitted_by_id)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;
END;
/
BEGIN
  EXECUTE IMMEDIATE '
    CREATE INDEX idx_tickets_asgn  ON tickets(assigned_to_id)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;
END;
/
BEGIN
  EXECUTE IMMEDIATE '
    CREATE INDEX idx_tickets_stat  ON tickets(status)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;
END;
/

CREATE OR REPLACE TRIGGER trg_tickets_updated_at
BEFORE UPDATE ON tickets FOR EACH ROW
BEGIN :NEW.updated_at := SYSTIMESTAMP; END;
/

-- ============================================================================
-- Audit log
-- ============================================================================
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE audit_log (
      id          VARCHAR2(36)  NOT NULL,
      ticket_id   VARCHAR2(50),
      at          TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
      actor_id    VARCHAR2(50),
      actor_name  VARCHAR2(200) NOT NULL,
      action      VARCHAR2(500) NOT NULL,
      field       VARCHAR2(200),
      before_val  CLOB,
      after_val   CLOB,
      note        CLOB,
      CONSTRAINT pk_audit_log PRIMARY KEY (id),
      CONSTRAINT fk_audit_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id)   ON DELETE CASCADE,
      CONSTRAINT fk_audit_actor  FOREIGN KEY (actor_id)  REFERENCES app_users(id) ON DELETE SET NULL
    )';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;
END;
/
BEGIN
  EXECUTE IMMEDIATE '
    CREATE INDEX idx_audit_ticket ON audit_log(ticket_id, at)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;
END;
/

-- ============================================================================
-- Comments
-- ============================================================================
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE comments (
      id          VARCHAR2(36)  NOT NULL,
      ticket_id   VARCHAR2(50)  NOT NULL,
      author_id   VARCHAR2(50),
      author      VARCHAR2(200) NOT NULL,
      author_role VARCHAR2(50),
      body        CLOB          NOT NULL,
      at          TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
      CONSTRAINT pk_comments PRIMARY KEY (id),
      CONSTRAINT fk_comments_ticket FOREIGN KEY (ticket_id)  REFERENCES tickets(id)   ON DELETE CASCADE,
      CONSTRAINT fk_comments_author FOREIGN KEY (author_id)  REFERENCES app_users(id) ON DELETE SET NULL
    )';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;
END;
/
BEGIN
  EXECUTE IMMEDIATE '
    CREATE INDEX idx_comments_ticket ON comments(ticket_id, at)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;
END;
/

-- ============================================================================
-- Test evidence
-- ============================================================================
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE test_evidence (
      id          VARCHAR2(36)   NOT NULL,
      ticket_id   VARCHAR2(50)   NOT NULL,
      label       VARCHAR2(500)  NOT NULL,
      url         VARCHAR2(2000) NOT NULL,
      uploaded_by VARCHAR2(200),
      at          TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
      CONSTRAINT pk_test_evidence PRIMARY KEY (id),
      CONSTRAINT fk_te_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
    )';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;
END;
/
BEGIN
  EXECUTE IMMEDIATE '
    CREATE INDEX idx_te_ticket ON test_evidence(ticket_id)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;
END;
/

-- ============================================================================
-- Notifications
-- ============================================================================
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE notifications (
      id        VARCHAR2(36)  NOT NULL,
      user_id   VARCHAR2(50),
      type      VARCHAR2(100) NOT NULL,
      title     VARCHAR2(500) NOT NULL,
      message   CLOB,
      ticket_id VARCHAR2(50),
      at        TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP,
      read      NUMBER(1) DEFAULT 0,
      CONSTRAINT pk_notifications PRIMARY KEY (id),
      CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE,
      CONSTRAINT chk_notif_read CHECK (read IN (0,1))
    )';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;
END;
/
BEGIN
  EXECUTE IMMEDIATE '
    CREATE INDEX idx_notif_user ON notifications(user_id, at)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;
END;
/

-- ============================================================================
-- BRDs
-- ============================================================================
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE brds (
      id         VARCHAR2(50)  NOT NULL,
      ticket_id  VARCHAR2(50),
      title      VARCHAR2(500) NOT NULL,
      status     VARCHAR2(50)  DEFAULT ''Draft'',
      version    VARCHAR2(20)  DEFAULT ''v1.0'',
      sections   CLOB,
      versions   CLOB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP,
      CONSTRAINT pk_brds PRIMARY KEY (id),
      CONSTRAINT fk_brds_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE SET NULL
    )';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;
END;
/

CREATE OR REPLACE TRIGGER trg_brds_updated_at
BEFORE UPDATE ON brds FOR EACH ROW
BEGIN :NEW.updated_at := SYSTIMESTAMP; END;
/

-- ============================================================================
-- Insights + feedback
-- ============================================================================
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE insights (
      id                   VARCHAR2(36)  NOT NULL,
      run_id               VARCHAR2(36),
      generated_at         TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP,
      category             VARCHAR2(100),
      title                VARCHAR2(500),
      body                 CLOB,
      supporting_numbers   CLOB,
      root_cause           CLOB,
      recommended_action   CLOB,
      projected_impact_inr NUMBER(15,2),
      cited_ticket_ids     CLOB,
      impact_score         NUMBER(3) DEFAULT 50,
      superseded           NUMBER(1) DEFAULT 0,
      CONSTRAINT pk_insights PRIMARY KEY (id),
      CONSTRAINT chk_insights_sup CHECK (superseded IN (0,1))
    )';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;
END;
/

BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE insight_feedback (
      id         VARCHAR2(36) NOT NULL,
      insight_id VARCHAR2(36) NOT NULL,
      user_id    VARCHAR2(50),
      vote       NUMBER(2)    NOT NULL,
      reason     CLOB,
      at         TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP,
      CONSTRAINT pk_insight_feedback PRIMARY KEY (id),
      CONSTRAINT fk_if_insight FOREIGN KEY (insight_id) REFERENCES insights(id) ON DELETE CASCADE
    )';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;
END;
/

-- ============================================================================
-- Chat sessions + messages
-- ============================================================================
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE chat_sessions (
      id         VARCHAR2(36)  NOT NULL,
      user_id    VARCHAR2(50),
      title      VARCHAR2(500),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP,
      CONSTRAINT pk_chat_sessions PRIMARY KEY (id)
    )';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;
END;
/

CREATE OR REPLACE TRIGGER trg_chat_sessions_updated_at
BEFORE UPDATE ON chat_sessions FOR EACH ROW
BEGIN :NEW.updated_at := SYSTIMESTAMP; END;
/

BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE chat_messages (
      id          VARCHAR2(36) NOT NULL,
      session_id  VARCHAR2(36) NOT NULL,
      role        VARCHAR2(20),
      content     CLOB,
      tool_name   VARCHAR2(100),
      tool_args   CLOB,
      tool_result CLOB,
      tool_calls  CLOB,
      provider    VARCHAR2(50),
      model       VARCHAR2(100),
      at          TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP,
      CONSTRAINT pk_chat_messages PRIMARY KEY (id),
      CONSTRAINT fk_cm_session FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
    )';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;
END;
/
BEGIN
  EXECUTE IMMEDIATE '
    CREATE INDEX idx_cm_session ON chat_messages(session_id, at)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;
END;
/

CREATE OR REPLACE TRIGGER trg_chat_sessions_touch
AFTER INSERT ON chat_messages FOR EACH ROW
BEGIN
  UPDATE chat_sessions SET updated_at = SYSTIMESTAMP WHERE id = :NEW.session_id;
END;
/
