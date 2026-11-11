"""Enforce tenant isolation in PostgreSQL with forced row-level security.

Revision ID: 0006_tenant_rls
Revises: 0005_trips
"""
from alembic import op


revision = "0006_tenant_rls"
down_revision = "0005_trips"
branch_labels = None
depends_on = None


TENANT_TABLES = (
    "users",
    "auth_sessions",
    "captures",
    "reminders",
    "payment_events",
    "push_devices",
    "notification_deliveries",
    "notification_attempts",
    "trips",
    "trip_bookings",
    "trip_checklist_items",
    "audit_events",
)

def upgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return

    for table in TENANT_TABLES:
        op.execute(f'ALTER TABLE "{table}" ENABLE ROW LEVEL SECURITY')
        op.execute(f'ALTER TABLE "{table}" FORCE ROW LEVEL SECURITY')
        if table == "users":
            predicate = "id::text = NULLIF(current_setting('app.user_id', true), '')"
            check = predicate
        elif table == "auth_sessions":
            predicate = """(
                owner_id::text = NULLIF(current_setting('app.user_id', true), '')
                OR refresh_token_hash = NULLIF(current_setting('app.refresh_token_hash', true), '')
            )"""
            check = "owner_id::text = NULLIF(current_setting('app.user_id', true), '')"
        else:
            predicate = "owner_id::text = NULLIF(current_setting('app.user_id', true), '')"
            check = predicate
        op.execute(
            f'CREATE POLICY "pingo_tenant_isolation" ON "{table}" '
            f"USING ({predicate}) WITH CHECK ({check})"
        )

    op.execute("""
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pingo_broker') THEN
            CREATE ROLE pingo_broker NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT BYPASSRLS;
          END IF;
          ALTER ROLE pingo_broker NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT BYPASSRLS;
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pingo_auth_broker') THEN
            CREATE ROLE pingo_auth_broker NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT BYPASSRLS;
          END IF;
          ALTER ROLE pingo_auth_broker NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT BYPASSRLS;
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pingo_api') THEN
            GRANT USAGE ON SCHEMA public TO pingo_api;
            GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO pingo_api;
            GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO pingo_api;
          END IF;
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pingo_worker') THEN
            REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM pingo_worker;
            REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM pingo_worker;
            GRANT USAGE ON SCHEMA public TO pingo_worker;
            GRANT SELECT ON public.reminders, public.push_devices TO pingo_worker;
            GRANT UPDATE ON public.push_devices TO pingo_worker;
            GRANT SELECT, INSERT, UPDATE ON public.notification_deliveries, public.notification_attempts TO pingo_worker;
          END IF;
        END
        $$;
    """)
    op.execute("REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM pingo_broker")
    op.execute("REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM pingo_broker")
    op.execute("REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM pingo_auth_broker")
    op.execute("REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM pingo_auth_broker")
    op.execute("""
        CREATE OR REPLACE FUNCTION public.pingo_claim_due_notifications(batch_limit integer DEFAULT 100)
        RETURNS TABLE(owner_id text, delivery_id text)
        LANGUAGE sql
        SECURITY DEFINER
        SET search_path = pg_catalog, public
        AS $claim$
          WITH candidates AS (
            SELECT d.id
              FROM public.notification_deliveries AS d
              JOIN public.reminders AS r
                ON r.id = d.reminder_id AND r.owner_id = d.owner_id
             WHERE r.status = 'active'
               AND r.due_at = d.occurrence_due_at
               AND d.scheduled_at <= statement_timestamp()
               AND (d.status = 'pending' OR (
                    d.status = 'sending'
                    AND d.attempted_at < statement_timestamp() - interval '5 minutes'
               ))
             ORDER BY d.scheduled_at ASC
             LIMIT LEAST(GREATEST(batch_limit, 1), 100)
             FOR UPDATE OF d SKIP LOCKED
          ), claimed AS (
            UPDATE public.notification_deliveries AS d
               SET status = 'sending', attempted_at = statement_timestamp()
              FROM candidates AS c
             WHERE d.id = c.id
          RETURNING d.owner_id, d.id
          )
          SELECT claimed.owner_id, claimed.id FROM claimed
        $claim$
    """)
    op.execute("""
        CREATE OR REPLACE FUNCTION public.pingo_auth_user_by_email(user_email text)
        RETURNS TABLE(user_id text, user_password_hash text)
        LANGUAGE sql
        SECURITY DEFINER
        SET search_path = pg_catalog, public
        AS $lookup$
          SELECT u.id, u.password_hash
            FROM public.users AS u
           WHERE u.email = user_email
           LIMIT 1
        $lookup$
    """)
    op.execute("""
        CREATE OR REPLACE FUNCTION public.pingo_claim_due_receipts(batch_limit integer DEFAULT 1000)
        RETURNS TABLE(owner_id text, attempt_id text, delivery_id text, push_device_id text, provider_ticket_id text)
        LANGUAGE sql
        SECURITY DEFINER
        SET search_path = pg_catalog, public
        AS $claim$
          WITH candidates AS (
            SELECT a.id
              FROM public.notification_attempts AS a
             WHERE a.status = 'accepted'
               AND a.provider_ticket_id IS NOT NULL
               AND a.attempted_at < statement_timestamp() - interval '15 minutes'
               AND (a.retry_at IS NULL OR a.retry_at <= statement_timestamp())
             ORDER BY a.attempted_at ASC
             LIMIT LEAST(GREATEST(batch_limit, 1), 1000)
             FOR UPDATE OF a SKIP LOCKED
          ), claimed AS (
            UPDATE public.notification_attempts AS a
               SET retry_at = statement_timestamp() + interval '5 minutes'
              FROM candidates AS c
             WHERE a.id = c.id
          RETURNING a.owner_id, a.id, a.delivery_id, a.push_device_id, a.provider_ticket_id
          )
          SELECT claimed.owner_id, claimed.id, claimed.delivery_id, claimed.push_device_id, claimed.provider_ticket_id
            FROM claimed
        $claim$
    """)
    op.execute("GRANT SELECT ON public.notification_deliveries, public.reminders TO pingo_broker")
    op.execute("GRANT UPDATE ON public.notification_deliveries TO pingo_broker")
    op.execute("GRANT SELECT, UPDATE ON public.notification_attempts TO pingo_broker")
    op.execute("GRANT USAGE ON SCHEMA public TO pingo_broker")
    op.execute("GRANT CREATE ON SCHEMA public TO pingo_broker")
    op.execute("GRANT SELECT ON public.users TO pingo_auth_broker")
    op.execute("GRANT USAGE ON SCHEMA public TO pingo_auth_broker")
    op.execute("GRANT CREATE ON SCHEMA public TO pingo_auth_broker")
    op.execute("ALTER FUNCTION public.pingo_claim_due_notifications(integer) OWNER TO pingo_broker")
    op.execute("ALTER FUNCTION public.pingo_claim_due_receipts(integer) OWNER TO pingo_broker")
    op.execute("ALTER FUNCTION public.pingo_auth_user_by_email(text) OWNER TO pingo_auth_broker")
    op.execute("REVOKE ALL ON FUNCTION public.pingo_claim_due_notifications(integer) FROM PUBLIC")
    op.execute("REVOKE ALL ON FUNCTION public.pingo_claim_due_receipts(integer) FROM PUBLIC")
    op.execute("REVOKE ALL ON FUNCTION public.pingo_auth_user_by_email(text) FROM PUBLIC")
    op.execute("GRANT EXECUTE ON FUNCTION public.pingo_claim_due_notifications(integer) TO pingo_worker")
    op.execute("GRANT EXECUTE ON FUNCTION public.pingo_claim_due_receipts(integer) TO pingo_worker")
    op.execute("GRANT EXECUTE ON FUNCTION public.pingo_auth_user_by_email(text) TO pingo_api")
    op.execute("REVOKE CREATE ON SCHEMA public FROM pingo_broker")
    op.execute("REVOKE CREATE ON SCHEMA public FROM pingo_auth_broker")
    op.execute("""
        DO $$
        BEGIN
          EXECUTE format(
            'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pingo_api',
            current_user
          );
          EXECUTE format(
            'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO pingo_api',
            current_user
          );
        END
        $$;
    """)


def downgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    for table in reversed(TENANT_TABLES):
        op.execute(f'DROP POLICY IF EXISTS "pingo_tenant_isolation" ON "{table}"')
        op.execute(f'ALTER TABLE "{table}" NO FORCE ROW LEVEL SECURITY')
        op.execute(f'ALTER TABLE "{table}" DISABLE ROW LEVEL SECURITY')
    op.execute("DROP FUNCTION IF EXISTS public.pingo_claim_due_receipts(integer)")
    op.execute("DROP FUNCTION IF EXISTS public.pingo_claim_due_notifications(integer)")
    op.execute("DROP FUNCTION IF EXISTS public.pingo_auth_user_by_email(text)")
    op.execute("REVOKE ALL ON public.notification_deliveries, public.reminders, public.notification_attempts FROM pingo_broker")
    op.execute("REVOKE USAGE ON SCHEMA public FROM pingo_broker")
    op.execute("REVOKE SELECT ON public.users FROM pingo_auth_broker")
    op.execute("REVOKE USAGE ON SCHEMA public FROM pingo_auth_broker")
    op.execute("DROP ROLE IF EXISTS pingo_broker")
    op.execute("DROP ROLE IF EXISTS pingo_auth_broker")
