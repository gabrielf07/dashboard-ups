import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://lvgdhtajxrtrbrsgvgcy.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2Z2RodGFqeHJ0cmJyc2d2Z2N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MTE4NTYsImV4cCI6MjA5OTE4Nzg1Nn0.TT_GLtM2fSS_MSPaoiRCRRWoOX3GwokfznAcchnTwGA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function search() {
  console.log("Searching for 494 or Valera or Pineda...");
  
  const { data, error } = await supabase
    .from('agencias')
    .select('*')
    .or('cod.ilike.%494%,nombre.ilike.%valera%,nombre.ilike.%pineda%');

  if (error) {
    console.error("Error searching:", error);
    return;
  }
  
  console.log("Found agencies:", JSON.stringify(data, null, 2));
}

search();
