import { createClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';

// Lazy initialization for browser client
let _supabase: ReturnType<typeof createBrowserClient> | null = null;

export const getSupabase = () => {
  if (!_supabase) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        'Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
      );
    }

    _supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
  }
  return _supabase;
};

// For backward compatibility - use getSupabase() for new code
export const supabase = new Proxy({} as ReturnType<typeof createBrowserClient>, {
  get(_, prop) {
    return (getSupabase() as Record<string, unknown>)[prop as string];
  },
});

// Admin client for server-side operations
let _supabaseAdmin: ReturnType<typeof createClient> | null = null;

export const getSupabaseAdmin = () => {
  if (typeof window !== 'undefined') {
    throw new Error('supabaseAdmin can only be used server-side');
  }

  if (!_supabaseAdmin) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error(
        'Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
      );
    }

    _supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return _supabaseAdmin;
};

// For backward compatibility - use getSupabaseAdmin() instead
export const supabaseAdmin = getSupabaseAdmin;

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          subscription_tier: 'free' | 'paid';
          stripe_customer_id: string | null;
          role: 'user' | 'admin';
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          subscription_tier?: 'free' | 'paid';
          stripe_customer_id?: string | null;
          role?: 'user' | 'admin';
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          subscription_tier?: 'free' | 'paid';
          stripe_customer_id?: string | null;
          role?: 'user' | 'admin';
          created_at?: string;
        };
      };
      user_topics: {
        Row: {
          id: string;
          user_id: string;
          topic_name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          topic_name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          topic_name?: string;
          created_at?: string;
        };
      };
      subscription_metadata: {
        Row: {
          id: string;
          user_id: string;
          stripe_subscription_id: string;
          status: string;
          current_period_end: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          stripe_subscription_id: string;
          status: string;
          current_period_end: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          stripe_subscription_id?: string;
          status?: string;
          current_period_end?: string;
          created_at?: string;
        };
      };
      user_email_settings: {
        Row: {
          id: string;
          user_id: string;
          delivery_time: string;
          timezone: string;
          paused: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          delivery_time?: string;
          timezone?: string;
          paused?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          delivery_time?: string;
          timezone?: string;
          paused?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      email_archive: {
        Row: {
          id: string;
          user_id: string;
          sent_at: string;
          subject: string;
          content: unknown;
          topics: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          sent_at?: string;
          subject: string;
          content: unknown;
          topics: string[];
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          sent_at?: string;
          subject?: string;
          content?: unknown;
          topics?: string[];
          created_at?: string;
        };
      };
    };
  };
};
