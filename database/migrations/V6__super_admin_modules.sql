-- Migration V6: Super Admin Modules (Plans, Subscriptions, Payments, Invoices, Email Providers, Templates, Announcements, Feature Flags, Licenses, Policies, Branding, and Admin Audit)

-- 1. Extend Organizations table with Super Admin tenant fields if not present
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS domain VARCHAR(255);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS industry VARCHAR(120);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS country VARCHAR(100);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS owner_name VARCHAR(200);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS owner_email VARCHAR(320);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS plan_id VARCHAR(64);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS seats_limit INTEGER DEFAULT 25;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS suspended_reason TEXT;

-- 2. Commercial Billing Plans
CREATE TABLE IF NOT EXISTS plans (
    id VARCHAR(64) PRIMARY KEY,
    code VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    tagline VARCHAR(255),
    monthly_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    annual_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    is_popular BOOLEAN NOT NULL DEFAULT false,
    badge_label VARCHAR(64),
    brand_color VARCHAR(30) DEFAULT 'blue',
    ai_token_quota VARCHAR(64),
    trial_days INTEGER NOT NULL DEFAULT 14,
    max_seats INTEGER NOT NULL DEFAULT 10,
    max_projects INTEGER NOT NULL DEFAULT 5,
    max_workspaces INTEGER NOT NULL DEFAULT 1,
    storage_gb INTEGER NOT NULL DEFAULT 10,
    api_rate_limit_per_min INTEGER NOT NULL DEFAULT 300,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plan_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id VARCHAR(64) NOT NULL REFERENCES plans (id) ON DELETE CASCADE,
    feature_text VARCHAR(255) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_plan_features_plan ON plan_features (plan_id, sort_order);

-- 3. Tenant Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
    id VARCHAR(64) PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    plan_id VARCHAR(64) NOT NULL REFERENCES plans (id),
    billing_cycle VARCHAR(30) NOT NULL DEFAULT 'MONTHLY',
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    seats INTEGER NOT NULL DEFAULT 1,
    amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
    current_period_end TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '1 month'),
    auto_renew BOOLEAN NOT NULL DEFAULT true,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
    payment_method_label VARCHAR(120) DEFAULT 'Corporate Credit Card',
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_org ON subscriptions (org_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions (status);

-- 4. Payment Records
CREATE TABLE IF NOT EXISTS payments (
    id VARCHAR(64) PRIMARY KEY,
    transaction_ref VARCHAR(100) NOT NULL UNIQUE,
    org_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    subscription_id VARCHAR(64) REFERENCES subscriptions (id) ON DELETE SET NULL,
    invoice_id VARCHAR(64),
    amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    refunded_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    status VARCHAR(30) NOT NULL DEFAULT 'SUCCEEDED',
    method VARCHAR(30) NOT NULL DEFAULT 'CARD',
    method_last4 VARCHAR(10) DEFAULT '4242',
    gateway_label VARCHAR(80) DEFAULT 'Stripe Gateway',
    description VARCHAR(255) NOT NULL,
    failure_reason TEXT,
    refund_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_org ON payments (org_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments (status);

-- 5. Invoices
CREATE TABLE IF NOT EXISTS invoices (
    id VARCHAR(64) PRIMARY KEY,
    invoice_number VARCHAR(100) NOT NULL UNIQUE,
    org_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    subscription_id VARCHAR(64) REFERENCES subscriptions (id) ON DELETE SET NULL,
    payment_id VARCHAR(64) REFERENCES payments (id) ON DELETE SET NULL,
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '14 days'),
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN',
    subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    tax_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    paid_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoices_org ON invoices (org_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices (status);

CREATE TABLE IF NOT EXISTS invoice_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id VARCHAR(64) NOT NULL REFERENCES invoices (id) ON DELETE CASCADE,
    description VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total NUMERIC(10, 2) NOT NULL DEFAULT 0.00
);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice ON invoice_line_items (invoice_id);

-- 6. Email Providers & SMTP Configuration
CREATE TABLE IF NOT EXISTS email_providers (
    id VARCHAR(64) PRIMARY KEY,
    provider_type VARCHAR(40) NOT NULL DEFAULT 'SMTP_CUSTOM',
    host VARCHAR(255) NOT NULL DEFAULT 'smtp.sendgrid.net',
    port INTEGER NOT NULL DEFAULT 587,
    encryption VARCHAR(20) NOT NULL DEFAULT 'TLS',
    username VARCHAR(255) NOT NULL DEFAULT 'apikey',
    password_encrypted VARCHAR(255),
    from_name VARCHAR(120) NOT NULL DEFAULT 'ProWise Support',
    from_email VARCHAR(320) NOT NULL DEFAULT 'no-reply@prowise.io',
    reply_to_email VARCHAR(320) NOT NULL DEFAULT 'support@prowise.io',
    rate_limit_per_minute INTEGER NOT NULL DEFAULT 120,
    retry_attempts INTEGER NOT NULL DEFAULT 3,
    retry_backoff_seconds INTEGER NOT NULL DEFAULT 15,
    track_opens BOOLEAN NOT NULL DEFAULT true,
    track_clicks BOOLEAN NOT NULL DEFAULT true,
    sandbox_mode BOOLEAN NOT NULL DEFAULT false,
    connection_status VARCHAR(30) NOT NULL DEFAULT 'CONNECTED',
    last_tested_at TIMESTAMPTZ,
    last_test_message TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Email Templates
CREATE TABLE IF NOT EXISTS email_templates (
    id VARCHAR(64) PRIMARY KEY,
    template_key VARCHAR(80) NOT NULL UNIQUE,
    code VARCHAR(64),
    name VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'ALERTS',
    trigger_description TEXT,
    header_badge VARCHAR(80),
    banner_color VARCHAR(30) DEFAULT 'indigo',
    sender_brand_name VARCHAR(120) DEFAULT 'ProWise',
    show_highlight_box BOOLEAN NOT NULL DEFAULT true,
    footer_note TEXT,
    open_rate NUMERIC(5, 2) DEFAULT 0.00,
    click_rate NUMERIC(5, 2) DEFAULT 0.00,
    subject VARCHAR(255) NOT NULL,
    headline VARCHAR(255) NOT NULL,
    body_paragraphs TEXT NOT NULL,
    cta_label VARCHAR(100),
    cta_url VARCHAR(255),
    variables JSONB NOT NULL DEFAULT '[]'::jsonb,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    version BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by VARCHAR(200) NOT NULL DEFAULT 'Super Admin'
);
CREATE INDEX IF NOT EXISTS idx_email_templates_category ON email_templates (category);

-- 8. Platform Announcements
CREATE TABLE IF NOT EXISTS announcements (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(40) NOT NULL DEFAULT 'INFO',
    target_audience VARCHAR(50) NOT NULL DEFAULT 'ALL_ORGS',
    target_plans JSONB NOT NULL DEFAULT '[]'::jsonb,
    target_org_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    channels JSONB NOT NULL DEFAULT '["IN_APP_BANNER"]'::jsonb,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    scheduled_for TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    created_by VARCHAR(200) NOT NULL DEFAULT 'Super Admin',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_announcements_status ON announcements (status);

-- 9. Feature Flags
CREATE TABLE IF NOT EXISTS feature_flags (
    id VARCHAR(64) PRIMARY KEY,
    flag_key VARCHAR(80) NOT NULL UNIQUE,
    label VARCHAR(150) NOT NULL,
    description TEXT,
    enabled BOOLEAN NOT NULL DEFAULT false,
    audience VARCHAR(50) NOT NULL DEFAULT 'All Tenants',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. License Keys
CREATE TABLE IF NOT EXISTS license_keys (
    id VARCHAR(64) PRIMARY KEY,
    license_key VARCHAR(120) NOT NULL UNIQUE,
    org_id UUID REFERENCES organizations (id) ON DELETE CASCADE,
    plan_id VARCHAR(64) REFERENCES plans (id) ON DELETE SET NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    max_seats INTEGER NOT NULL DEFAULT 10,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '1 year'),
    revoked_at TIMESTAMPTZ,
    revoked_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_license_keys_org ON license_keys (org_id);
CREATE INDEX IF NOT EXISTS idx_license_keys_status ON license_keys (status);

-- 11. Platform Governance Policies & Global Branding
CREATE TABLE IF NOT EXISTS platform_policies (
    id VARCHAR(64) PRIMARY KEY,
    checkin_grace_working_days INTEGER NOT NULL DEFAULT 3,
    stale_webhook_minutes INTEGER NOT NULL DEFAULT 60,
    audit_retention_days INTEGER NOT NULL DEFAULT 90,
    enforce_mfa_for_operators BOOLEAN NOT NULL DEFAULT true,
    auto_suspend_after_past_due_days INTEGER NOT NULL DEFAULT 14,
    default_trial_days INTEGER NOT NULL DEFAULT 14,
    max_attachment_mb INTEGER NOT NULL DEFAULT 50,
    maintenance_banner_mode BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_branding (
    id VARCHAR(64) PRIMARY KEY,
    platform_name VARCHAR(100) NOT NULL DEFAULT 'ProWise Delivery Cloud',
    support_email VARCHAR(320) NOT NULL DEFAULT 'support@prowise.io',
    status_page_url VARCHAR(255) NOT NULL DEFAULT 'https://status.prowise.io',
    default_timezone VARCHAR(100) NOT NULL DEFAULT 'UTC',
    default_language VARCHAR(50) NOT NULL DEFAULT 'English (US)',
    date_format VARCHAR(40) NOT NULL DEFAULT 'MMM DD, YYYY',
    currency_display VARCHAR(30) NOT NULL DEFAULT 'USD ($)',
    compact_density BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. Super Admin Activity & Audit Trail
CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category VARCHAR(50) NOT NULL,
    action VARCHAR(120) NOT NULL,
    summary TEXT NOT NULL,
    actor_name VARCHAR(200) NOT NULL,
    actor_email VARCHAR(320) NOT NULL,
    target_label VARCHAR(200),
    severity VARCHAR(20) NOT NULL DEFAULT 'INFO',
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_cat ON admin_audit_logs (category, timestamp DESC);

-- =========================================================================
-- SEED DATA FOR PRODUCTION INITIALIZATION
-- =========================================================================

-- Seed 4 Commercial Billing Plans
INSERT INTO plans (id, code, name, tagline, monthly_price, annual_price, currency, status, is_popular, badge_label, brand_color, trial_days, max_seats, max_projects, max_workspaces, storage_gb, api_rate_limit_per_min) VALUES
    ('plan-free', 'FREE', 'Free Sandbox', 'Evaluation workspace for small delivery trials', 0.00, 0.00, 'USD', 'ACTIVE', false, 'Evaluation', 'sky', 0, 5, 3, 1, 5, 120),
    ('plan-starter', 'STARTER', 'Starter', 'For boutique engineering consultancies & startups', 499.00, 4990.00, 'USD', 'ACTIVE', false, 'Foundations', 'blue', 14, 25, 15, 3, 50, 600),
    ('plan-pro', 'PROFESSIONAL', 'Professional', 'For scaling venture-backed engineering organizations', 1299.00, 12990.00, 'USD', 'ACTIVE', true, 'Most Popular', 'emerald', 14, 100, 60, 10, 250, 2400),
    ('plan-enterprise', 'ENTERPRISE', 'Enterprise', 'For regulated healthcare & financial institutions', 4999.00, 49990.00, 'USD', 'ACTIVE', false, 'Dedicated Cloud', 'violet', 30, 500, 250, 50, 2000, 10000)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    tagline = EXCLUDED.tagline,
    monthly_price = EXCLUDED.monthly_price,
    annual_price = EXCLUDED.annual_price;

INSERT INTO plan_features (plan_id, feature_text, sort_order) VALUES
    ('plan-free', 'Up to 3 active projects', 1),
    ('plan-free', 'Individual & structured modes', 2),
    ('plan-free', '7-day audit log retention', 3),
    ('plan-free', 'Community forum support', 4),
    ('plan-starter', 'Up to 25 active seats', 1),
    ('plan-starter', '15 concurrent delivery projects', 2),
    ('plan-starter', 'GitHub App commit & PR sync', 3),
    ('plan-starter', '90-day immutable audit retention', 4),
    ('plan-starter', 'Standard email support (8h SLA)', 5),
    ('plan-pro', 'Up to 100 active seats', 1),
    ('plan-pro', 'Unlimited GitHub repositories', 2),
    ('plan-pro', 'Scope baseline change-control', 3),
    ('plan-pro', 'Priority SLA (2h response)', 4),
    ('plan-pro', 'Safe CSV & executive exports', 5),
    ('plan-enterprise', 'Up to 500 seats & 50 workspaces', 1),
    ('plan-enterprise', 'Dedicated tenant encryption keys', 2),
    ('plan-enterprise', 'Enterprise SSO & directory sync', 3),
    ('plan-enterprise', 'HIPAA & SOC 2 Type II compliance pack', 4),
    ('plan-enterprise', '15-minute 24/7 incident SLA', 5)
ON CONFLICT DO NOTHING;

-- Seed Default Email Provider
INSERT INTO email_providers (id, provider_type, host, port, encryption, username, from_name, from_email, reply_to_email, connection_status) VALUES
    ('provider-default', 'SMTP_CUSTOM', 'smtp.sendgrid.net', 587, 'TLS', 'apikey', 'ProWise Delivery Cloud', 'no-reply@prowise.io', 'support@prowise.io', 'CONNECTED')
ON CONFLICT (id) DO NOTHING;

-- Seed Standard Email Templates
INSERT INTO email_templates (id, template_key, code, name, category, header_badge, banner_color, subject, headline, body_paragraphs, cta_label, cta_url, variables) VALUES
    ('tpl-1', 'auth.welcome', 'AUTH-01', 'Welcome to ProWise', 'AUTH', 'Account Ready', 'emerald', 'Welcome to {{organization_name}} on ProWise', 'Your Workspace is Ready', 'Welcome aboard! Your administrator {{owner_name}} has provisioned access for you.', 'Log In to Workspace', 'https://app.prowise.io/login', '["organization_name", "owner_name", "login_url"]'::jsonb),
    ('tpl-2', 'billing.invoice_receipt', 'BILL-01', 'Monthly Invoice Receipt', 'BILLING', 'Receipt Issued', 'indigo', 'Invoice #{{invoice_number}} Receipt for {{organization_name}}', 'Payment Succeeded', 'We successfully processed your payment of {{amount}} for the {{plan_name}} plan.', 'View Invoice PDF', 'https://app.prowise.io/invoices', '["invoice_number", "organization_name", "amount", "plan_name"]'::jsonb),
    ('tpl-3', 'billing.payment_failed', 'BILL-02', 'Action Required: Payment Failed', 'BILLING', 'Dunning Notice', 'rose', 'Urgent: Renewal Charge Failed for {{organization_name}}', 'Action Required: Update Payment Method', 'We were unable to process your renewal charge of {{amount}}. Please update your billing method.', 'Update Payment Details', 'https://app.prowise.io/billing', '["organization_name", "amount", "retry_date"]'::jsonb),
    ('tpl-4', 'alerts.system_incident', 'ALERT-01', 'Platform Operational Incident Notice', 'ALERTS', 'Critical Notice', 'amber', 'Service Alert: {{incident_title}}', 'Operational Incident Update', 'Our SRE team is investigating an issue affecting {{affected_service}}.', 'Inspect Status Page', 'https://status.prowise.io', '["incident_title", "affected_service", "status_page_url"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Seed Default Feature Flags
INSERT INTO feature_flags (id, flag_key, label, description, enabled, audience) VALUES
    ('flag-ai-reports', 'ai_executive_summaries', 'AI Executive Delivery Summaries', 'Automated progress synthesis using Google Gemini interactions model', true, 'All Tenants'),
    ('flag-github-app', 'github_app_v2', 'GitHub App V2 Integration', 'High-throughput webhook processing and granular repository permissions', true, 'All Tenants'),
    ('flag-break-glass', 'break_glass_support', 'Tenant Break-Glass Support Access', 'Time-bound privileged operator access governance with audit logging', true, 'Internal Operators'),
    ('flag-advance-dunning', 'smart_dunning_retries', 'Smart Payment Retry Engine', 'Automated ML-backed dunning scheduling for declined corporate cards', false, 'Enterprise Only')
ON CONFLICT (id) DO NOTHING;

-- Seed Global Policies and Branding
INSERT INTO platform_policies (id, checkin_grace_working_days, stale_webhook_minutes, audit_retention_days, enforce_mfa_for_operators, auto_suspend_after_past_due_days, default_trial_days, max_attachment_mb, maintenance_banner_mode) VALUES
    ('policy-default', 3, 60, 90, true, 14, 14, 50, false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO platform_branding (id, platform_name, support_email, status_page_url, default_timezone, default_language, date_format, currency_display, compact_density) VALUES
    ('branding-default', 'ProWise Delivery Cloud', 'support@prowise.io', 'https://status.prowise.io', 'UTC', 'English (US)', 'MMM DD, YYYY', 'USD ($)', false)
ON CONFLICT (id) DO NOTHING;
