-- Migration: 000001_init_schema.up.sql
-- Description: Core tables for APS (Aadhan Pradhan Services)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users (Developer Console accounts)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'developer',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Apps (Multi-tenant Pusher applications)
CREATE TABLE IF NOT EXISTS apps (
    id VARCHAR(64) PRIMARY KEY, -- e.g. "app-123456" or integer string
    name VARCHAR(255) NOT NULL,
    app_key VARCHAR(64) UNIQUE NOT NULL,
    secret_ciphertext TEXT NOT NULL,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cluster VARCHAR(32) NOT NULL DEFAULT 'mt1',
    rate_limit_rps INT NOT NULL DEFAULT 1000,
    max_connections INT NOT NULL DEFAULT 10000,
    message_history_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    webhooks_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_apps_app_key ON apps(app_key);
CREATE INDEX IF NOT EXISTS idx_apps_owner_id ON apps(owner_id);

-- 3. API Key Scopes (Fine-grained keys per app)
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    app_id VARCHAR(64) NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL DEFAULT 'Default Key',
    key VARCHAR(64) UNIQUE NOT NULL,
    secret_ciphertext TEXT NOT NULL,
    scopes TEXT[] NOT NULL DEFAULT ARRAY['read', 'trigger'],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_app_id ON api_keys(app_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(key);

-- 4. Beams Instances (Pusher Beams compatible push instances)
CREATE TABLE IF NOT EXISTS beams_instances (
    instance_id VARCHAR(64) PRIMARY KEY,
    app_id VARCHAR(64) UNIQUE NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    fcm_service_account TEXT, -- Encrypted JSON
    apns_key TEXT,            -- Encrypted .p8 key
    apns_key_id VARCHAR(32),
    apns_team_id VARCHAR(32),
    apns_bundle_id VARCHAR(255),
    apns_production BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Devices (Push tokens registered to Beams)
CREATE TABLE IF NOT EXISTS devices (
    device_id VARCHAR(128) PRIMARY KEY,
    instance_id VARCHAR(64) NOT NULL REFERENCES beams_instances(instance_id) ON DELETE CASCADE,
    platform VARCHAR(16) NOT NULL, -- 'fcm' | 'apns'
    token TEXT NOT NULL,
    user_id VARCHAR(128),
    interests TEXT[] NOT NULL DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devices_instance_id ON devices(instance_id);
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(instance_id, user_id);
CREATE INDEX IF NOT EXISTS idx_devices_interests ON devices USING GIN(interests);
CREATE INDEX IF NOT EXISTS idx_devices_token ON devices(instance_id, token);

-- 6. Channel History (Optional message log for replay)
CREATE TABLE IF NOT EXISTS channel_history (
    id BIGSERIAL PRIMARY KEY,
    app_id VARCHAR(64) NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    channel_name VARCHAR(255) NOT NULL,
    event_name VARCHAR(255) NOT NULL,
    payload TEXT NOT NULL,
    socket_id VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_channel_history_lookup ON channel_history(app_id, channel_name, created_at DESC);

-- 7. Webhooks
CREATE TABLE IF NOT EXISTS webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    app_id VARCHAR(64) NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    events TEXT[] NOT NULL DEFAULT ARRAY['channel_occupied', 'channel_vacated', 'member_added', 'member_removed', 'client_event'],
    secret_ciphertext TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_app_id ON webhooks(app_id);

-- 8. Webhook Deliveries (Audit log & replay queue)
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    app_id VARCHAR(64) NOT NULL,
    event VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL,
    status_code INT,
    response_body TEXT,
    attempt INT NOT NULL DEFAULT 1,
    status VARCHAR(32) NOT NULL DEFAULT 'pending', -- 'success', 'failed', 'retrying'
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_app ON webhook_deliveries(app_id, created_at DESC);

-- 9. Push Deliveries (Beams receipts & stats)
CREATE TABLE IF NOT EXISTS push_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instance_id VARCHAR(64) NOT NULL REFERENCES beams_instances(instance_id) ON DELETE CASCADE,
    publish_id VARCHAR(64) NOT NULL,
    target_type VARCHAR(32) NOT NULL, -- 'interest' | 'user'
    target VARCHAR(255) NOT NULL,
    platform VARCHAR(16) NOT NULL,
    sent_count INT NOT NULL DEFAULT 0,
    failed_count INT NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'completed',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_deliveries_instance ON push_deliveries(instance_id, created_at DESC);
