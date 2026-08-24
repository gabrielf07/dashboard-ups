import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://lvgdhtajxrtrbrsgvgcy.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2Z2RodGFqeHJ0cmJyc2d2Z2N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MTE4NTYsImV4cCI6MjA5OTE4Nzg1Nn0.TT_GLtM2fSS_MSPaoiRCRRWoOX3GwokfznAcchnTwGA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function wipe() {
  console.log("Limpiando base de datos (borrando duplicados)...");
  
  // To avoid hitting 1000 row delete limits or timeouts, we could use RPC or just delete in batches,
  // but Supabase REST API `delete().neq('id', 0)` works for < 1000 rows. If it's more, it might fail.
  // Actually, delete() without eq/neq is not allowed, neq('id', 0) might delete only 1000 rows.
  // We'll just loop until count is 0.
  
  const tables = ['registro_fotografico', 'historico_mantenimientos', 'equipos_ups', 'agencias', 'regiones_estados'];
  
  for (const t of tables) {
     let count = 1;
     while (count > 0) {
        const { data, error } = await supabase.from(t).delete().neq('id', 0).select('id');
        if (error) {
           console.error("Error al borrar", t, error);
           break;
        }
        count = data ? data.length : 0;
        console.log(`Borrados ${count} registros de ${t}`);
     }
  }
  
  console.log("Limpieza terminada.");
}

wipe();
