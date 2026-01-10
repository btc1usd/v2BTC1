import { createClient } from '@supabase/supabase-js';

// Supabase configuration for client-side (with RLS)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Supabase configuration for server-side (bypasses RLS)
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let supabaseClient: ReturnType<typeof createClient> | null = null;
let supabaseAdminClient: ReturnType<typeof createClient> | null = null;
let isInitialized = false;
let isAdminInitialized = false;

// Create a single supabase client for interacting with your database (client-side with RLS)
try {
  if (supabaseUrl && supabaseAnonKey) {
    console.log('ℹ️ Initializing Supabase client...');
    console.log('  URL:', supabaseUrl);
    console.log('  Key:', supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'not set');
    
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          'x-application-name': 'btc1usd-frontend'
        }
      }
    });
    isInitialized = true;
    console.log('✅ Supabase client initialized successfully');
  } else {
    console.warn('⚠️ Supabase credentials not found in environment variables');
    supabaseClient = null;
    isInitialized = false;
  }
} catch (error) {
  console.warn('⚠️ Failed to initialize Supabase client:', (error as Error).message);
  supabaseClient = null;
  isInitialized = false;
}

// Create admin client with service role key (bypasses RLS) - for server-side only
try {
  if (supabaseUrl && supabaseServiceKey) {
    console.log('ℹ️ Initializing Supabase Admin client (service role)...');
    console.log('  URL:', supabaseUrl);
    console.log('  Service Key:', supabaseServiceKey ? `${supabaseServiceKey.substring(0, 20)}...` : 'not set');
    
    supabaseAdminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        detectSessionInUrl: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          'x-application-name': 'btc1usd-backend'
        }
      }
    });
    isAdminInitialized = true;
    console.log('✅ Supabase Admin client initialized successfully');
  } else {
    console.warn('⚠️ Supabase service role key not found - admin client unavailable');
    supabaseAdminClient = null;
    isAdminInitialized = false;
  }
} catch (error) {
  console.warn('⚠️ Failed to initialize Supabase admin client:', (error as Error).message);
  supabaseAdminClient = null;
  isAdminInitialized = false;
}

export const supabase = supabaseClient;
export const supabaseAdmin = supabaseAdminClient;

// Check if Supabase is configured
export const isSupabaseConfigured = () => {
  return isInitialized && !!(supabaseUrl && supabaseUrl.length > 0 && supabaseAnonKey && supabaseAnonKey.length > 0);
};

// Check if Supabase admin (service role) is configured
export const isSupabaseAdminConfigured = () => {
  return isAdminInitialized && !!(supabaseUrl && supabaseUrl.length > 0 && supabaseServiceKey && supabaseServiceKey.length > 0);
};

// Types for database
export interface MerkleDistributionRow {
  id: number;
  merkle_root: string;
  total_rewards: string;
  claims: any; // JSONB
  metadata: any; // JSONB
  created_at: string;
}