from pathlib import Path
import sqlite3

root = Path(__file__).resolve().parents[1]
database = sqlite3.connect(":memory:")
for migration in sorted((root / "worker" / "migrations").glob("*.sql")):
    database.executescript(migration.read_text(encoding="utf-8"))
    print(f"applied: {migration.name}")
table_count = database.execute(
    "SELECT COUNT(1) FROM sqlite_master WHERE type = 'table'"
).fetchone()[0]
print(f"sqlite migration ok: {table_count} tables")
