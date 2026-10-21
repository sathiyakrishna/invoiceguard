import type { SupabaseClient } from '@supabase/supabase-js';

export function loadEnv(file?: string): void;
export function loadAdmin(): SupabaseClient;
export function testerEmail(): string;
export function findUser(admin: SupabaseClient, email: string): Promise<{ id: string; email?: string } | null>;
