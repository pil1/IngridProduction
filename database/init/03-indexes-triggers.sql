-- ================================================================
-- INFOTRAC POSTGRESQL DATABASE INITIALIZATION - PART 3
-- ================================================================
-- Indexes, Triggers, and Functions
-- ================================================================

-- ================================================================
-- CREATE INDEXES FOR PERFORMANCE
-- ================================================================

-- Auth indexes
CREATE INDEX idx_auth_users_email ON auth_users(email);
CREATE INDEX idx_auth_users_active ON auth_users(is_active);
CREATE INDEX idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX idx_auth_sessions_expires ON auth_sessions(expires_at);

-- Core business indexes
CREATE INDEX idx_companies_slug ON companies(slug);
CREATE INDEX idx_companies_active ON companies(is_active);
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_profiles_company_id ON profiles(company_id);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_email ON profiles(email);

-- Module system indexes
CREATE INDEX idx_modules_type_active ON modules(module_type, is_active);
CREATE INDEX idx_modules_category ON modules(category);
CREATE INDEX idx_company_modules_company_enabled ON company_modules(company_id, is_enabled);
CREATE INDEX idx_user_modules_user_company ON user_modules(user_id, company_id);

-- Permission system indexes
CREATE INDEX idx_permissions_key ON permissions(permission_key);
CREATE INDEX idx_permissions_module ON permissions(module_id);
CREATE INDEX idx_user_permissions_user_company ON user_permissions(user_id, company_id);
CREATE INDEX idx_user_permissions_granted ON user_permissions(is_granted, expires_at);

-- Business entity indexes
CREATE INDEX idx_vendors_company_active ON vendors(company_id, is_active);
CREATE INDEX idx_vendors_name_gin ON vendors USING GIN (to_tsvector('english', name));
CREATE INDEX idx_customers_company_active ON customers(company_id, is_active);
CREATE INDEX idx_customers_name_gin ON customers USING GIN (to_tsvector('english', name));
CREATE INDEX idx_gl_accounts_company_code ON gl_accounts(company_id, account_code);
CREATE INDEX idx_expense_categories_company_active ON expense_categories(company_id, is_active);

-- Expense system indexes
CREATE INDEX idx_expenses_company_user ON expenses(company_id, submitted_by);
CREATE INDEX idx_expenses_date ON expenses(expense_date);
CREATE INDEX idx_expenses_status ON expenses(status);
CREATE INDEX idx_expenses_company_status_date ON expenses(company_id, status, expense_date);

-- Ingrid AI indexes
CREATE INDEX idx_suggested_categories_company_status ON ingrid_suggested_categories(company_id, status);
CREATE INDEX idx_suggested_vendors_company_status ON ingrid_suggested_vendors(company_id, status);

-- Notification and settings indexes
CREATE INDEX idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX idx_api_keys_company_active ON company_api_keys(company_id, is_active);

-- ================================================================
-- CREATE TRIGGERS FOR updated_at
-- ================================================================

-- Auth triggers
CREATE TRIGGER trigger_auth_users_updated_at
    BEFORE UPDATE ON auth_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Core business triggers
CREATE TRIGGER trigger_companies_updated_at
    BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Module system triggers
CREATE TRIGGER trigger_modules_updated_at
    BEFORE UPDATE ON modules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_company_modules_updated_at
    BEFORE UPDATE ON company_modules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_user_modules_updated_at
    BEFORE UPDATE ON user_modules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Permission system triggers
CREATE TRIGGER trigger_permissions_updated_at
    BEFORE UPDATE ON permissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_user_permissions_updated_at
    BEFORE UPDATE ON user_permissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_role_permissions_updated_at
    BEFORE UPDATE ON role_permissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Business entity triggers
CREATE TRIGGER trigger_vendors_updated_at
    BEFORE UPDATE ON vendors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_gl_accounts_updated_at
    BEFORE UPDATE ON gl_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_expense_categories_updated_at
    BEFORE UPDATE ON expense_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Expense system triggers
CREATE TRIGGER trigger_expenses_updated_at
    BEFORE UPDATE ON expenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Ingrid AI triggers
CREATE TRIGGER trigger_ingrid_suggested_categories_updated_at
    BEFORE UPDATE ON ingrid_suggested_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_ingrid_suggested_vendors_updated_at
    BEFORE UPDATE ON ingrid_suggested_vendors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Notification and settings triggers
CREATE TRIGGER trigger_notifications_updated_at
    BEFORE UPDATE ON notifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_company_settings_updated_at
    BEFORE UPDATE ON company_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_company_api_keys_updated_at
    BEFORE UPDATE ON company_api_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_currencies_updated_at
    BEFORE UPDATE ON currencies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_user_table_preferences_updated_at
    BEFORE UPDATE ON user_table_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_user_preferences_updated_at
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();