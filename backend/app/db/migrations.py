from sqlalchemy import text
from sqlalchemy.engine import Engine


REQUIRED_COLUMNS = {
    "parser_source": "ALTER TABLE cv_profiles ADD COLUMN parser_source VARCHAR(50) DEFAULT 'manual'",
    "parser_confidence": "ALTER TABLE cv_profiles ADD COLUMN parser_confidence INTEGER DEFAULT 0",
    "parser_missing_sections": "ALTER TABLE cv_profiles ADD COLUMN parser_missing_sections TEXT",
    "profile_status": "ALTER TABLE cv_profiles ADD COLUMN profile_status VARCHAR(50) DEFAULT 'new'",
    "recruiter_notes": "ALTER TABLE cv_profiles ADD COLUMN recruiter_notes TEXT",
}


def ensure_schema(engine: Engine) -> None:
    with engine.begin() as connection:
        existing_columns = {
            row[1]
            for row in connection.execute(text("PRAGMA table_info(cv_profiles)")).fetchall()
        }
        for column_name, ddl in REQUIRED_COLUMNS.items():
            if column_name not in existing_columns:
                connection.execute(text(ddl))
