import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://lvgdhtajxrtrbrsgvgcy.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2Z2RodGFqeHJ0cmJyc2d2Z2N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MTE4NTYsImV4cCI6MjA5OTE4Nzg1Nn0.TT_GLtM2fSS_MSPaoiRCRRWoOX3GwokfznAcchnTwGA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const dataPath = path.join(__dirname, 'src', 'data.json');
const rawData = fs.readFileSync(dataPath, 'utf8');
const dataJson = JSON.parse(rawData);

async function patchObservaciones() {
  console.log("Iniciando parche de observaciones...");
  let count = 0;
  
  // Get all equipos to map
  const { data: equiposDB } = await supabase.from('equipos_ups').select('id, agencia_id');
  
  for (const ag of dataJson) {
    if (!ag.inspecciones) continue;
    
    // Find agencia DB id
    const { data: agDB } = await supabase.from('agencias').select('id').eq('cod', ag.cod).single();
    if (!agDB) continue;
    const agId = agDB.id;
    
    for (const insp of ag.inspecciones) {
      if (!insp.observacion || insp.observacion.trim() === '') continue;
      
      const tipoAct = insp.observacion.substring(0, 500);
      const fechaVisita = insp.fecha || '2000-01-01';
      
      // Since we don't have equipo_id easily without regenerating the hash, 
      // let's just find the record in historico_mantenimientos that matches fecha_visita and is in this agencia.
      // Wait, there could be multiple equipments in the same agency on the same date.
      // But we know 'estatus_textual' and 'is_operativo'.
      
      // So let's fetch all mttos for this agency on this date
      const eqIdsForAg = equiposDB.filter(e => e.agencia_id === agId).map(e => e.id);
      
      if (eqIdsForAg.length > 0) {
        const { data: mttosToUpdate } = await supabase.from('historico_mantenimientos')
          .select('id, tipo_actividad')
          .in('equipo_id', eqIdsForAg)
          .eq('fecha_visita', fechaVisita)
          .eq('estatus_textual', insp.estatus || 'Desconocido');
          
        if (mttosToUpdate && mttosToUpdate.length > 0) {
           for (const m of mttosToUpdate) {
             if (m.tipo_actividad === 'No indica') {
               await supabase.from('historico_mantenimientos').update({ tipo_actividad: tipoAct }).eq('id', m.id);
               count++;
               if (count % 10 === 0) console.log(`Parcheadas ${count} observaciones...`);
             }
           }
        }
      }
    }
  }
  console.log(`Completado. Total parcheadas: ${count}`);
}

patchObservaciones().catch(console.error);
