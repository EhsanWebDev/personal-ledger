import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL ?? import.meta.env.EXPO_PUBLIC_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_KEY ?? import.meta.env.EXPO_PUBLIC_SUPABASE_KEY;

export const supabase = url && key ? createClient(url, key) : null;
