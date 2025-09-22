#!/usr/bin/env node

/**
 * Database Seeding Script for INFOtrac Development
 * Creates realistic test data for local development and testing
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Local Supabase configuration
const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YPP81IU';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

console.log('🌱 INFOtrac Database Seeding');
console.log('============================\n');

// Sample data
const seedData = {
  companies: [
    {
      name: 'Phantom Glass Inc.',
      description: 'Premium glass manufacturing and installation',
      email: 'info@phantomglass.com',
      phone: '(555) 123-4567',
      website: 'https://phantomglass.com',
      address: '123 Glass Street, Crystal City, CA 90210',
      subscription_plan: 'pro'
    },
    {
      name: 'Tech Innovations Ltd.',
      description: 'Software development and consulting',
      email: 'contact@techinnovations.com',
      phone: '(555) 987-6543',
      website: 'https://techinnovations.com',
      address: '456 Innovation Blvd, Silicon Valley, CA 94301',
      subscription_plan: 'enterprise'
    },
    {
      name: 'Green Solutions Co.',
      description: 'Sustainable energy consulting',
      email: 'hello@greensolutions.co',
      phone: '(555) 456-7890',
      website: 'https://greensolutions.co',
      address: '789 Eco Drive, Portland, OR 97201',
      subscription_plan: 'basic'
    }
  ],

  users: [
    {
      email: 'super@phantomglass.com',
      full_name: 'Super Administrator',
      role: 'super-admin'
    },
    {
      email: 'admin@phantomglass.com',
      full_name: 'Company Administrator',
      role: 'admin'
    },
    {
      email: 'user@phantomglass.com',
      full_name: 'Regular User',
      role: 'user'
    },
    {
      email: 'manager@techinnovations.com',
      full_name: 'Tech Manager',
      role: 'admin'
    },
    {
      email: 'dev@techinnovations.com',
      full_name: 'Senior Developer',
      role: 'user'
    }
  ],

  vendors: [
    { name: 'Office Supply Pro', email: 'orders@officesupplypro.com', phone: '(555) 111-2222' },
    { name: 'Tech Equipment Inc.', email: 'sales@techequipment.com', phone: '(555) 333-4444' },
    { name: 'Professional Services LLC', email: 'billing@proservices.com', phone: '(555) 555-6666' },
    { name: 'Transportation Solutions', email: 'accounts@transportsolutions.com', phone: '(555) 777-8888' },
    { name: 'Facility Management Co.', email: 'invoicing@facilitymanagement.com', phone: '(555) 999-0000' }
  ],

  expenseCategories: [
    { name: 'Office Supplies', description: 'Pens, paper, folders, and general office materials' },
    { name: 'Travel & Transportation', description: 'Business travel, mileage, parking, and transportation costs' },
    { name: 'Meals & Entertainment', description: 'Business meals, client entertainment, and related expenses' },
    { name: 'Equipment & Software', description: 'Computers, software licenses, and tech equipment' },
    { name: 'Professional Services', description: 'Consulting, legal, accounting, and other professional fees' },
    { name: 'Marketing & Advertising', description: 'Promotional materials, advertising campaigns, and marketing costs' },
    { name: 'Utilities & Communications', description: 'Phone, internet, electricity, and utility bills' },
    { name: 'Training & Development', description: 'Employee training, conferences, and skill development' }
  ],

  customers: [
    { name: 'ABC Corporation', email: 'billing@abccorp.com', phone: '(555) 200-3000' },
    { name: 'XYZ Industries', email: 'accounts@xyzind.com', phone: '(555) 400-5000' },
    { name: 'Local Restaurant Group', email: 'finance@localrestaurants.com', phone: '(555) 600-7000' },
    { name: 'City Government', email: 'procurement@city.gov', phone: '(555) 800-9000' },
    { name: 'Educational District', email: 'purchasing@school-district.edu', phone: '(555) 100-1100' }
  ]
};

async function seedCompanies() {
  console.log('🏢 Seeding companies...');

  const { data, error } = await supabase
    .from('companies')
    .upsert(seedData.companies, { onConflict: 'name' })
    .select();

  if (error) {
    console.error('Error seeding companies:', error.message);
    return null;
  }

  console.log(`✅ Created ${data.length} companies`);
  return data;
}

async function seedUsers(companies) {
  console.log('👥 Seeding users...');

  // For demo purposes, we'll create the user profiles directly
  // In a real app, users would be created through Supabase Auth
  const usersWithCompanies = seedData.users.map((user, index) => ({
    ...user,
    user_id: `demo-user-${index + 1}`, // Placeholder user IDs
    company_id: companies[index % companies.length]?.id
  }));

  const { data, error } = await supabase
    .from('profiles')
    .upsert(usersWithCompanies, { onConflict: 'user_id' })
    .select();

  if (error) {
    console.error('Error seeding users:', error.message);
    return null;
  }

  console.log(`✅ Created ${data.length} user profiles`);
  return data;
}

async function seedVendors(companies) {
  console.log('🏪 Seeding vendors...');

  const vendorsWithCompanies = [];
  companies.forEach(company => {
    seedData.vendors.forEach(vendor => {
      vendorsWithCompanies.push({
        ...vendor,
        company_id: company.id
      });
    });
  });

  const { data, error } = await supabase
    .from('vendors')
    .upsert(vendorsWithCompanies, { onConflict: 'company_id,name' })
    .select();

  if (error) {
    console.error('Error seeding vendors:', error.message);
    return null;
  }

  console.log(`✅ Created ${data.length} vendors`);
  return data;
}

async function seedExpenseCategories(companies) {
  console.log('📊 Seeding expense categories...');

  const categoriesWithCompanies = [];
  companies.forEach(company => {
    seedData.expenseCategories.forEach(category => {
      categoriesWithCompanies.push({
        ...category,
        company_id: company.id
      });
    });
  });

  const { data, error } = await supabase
    .from('expense_categories')
    .upsert(categoriesWithCompanies, { onConflict: 'company_id,name' })
    .select();

  if (error) {
    console.error('Error seeding expense categories:', error.message);
    return null;
  }

  console.log(`✅ Created ${data.length} expense categories`);
  return data;
}

async function seedCustomers(companies) {
  console.log('🤝 Seeding customers...');

  const customersWithCompanies = [];
  companies.forEach(company => {
    seedData.customers.forEach(customer => {
      customersWithCompanies.push({
        ...customer,
        company_id: company.id
      });
    });
  });

  const { data, error } = await supabase
    .from('customers')
    .upsert(customersWithCompanies, { onConflict: 'company_id,name' })
    .select();

  if (error) {
    console.error('Error seeding customers:', error.message);
    return null;
  }

  console.log(`✅ Created ${data.length} customers`);
  return data;
}

async function enableModulesForCompanies(companies) {
  console.log('🔧 Enabling modules for companies...');

  // Get all available modules
  const { data: modules, error: modulesError } = await supabase
    .from('modules')
    .select('*');

  if (modulesError) {
    console.error('Error fetching modules:', modulesError.message);
    return;
  }

  const companyModules = [];
  companies.forEach(company => {
    modules.forEach(module => {
      // Enable core modules for all companies
      // Enable add-on modules based on subscription plan
      const shouldEnable = module.module_type === 'core' ||
        (company.subscription_plan === 'pro' && module.name !== 'Advanced Analytics') ||
        (company.subscription_plan === 'enterprise');

      if (shouldEnable) {
        companyModules.push({
          company_id: company.id,
          module_id: module.id,
          is_enabled: true,
          monthly_price: module.default_monthly_price,
          per_user_price: module.default_per_user_price
        });
      }
    });
  });

  const { data, error } = await supabase
    .from('company_modules')
    .upsert(companyModules, { onConflict: 'company_id,module_id' })
    .select();

  if (error) {
    console.error('Error enabling company modules:', error.message);
    return null;
  }

  console.log(`✅ Enabled ${data.length} company modules`);
  return data;
}

async function main() {
  try {
    // Test connection
    const { data: healthCheck } = await supabase.from('companies').select('count()').single();
    console.log('🔗 Connected to local Supabase\n');

    // Seed data in order
    const companies = await seedCompanies();
    if (!companies) return;

    await seedUsers(companies);
    await seedVendors(companies);
    await seedExpenseCategories(companies);
    await seedCustomers(companies);
    await enableModulesForCompanies(companies);

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n🚀 Ready for development with test data:');
    console.log(`   • ${seedData.companies.length} companies`);
    console.log(`   • ${seedData.users.length} user profiles`);
    console.log(`   • ${seedData.vendors.length * seedData.companies.length} vendors`);
    console.log(`   • ${seedData.expenseCategories.length * seedData.companies.length} expense categories`);
    console.log(`   • ${seedData.customers.length * seedData.companies.length} customers`);
    console.log('\n💡 View your data at: http://127.0.0.1:54323\n');

  } catch (error) {
    console.error('💥 Seeding failed:', error.message);
    process.exit(1);
  }
}

main();