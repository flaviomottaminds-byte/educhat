import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://yuhtzkhoxnabrsrhqdni.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_A54HdxBc1e2vqNBNHYkXFg_4VRXvqrp';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
