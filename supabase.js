import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { auth } from './firebase.js';

const SUPABASE_URL = 'https://lfjgtwiivdqvcgzbfkmu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ciq7OcjZ7kRgDbaD2Pbn-g_Echw4BfY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false
  },
  global: {
    fetch: async (url, options = {}) => {
      // Create a Headers object from existing options or default to empty
      const headers = new Headers(options.headers || {});
      
      // 1. Explicitly guarantee the Supabase API key header is always present
      if (!headers.has('apikey')) {
        headers.set('apikey', SUPABASE_ANON_KEY);
      }

      // 2. Attach the Firebase Auth token if a user is currently logged in
      const currentUser = auth.currentUser;
      if (currentUser) {
        try {
          const token = await currentUser.getIdToken();
          headers.set('Authorization', `Bearer ${token}`);
        } catch (e) {
          console.warn("Could not retrieve Firebase token:", e);
        }
      }
      
      // Pass the fully constructed headers back into the native fetch
      return fetch(url, { ...options, headers });
    }
  }
});