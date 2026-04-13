"""DuckDB database connection and table management."""

from __future__ import annotations

import os
import threading
from pathlib import Path

import duckdb

_env_db = os.environ.get("MOOBU_DB_PATH")
DEFAULT_DB_PATH = Path(_env_db) if _env_db else Path(__file__).resolve().parents[3] / "data" / "moobu.duckdb"

_connection: duckdb.DuckDBPyConnection | None = None
_lock = threading.Lock()


def get_db(db_path: Path | None = None) -> duckdb.DuckDBPyConnection:
    """Get or create a DuckDB connection.

    For API requests, callers should use cursor() on the returned connection
    to get a thread-safe cursor.
    """
    global _connection
    if _connection is not None:
        return _connection
    path = db_path or DEFAULT_DB_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    _connection = duckdb.connect(str(path))
    return _connection


def query(sql: str, params=None):
    """Thread-safe query execution. Returns a new cursor per call."""
    db = get_db()
    with _lock:
        cursor = db.cursor()
    if params:
        return cursor.execute(sql, params)
    return cursor.execute(sql)


def reset_connection() -> None:
    """Close and reset the global connection."""
    global _connection
    if _connection is not None:
        _connection.close()
        _connection = None


def init_tables(db: duckdb.DuckDBPyConnection) -> None:
    """Create all tables if they don't exist."""
    db.execute("""
        CREATE TABLE IF NOT EXISTS filings (
            ein VARCHAR NOT NULL,
            org_name VARCHAR,
            tax_year INTEGER NOT NULL,
            state VARCHAR,
            form_type VARCHAR,
            filing_year INTEGER,
            total_revenue BIGINT,
            total_expenses BIGINT,
            rev_less_expenses BIGINT,
            contributions_grants BIGINT,
            program_service_rev BIGINT,
            investment_income BIGINT,
            other_revenue BIGINT,
            net_assets_eoy BIGINT,
            net_assets_boy BIGINT,
            program_expenses BIGINT,
            total_func_expenses BIGINT,
            source_file VARCHAR,
            mission_description VARCHAR,
            website VARCHAR,
            formation_year INTEGER,
            employee_count INTEGER,
            volunteer_count INTEGER,
            PRIMARY KEY (ein, tax_year)
        )
    """)

    db.execute("""
        CREATE TABLE IF NOT EXISTS org_scores (
            ein VARCHAR PRIMARY KEY,
            org_name VARCHAR,
            state VARCHAR,
            composite_score DOUBLE,
            tier VARCHAR,
            confidence VARCHAR,
            years_of_data INTEGER,
            revenue_concentration_hhi DOUBLE,
            operating_reserve_ratio DOUBLE,
            revenue_growth_trend DOUBLE,
            expense_vs_revenue_growth DOUBLE,
            program_expense_ratio DOUBLE,
            revenue_volatility DOUBLE,
            net_asset_trend DOUBLE,
            surplus_deficit_consistency DOUBLE,
            latest_total_revenue BIGINT,
            latest_total_expenses BIGINT,
            latest_net_assets BIGINT
        )
    """)

    db.execute("""
        CREATE TABLE IF NOT EXISTS early_warnings (
            ein VARCHAR PRIMARY KEY,
            org_name VARCHAR,
            vulnerability_score DOUBLE,
            method VARCHAR,
            factors TEXT,
            recommendation TEXT
        )
    """)

    db.execute("""
        CREATE TABLE IF NOT EXISTS crisis_events (
            ein VARCHAR,
            crisis_year INTEGER,
            revenue_drop_pct DOUBLE,
            pre_crisis_revenue BIGINT,
            crisis_revenue BIGINT,
            PRIMARY KEY (ein, crisis_year)
        )
    """)

    db.execute("""
        CREATE TABLE IF NOT EXISTS org_people (
            ein VARCHAR NOT NULL,
            person_name VARCHAR NOT NULL,
            title VARCHAR,
            avg_hours_per_week DOUBLE,
            compensation BIGINT,
            is_officer BOOLEAN,
            is_director BOOLEAN,
            filing_year INTEGER
        )
    """)
