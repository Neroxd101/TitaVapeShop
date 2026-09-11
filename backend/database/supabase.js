const { createClient } = require('@supabase/supabase-js');

// Environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Create Supabase client with anon key (respects RLS)
const supabaseAnon = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Create Supabase client with service role key (bypasses RLS)
const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// Export both clients
module.exports = {
  supabase: supabaseAnon,      // Default client (anon key)
  supabaseAnon,                // Explicit anon client
  supabaseAdmin,               // Admin client (service role)
  supabaseUrl,                 // URL for frontend config
  supabaseAnonKey              // Anon key for frontend config
};
