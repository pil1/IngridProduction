#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function updateProfiles() {
  console.log('🔄 Updating existing profiles with complete data...');

  const updates = [
    {
      email: 'super@phantomglass.com',
      first_name: 'Super',
      last_name: 'Administrator',
      phone: '(555) 000-0001'
    },
    {
      email: 'admin@phantomglass.com',
      first_name: 'Company',
      last_name: 'Administrator',
      phone: '(555) 000-0002'
    },
    {
      email: 'user@phantomglass.com',
      first_name: 'Regular',
      last_name: 'User',
      phone: '(555) 000-0003'
    }
  ];

  for (const update of updates) {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        first_name: update.first_name,
        last_name: update.last_name,
        phone: update.phone,
        is_active: true
      })
      .eq('email', update.email)
      .select();

    if (error) {
      console.error(`Error updating profile ${update.email}:`, error.message);
    } else {
      console.log(`✅ Updated profile: ${update.email}`);
    }
  }

  // Verify updates
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('email, full_name, first_name, last_name, phone, role, company_id, is_active')
    .order('email');

  if (error) {
    console.error('Error fetching profiles:', error.message);
  } else {
    console.log('\n📋 Current profiles:');
    profiles.forEach(profile => {
      console.log(`   ${profile.email}: ${profile.full_name} (${profile.role}) - Complete: ${!!(profile.first_name && profile.last_name)}`);
    });
  }
}

updateProfiles().catch(console.error);