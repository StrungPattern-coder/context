"""Initial schema

Revision ID: 001_initial
Revises: 
Create Date: 2026-01-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '001_initial'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create enums
    context_type_enum = postgresql.ENUM(
        'temporal', 'spatial', 'situational', 'meta',
        name='context_type',
        create_type=False
    )
    memory_tier_enum = postgresql.ENUM(
        'long_term', 'short_term', 'ephemeral',
        name='memory_tier',
        create_type=False
    )
    drift_status_enum = postgresql.ENUM(
        'stable', 'drifting', 'conflicting', 'stale',
        name='drift_status',
        create_type=False
    )
    
    # Create types (if not exists, handled by init.sql)
    op.execute("CREATE TYPE IF NOT EXISTS context_type AS ENUM ('temporal', 'spatial', 'situational', 'meta')")
    op.execute("CREATE TYPE IF NOT EXISTS memory_tier AS ENUM ('long_term', 'short_term', 'ephemeral')")
    op.execute("CREATE TYPE IF NOT EXISTS drift_status AS ENUM ('stable', 'drifting', 'conflicting', 'stale')")
    
    # Create tenants table
    op.create_table(
        'tenants',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('slug', sa.String(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('api_key', sa.String(255), nullable=False),
        sa.Column('api_key_secondary', sa.String(255), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('settings', postgresql.JSONB(), nullable=False, server_default='{}'),
        sa.Column('rate_limits', postgresql.JSONB(), nullable=False, server_default='{}'),
        sa.Column('max_users', sa.Integer(), nullable=False, server_default='100'),
        sa.Column('max_requests_per_minute', sa.Integer(), nullable=False, server_default='1000'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('slug'),
        sa.UniqueConstraint('api_key'),
        sa.UniqueConstraint('api_key_secondary'),
    )
    op.create_index('ix_tenants_name', 'tenants', ['name'])
    op.create_index('ix_tenants_slug', 'tenants', ['slug'])
    op.create_index('ix_tenants_api_key', 'tenants', ['api_key'])
    
    # Create users table
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('external_id', sa.String(255), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('email', sa.String(255), nullable=True),
        sa.Column('password_hash', sa.String(255), nullable=True),
        sa.Column('display_name', sa.String(255), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('preferences', postgresql.JSONB(), nullable=False, server_default='{}'),
        sa.Column('default_timezone', sa.String(50), nullable=True),
        sa.Column('default_locale', sa.String(20), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_users_external_id', 'users', ['external_id'])
    op.create_index('ix_users_tenant_id', 'users', ['tenant_id'])
    op.create_index('ix_users_email', 'users', ['email'])
    
    # Create contexts table
    op.create_table(
        'contexts',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('context_type', context_type_enum, nullable=False),
        sa.Column('memory_tier', memory_tier_enum, nullable=False, server_default='short_term'),
        sa.Column('key', sa.String(255), nullable=False),
        sa.Column('value', postgresql.JSONB(), nullable=False),
        sa.Column('interpretation', postgresql.JSONB(), nullable=True),
        sa.Column('confidence', sa.Float(), nullable=False, server_default='0.5'),
        sa.Column('source', sa.String(100), nullable=False, server_default="'inferred'"),
        sa.Column('source_details', postgresql.JSONB(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('drift_status', drift_status_enum, nullable=False, server_default='stable'),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_verified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('correction_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('access_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('last_accessed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint('confidence >= 0.0 AND confidence <= 1.0', name='check_confidence_range'),
    )
    op.create_index('ix_contexts_user_id', 'contexts', ['user_id'])
    op.create_index('ix_contexts_context_type', 'contexts', ['context_type'])
    op.create_index('ix_contexts_memory_tier', 'contexts', ['memory_tier'])
    op.create_index('ix_contexts_key', 'contexts', ['key'])
    op.create_index('ix_contexts_user_type_key', 'contexts', ['user_id', 'context_type', 'key'])
    
    # Create context_versions table
    op.create_table(
        'context_versions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('context_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('value', postgresql.JSONB(), nullable=False),
        sa.Column('interpretation', postgresql.JSONB(), nullable=True),
        sa.Column('confidence', sa.Float(), nullable=False),
        sa.Column('changed_by', sa.String(100), nullable=False),
        sa.Column('change_reason', sa.String(500), nullable=True),
        sa.Column('previous_value', postgresql.JSONB(), nullable=True),
        sa.ForeignKeyConstraint(['context_id'], ['contexts.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_context_versions_context_id', 'context_versions', ['context_id'])
    op.create_index('ix_context_versions_version', 'context_versions', ['version'])
    
    # Create context_sessions table
    op.create_table(
        'context_sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('session_id', sa.String(255), nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('ended_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('metadata', postgresql.JSONB(), nullable=False, server_default='{}'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_context_sessions_user_id', 'context_sessions', ['user_id'])
    op.create_index('ix_context_sessions_session_id', 'context_sessions', ['session_id'])
    
    # Insert default tenant and user for development
    op.execute("""
        INSERT INTO tenants (id, name, description, api_key, settings, rate_limits)
        VALUES (
            'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
            'Default Tenant',
            'Default development tenant',
            'ral_dev_api_key_12345',
            '{"features": ["all"]}',
            '{"requests_per_minute": 100, "requests_per_day": 50000}'
        );
    """)
    
    op.execute("""
        INSERT INTO users (id, external_id, tenant_id, email, password_hash, display_name, preferences)
        VALUES (
            'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
            'dev-user',
            'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
            'dev@ral.local',
            '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewYpfQm.W96gR3.m',
            'Development User',
            '{"theme": "dark"}'
        );
    """)


def downgrade() -> None:
    op.drop_table('context_sessions')
    op.drop_table('context_versions')
    op.drop_table('contexts')
    op.drop_table('users')
    op.drop_table('tenants')
    
    op.execute("DROP TYPE IF EXISTS drift_status")
    op.execute("DROP TYPE IF EXISTS memory_tier")
    op.execute("DROP TYPE IF EXISTS context_type")
