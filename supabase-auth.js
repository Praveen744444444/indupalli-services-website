import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://lfjgtwiivdqvcgzbfkmu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ciq7OcjZ7kRgDbaD2Pbn-g_Echw4BfY';

export const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);