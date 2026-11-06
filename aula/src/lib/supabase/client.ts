'use client';
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_KEY, SUPABASE_URL, assertSupabaseEnv } from './env';

let client: SupabaseClient | undefined;

/** Cliente de Supabase para el navegador (sesión en cookies, compartida con el servidor). */
export function supabase(): SupabaseClient {
  if (!client) {
    assertSupabaseEnv();
    client = createBrowserClient(SUPABASE_URL, SUPABASE_KEY);
  }
  return client;
}
