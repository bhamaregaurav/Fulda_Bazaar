from datetime import datetime
from sqlalchemy import Select

PAGE_SIZE = 50


def add_cursor(
    stmt: Select,
    *,
    before_id: int | None = None,
    before_ts: datetime | None = None,
    limit: int = PAGE_SIZE,
) -> Select:
    
    if before_id is not None:
        stmt = stmt.where(stmt.selected_columns.message_id < before_id)
    elif before_ts is not None:
        stmt = stmt.where(stmt.selected_columns.sent_at < before_ts)

    return stmt.limit(limit)
