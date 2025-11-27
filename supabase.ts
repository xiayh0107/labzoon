import { createClient } from "@supabase/supabase-js";

// Vite exposes env vars via import.meta.env with VITE_ prefix
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Supabase URL or Key is missing! Please check your .env file.");
}

export const supabase = createClient(supabaseUrl || '', supabaseKey || '');