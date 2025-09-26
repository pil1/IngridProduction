-- ================================================================
-- REMOVE PRICING TIERS MIGRATION
-- ================================================================
-- This migration removes all tiered pricing logic from the system
-- Moving to custom per-company pricing only
-- ================================================================

-- Remove subscription_tier column from companies table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'companies' AND column_name = 'subscription_tier') THEN
        ALTER TABLE companies DROP COLUMN subscription_tier;
        RAISE NOTICE 'Removed subscription_tier column from companies table';
    ELSE
        RAISE NOTICE 'subscription_tier column does not exist in companies table';
    END IF;
END $$;

-- Remove billing_tier column from company_modules table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'company_modules' AND column_name = 'billing_tier') THEN
        ALTER TABLE company_modules DROP COLUMN billing_tier;
        RAISE NOTICE 'Removed billing_tier column from company_modules table';
    ELSE
        RAISE NOTICE 'billing_tier column does not exist in company_modules table';
    END IF;
END $$;

-- Remove pricing_tier column from company_modules table if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'company_modules' AND column_name = 'pricing_tier') THEN
        ALTER TABLE company_modules DROP COLUMN pricing_tier;
        RAISE NOTICE 'Removed pricing_tier column from company_modules table';
    ELSE
        RAISE NOTICE 'pricing_tier column does not exist in company_modules table';
    END IF;
END $$;

-- Verify that monthly_price and per_user_price columns are preserved
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'company_modules' AND column_name = 'monthly_price') THEN
        RAISE EXCEPTION 'monthly_price column is missing from company_modules table - this should be preserved';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'company_modules' AND column_name = 'per_user_price') THEN
        RAISE EXCEPTION 'per_user_price column is missing from company_modules table - this should be preserved';
    END IF;

    RAISE NOTICE 'Verified that pricing columns (monthly_price, per_user_price) are preserved';
END $$;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Migration 012: Successfully removed all pricing tier columns';
    RAISE NOTICE 'Custom pricing per company is now the only pricing model';
    RAISE NOTICE 'Monthly_price and per_user_price columns preserved for custom pricing';
END $$;