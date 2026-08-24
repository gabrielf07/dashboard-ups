import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://lvgdhtajxrtrbrsgvgcy.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2Z2RodGFqeHJ0cmJyc2d2Z2N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MTE4NTYsImV4cCI6MjA5OTE4Nzg1Nn0.TT_GLtM2fSS_MSPaoiRCRRWoOX3GwokfznAcchnTwGA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  const { data: agencias } = await supabase.from('agencias').select('id').eq('cod', '339');
  if (!agencias || agencias.length === 0) return console.log('Agencia 339 not found');
  const agId = agencias[0].id;

  const { data: equipos } = await supabase.from('equipos_ups').select('*').eq('agencia_id', agId);
  console.log("Equipos in DB for 339:");
  for (const eq of equipos) {
      console.log(`ID: ${eq.id} | Marca: "${eq.marca}" | Modelo: "${eq.modelo}" | Serial: "${eq.serial}"`);
  }
}
run();
