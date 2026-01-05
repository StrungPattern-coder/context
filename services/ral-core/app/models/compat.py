"""
Database Type Compatibility Module

Provides database-agnostic types that work with both PostgreSQL and SQLite.
This enables running tests with SQLite while using PostgreSQL in production.
"""

from sqlalchemy import JSON, String
from sqlalchemy.dialects.postgresql import JSONB as PG_JSONB, UUID as PG_UUID
from sqlalchemy.types import TypeDecorator, CHAR
import uuid as uuid_module


class JSONBCompatible(TypeDecorator):
    """
    A JSONB type that falls back to JSON for SQLite.
    
    Uses JSONB on PostgreSQL for efficient JSON operations,
    falls back to standard JSON type on SQLite for testing.
    """
    impl = JSON
    cache_ok = True
    
    def load_dialect_impl(self, dialect):
        if dialect.name == 'postgresql':
            return dialect.type_descriptor(PG_JSONB())
        else:
            return dialect.type_descriptor(JSON())


class UUIDCompatible(TypeDecorator):
    """
    A UUID type that works with both PostgreSQL and SQLite.
    
    Uses native UUID on PostgreSQL, stores as CHAR(36) on SQLite.
    """
    impl = CHAR(36)
    cache_ok = True
    
    def __init__(self, as_uuid: bool = True):
        """Initialize with as_uuid compatibility parameter (ignored for SQLite)."""
        self.as_uuid = as_uuid
        super().__init__()
    
    def load_dialect_impl(self, dialect):
        if dialect.name == 'postgresql':
            return dialect.type_descriptor(PG_UUID(as_uuid=True))
        else:
            return dialect.type_descriptor(CHAR(36))
    
    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        elif dialect.name == 'postgresql':
            return value
        else:
            if isinstance(value, uuid_module.UUID):
                return str(value)
            return value
    
    def process_result_value(self, value, dialect):
        if value is None:
            return value
        if isinstance(value, uuid_module.UUID):
            return value
        return uuid_module.UUID(value)


# Aliases for easy import
JSONB = JSONBCompatible
UUID = UUIDCompatible
