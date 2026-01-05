-- RAL Database Initialization Script
-- Creates necessary extensions and initial schema

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types
DO $$ BEGIN
    CREATE TYPE context_type AS ENUM ('temporal', 'spatial', 'situational', 'meta');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE memory_tier AS ENUM ('long_term', 'short_term', 'ephemeral');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE drift_status AS ENUM ('stable', 'drifting', 'conflicting', 'stale');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE ral TO ral;

-- Create tenants table
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    api_key VARCHAR(255) NOT NULL UNIQUE,
    api_key_secondary VARCHAR(255) UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    settings JSONB NOT NULL DEFAULT '{}',
    rate_limits JSONB NOT NULL DEFAULT '{}',
    max_users INTEGER NOT NULL DEFAULT 100,
    max_requests_per_minute INTEGER NOT NULL DEFAULT 1000
);

CREATE INDEX IF NOT EXISTS ix_tenants_name ON tenants(name);
CREATE INDEX IF NOT EXISTS ix_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS ix_tenants_api_key ON tenants(api_key);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    external_id VARCHAR(255) NOT NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255),
    password_hash VARCHAR(255),
    display_name VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT true,
    preferences JSONB NOT NULL DEFAULT '{}',
    default_timezone VARCHAR(50),
    default_locale VARCHAR(20)
);

CREATE INDEX IF NOT EXISTS ix_users_external_id ON users(external_id);
CREATE INDEX IF NOT EXISTS ix_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS ix_users_email ON users(email);

-- Create contexts table
CREATE TABLE IF NOT EXISTS contexts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    context_type context_type NOT NULL,
    memory_tier memory_tier NOT NULL DEFAULT 'short_term',
    key VARCHAR(255) NOT NULL,
    value JSONB NOT NULL,
    interpretation JSONB,
    confidence FLOAT NOT NULL DEFAULT 0.5 CHECK (confidence >= 0.0 AND confidence <= 1.0),
    source VARCHAR(100) NOT NULL DEFAULT 'inferred',
    source_details JSONB,
    is_active BOOLEAN NOT NULL DEFAULT true,
    drift_status drift_status NOT NULL DEFAULT 'stable',
    expires_at TIMESTAMP WITH TIME ZONE,
    last_verified_at TIMESTAMP WITH TIME ZONE,
    correction_count INTEGER NOT NULL DEFAULT 0,
    access_count INTEGER NOT NULL DEFAULT 0,
    last_accessed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS ix_contexts_user_id ON contexts(user_id);
CREATE INDEX IF NOT EXISTS ix_contexts_context_type ON contexts(context_type);
CREATE INDEX IF NOT EXISTS ix_contexts_memory_tier ON contexts(memory_tier);
CREATE INDEX IF NOT EXISTS ix_contexts_key ON contexts(key);
CREATE INDEX IF NOT EXISTS ix_contexts_user_type_key ON contexts(user_id, context_type, key);

-- Create context_versions table
CREATE TABLE IF NOT EXISTS context_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    context_id UUID NOT NULL REFERENCES contexts(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    value JSONB NOT NULL,
    interpretation JSONB,
    confidence FLOAT NOT NULL,
    changed_by VARCHAR(100) NOT NULL,
    change_reason VARCHAR(500),
    previous_value JSONB
);

CREATE INDEX IF NOT EXISTS ix_context_versions_context_id ON context_versions(context_id);
CREATE INDEX IF NOT EXISTS ix_context_versions_version ON context_versions(version);

-- Create context_sessions table
CREATE TABLE IF NOT EXISTS context_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(255) NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ended_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS ix_context_sessions_user_id ON context_sessions(user_id);
CREATE INDEX IF NOT EXISTS ix_context_sessions_session_id ON context_sessions(session_id);

-- Insert default tenant and user for development
INSERT INTO tenants (id, name, slug, description, api_key, settings, rate_limits)
VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Default Tenant',
    'default',
    'Default development tenant',
    'ral_dev_api_key_12345',
    '{"features": ["all"]}',
    '{"requests_per_minute": 100, "requests_per_day": 50000}'
) ON CONFLICT (id) DO NOTHING;

-- Password is "password123" hashed with bcrypt
INSERT INTO users (id, external_id, tenant_id, email, password_hash, display_name, preferences)
VALUES (
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    'dev-user',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'dev@ral.local',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewYpfQm.W96gR3.m',
    'Development User',
    '{"theme": "dark"}'
) ON CONFLICT (id) DO NOTHING;

-- Create alembic version table for migration tracking
CREATE TABLE IF NOT EXISTS alembic_version (
    version_num VARCHAR(32) NOT NULL,
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

-- Mark initial migration as complete
INSERT INTO alembic_version (version_num) VALUES ('001_initial') ON CONFLICT DO NOTHING;

