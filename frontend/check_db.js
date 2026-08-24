import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://lvgdhtajxrtrbrsgvgcy.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2Z2RodGFqeHJ0cmJyc2d2Z2N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MTE4NTYsImV4cCI6MjA5OTE4Nzg1Nn0.TT_GLtM2fSS_MSPaoiRCRRWoOX3GwokfznAcchnTwGA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function check() {
  const { count: agCount, error: err1 } = await supabase.from('agencias').select('*', { count: 'exact', head: true });
  console.log("Agencias:", agCount, err1);
  const { count: eqCount, error: err2 } = await supabase.from('equipos_ups').select('*', { count: 'exact', head: true });
  console.log("Equipos:", eqCount, err2);
  const { count: histCount, error: err3 } = await supabase.from('historico_mantenimientos').select('*', { count: 'exact', head: true });
  console.log("Historico:", histCount, err3);
  const { count: fotoCount, error: err4 } = await supabase.from('registro_fotografico').select('*', { count: 'exact', head: true });
  console.log("Fotos:", fotoCount, err4);
  
  // also check how the frontend fetches data for Agencia 568
  const { data: ag568 } = await supabase.from('agencias').select(`
    *,
    equipos_ups (
      *,
      historico_mantenimientos (
        *,
        registro_fotografico (*)
      )
    )
  `).eq('codigo', '568').single();
  
  console.log("Agencia 568 data:", JSON.stringify(ag568, null, 2));
}

check();
