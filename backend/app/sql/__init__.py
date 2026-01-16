"""
SQL templates for MDLH Gold Layer queries.

This module provides SQL templates that can be loaded and formatted
with dynamic parameters for querying the Atlan MDLH.
"""

from pathlib import Path

SQL_DIR = Path(__file__).parent


def load_template(name: str) -> str:
    """Load a SQL template by name."""
    template_path = SQL_DIR / f"{name}.sql"
    if not template_path.exists():
        raise FileNotFoundError(f"SQL template not found: {name}")
    return template_path.read_text()


__all__ = ["load_template", "SQL_DIR"]
