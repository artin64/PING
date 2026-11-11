from collections.abc import Generator

from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import DATABASE_URL


connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, pool_pre_ping=True, connect_args=connect_args)
if DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def enable_sqlite_foreign_keys(connection, _record):
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


@event.listens_for(Session, "after_begin")
def apply_postgres_tenant_context(session: Session, _transaction, connection) -> None:
    """Restore transaction-local RLS identity after every commit/rollback."""
    if connection.dialect.name != "postgresql":
        return
    owner_id = session.info.get("pingo_owner_id")
    refresh_hash = session.info.get("pingo_refresh_token_hash")
    if owner_id:
        connection.execute(text("SELECT set_config('app.user_id', :value, true)"), {"value": owner_id})
    if refresh_hash:
        connection.execute(text("SELECT set_config('app.refresh_token_hash', :value, true)"), {"value": refresh_hash})


def set_tenant_scope(db: Session, owner_id: str) -> None:
    db.info["pingo_owner_id"] = owner_id
    if db.get_bind().dialect.name == "postgresql" and db.in_transaction():
        db.execute(text("SELECT set_config('app.user_id', :value, true)"), {"value": owner_id})


def set_refresh_token_scope(db: Session, token_hash: str) -> None:
    db.info["pingo_refresh_token_hash"] = token_hash
    if db.get_bind().dialect.name == "postgresql" and db.in_transaction():
        db.execute(text("SELECT set_config('app.refresh_token_hash', :value, true)"), {"value": token_hash})


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


def assert_postgres_security(db: Session, *, worker: bool = False) -> None:
    """Fail closed if a production service role can bypass tenant RLS."""
    if db.get_bind().dialect.name != "postgresql":
        raise RuntimeError("Production data services require PostgreSQL")
    role = db.execute(
        text("SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user")
    ).one_or_none()
    if role is None or role.rolsuper or role.rolbypassrls:
        raise RuntimeError("Production database role must be non-superuser and must not have BYPASSRLS")
    missing = []
    for table in TENANT_TABLES:
        state = db.execute(
            text("""
                SELECT c.relrowsecurity, c.relforcerowsecurity,
                       EXISTS (
                           SELECT 1 FROM pg_policy p
                            WHERE p.polrelid = c.oid AND p.polname = 'pingo_tenant_isolation'
                       ) AS has_tenant_policy
                  FROM pg_class AS c
                 WHERE c.oid = to_regclass(:name)
            """),
            {"name": f"public.{table}"},
        ).one_or_none()
        if state is None or not state.relrowsecurity or not state.relforcerowsecurity or not state.has_tenant_policy:
            missing.append(table)
    if missing:
        raise RuntimeError(f"Tenant row security or its policy is missing on: {', '.join(missing)}")
    if worker:
        if db.execute(text("SELECT current_user = 'pingo_worker'")).scalar_one() is not True:
            raise RuntimeError("The notification worker must use the dedicated pingo_worker role")
        granted = db.execute(
            text("""
                SELECT has_table_privilege(current_user, 'public.reminders', 'SELECT')
                   AND has_table_privilege(current_user, 'public.push_devices', 'SELECT')
                   AND has_table_privilege(current_user, 'public.push_devices', 'UPDATE')
                   AND has_table_privilege(current_user, 'public.notification_deliveries', 'SELECT')
                   AND has_table_privilege(current_user, 'public.notification_deliveries', 'INSERT')
                   AND has_table_privilege(current_user, 'public.notification_deliveries', 'UPDATE')
                   AND has_table_privilege(current_user, 'public.notification_attempts', 'SELECT')
                   AND has_table_privilege(current_user, 'public.notification_attempts', 'INSERT')
                   AND has_table_privilege(current_user, 'public.notification_attempts', 'UPDATE')
                   AND NOT has_table_privilege(current_user, 'public.users', 'SELECT')
                   AND NOT has_table_privilege(current_user, 'public.captures', 'SELECT')
                   AND NOT has_table_privilege(current_user, 'public.auth_sessions', 'SELECT')
                   AND NOT has_table_privilege(current_user, 'public.payment_events', 'SELECT')
                   AND NOT has_table_privilege(current_user, 'public.trips', 'SELECT')
                   AND NOT has_table_privilege(current_user, 'public.trip_bookings', 'SELECT')
                   AND NOT has_table_privilege(current_user, 'public.trip_checklist_items', 'SELECT')
                   AND NOT has_table_privilege(current_user, 'public.audit_events', 'SELECT')
                   AND NOT pg_has_role(current_user, 'pingo_broker', 'MEMBER')
                   AND NOT pg_has_role(current_user, 'pingo_auth_broker', 'MEMBER')
                   AND NOT has_function_privilege(current_user, 'public.pingo_auth_user_by_email(text)', 'EXECUTE')
                   AND has_function_privilege(current_user, 'public.pingo_claim_due_notifications(integer)', 'EXECUTE')
                   AND has_function_privilege(current_user, 'public.pingo_claim_due_receipts(integer)', 'EXECUTE')
            """)
        ).scalar_one()
        if not granted:
            raise RuntimeError("Notification worker database role is missing its limited table grants")
        functions = db.execute(text("""
            SELECT to_regprocedure('public.pingo_claim_due_notifications(integer)') IS NOT NULL
               AND to_regprocedure('public.pingo_claim_due_receipts(integer)') IS NOT NULL
        """)).scalar_one()
        if not functions:
            raise RuntimeError("Notification worker database claim functions are missing")
    else:
        api_role = db.execute(text("""
            SELECT current_user = 'pingo_api'
               AND NOT pg_has_role(current_user, 'pingo_broker', 'MEMBER')
               AND NOT pg_has_role(current_user, 'pingo_auth_broker', 'MEMBER')
               AND has_function_privilege(current_user, 'public.pingo_auth_user_by_email(text)', 'EXECUTE')
        """)).scalar_one()
        if not api_role:
            raise RuntimeError("The API must use pingo_api without broker membership and have the limited auth lookup grant")


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.info.clear()
        db.close()

