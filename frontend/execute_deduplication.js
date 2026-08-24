import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://lvgdhtajxrtrbrsgvgcy.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2Z2RodGFqeHJ0cmJyc2d2Z2N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MTE4NTYsImV4cCI6MjA5OTE4Nzg1Nn0.TT_GLtM2fSS_MSPaoiRCRRWoOX3GwokfznAcchnTwGA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function normalizeString(str) {
  if (!str) return '';
  let clean = str.toUpperCase().trim();
  clean = clean.replace(/UPS\s+/g, '');
  clean = clean.replace(/SERIAL:\s*/g, 'SERIAL:');
  clean = clean.replace(/DE\s+/g, '');
  clean = clean.replace(/\s*KVA/g, '');
  clean = clean.replace(/\s*VA/g, '');
  clean = clean.replace(/\s+/g, ' '); 
  return clean.trim();
}

async function run() {
  const { data: equipos, error } = await supabase.from('equipos_ups').select('*');
  
  const byAgency = {};
  for (const equipo of equipos) {
    if (!byAgency[equipo.agencia_id]) byAgency[equipo.agencia_id] = [];
    byAgency[equipo.agencia_id].push(equipo);
  }

  let totalMerged = 0;
  
  for (const [agenciaId, list] of Object.entries(byAgency)) {
    if (list.length <= 1) continue;

    const normalizedGroups = {};
    for (const eq of list) {
      const isMigratedSerial = eq.serial && (eq.serial.startsWith('migrated-') || eq.serial.startsWith('fallback-'));
      // Note: We combine MARCA, MODELO, and SERIAL to identify duplicates!
      const combined = `${eq.marca || ''} ${eq.modelo || ''} ${!isMigratedSerial && eq.serial ? `SERIAL: ${eq.serial}` : ''}`.trim();
      const norm = normalizeString(combined);

      if (!normalizedGroups[norm]) normalizedGroups[norm] = [];
      normalizedGroups[norm].push({ eq, combined });
    }

    const duplicates = Object.entries(normalizedGroups).filter(([norm, items]) => items.length > 1);
    
    for (const [norm, items] of duplicates) {
      // items[0] will be our Master record
      const master = items[0].eq;
      
      for (let i = 1; i < items.length; i++) {
        const dup = items[i].eq;
        
        console.log(`Merging ${dup.id} into ${master.id} (Both are: ${norm})`);
        
        // 1. Update historico_mantenimientos to point to master.id
        const { error: updError } = await supabase
          .from('historico_mantenimientos')
          .update({ equipo_id: master.id })
          .eq('equipo_id', dup.id);
          
        if (updError) {
          console.error("Error updating historico:", updError);
          continue; // skip deleting if update failed
        }
        
        // 2. Delete the duplicate from equipos_ups
        const { error: delError } = await supabase
          .from('equipos_ups')
          .delete()
          .eq('id', dup.id);
          
        if (delError) {
          console.error("Error deleting equipo:", delError);
        } else {
          totalMerged++;
        }
      }
    }
  }

  console.log(`\n¡Proceso Finalizado! Total de equipos unificados: ${totalMerged}`);
}

run();
