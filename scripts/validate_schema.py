from pathlib import Path
import sqlite3

root = Path(__file__).resolve().parents[1]
sql = (root / "worker" / "migrations" / "0001_initial.sql").read_text(encoding="utf-8")
database = sqlite3.connect(":memory:")
database.executescript(sql)
table_count = database.execute(
    "SELECT COUNT(1) FROM sqlite_master WHERE type = 'table'"
).fetchone()[0]
print(f"sqlite migration ok: {table_count} tables")
