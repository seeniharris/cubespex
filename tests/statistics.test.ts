export const supabaseConfig = {
  url: import.meta.env.VITE_SUPABASE_URL || '',
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || ''
};

export function hasSupabaseConfig(): boolean {
  return Boolean(supabaseConfig.url && supabaseConfig.anonKey);
}

export function getSupabaseStatusMessage(): string {
  if (!hasSupabaseConfig()) {
    return 'Supabase not configured. Local-only mode is active.';
  }
  return 'Supabase configuration detected. Cloud sync is ready to connect.';
}

export function createSupabaseClient() {
  return null;
}
