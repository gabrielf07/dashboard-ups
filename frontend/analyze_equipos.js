import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://lvgdhtajxrtrbrsgvgcy.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2Z2RodGFqeHJ0cmJyc2d2Z2N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MTE4NTYsImV4cCI6MjA5OTE4Nzg1Nn0.TT_GLtM2fSS_MSPaoiRCRRWoOX3GwokfznAcchnTwGA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function normalizeString(str) {
  if (!str) return '';
  let clean = str.toUpperCase().trim();
  clean = clean.replace(/\s+/g, ' '); // replace multiple spaces with single
  clean = clean.replace(/(\d+)\s+KVA/g, '$1KVA'); // remove space before KVA
  return clean;
}

async function run() {
  console.log("Fetching equipos_ups...");
  const { data: equipos, error } = await supabase.from('equipos_ups').select('*');
  if (error) {
    console.error(error);
    return;
  }

  const { data: agencias } = await supabase.from('agencias').select('id, cod, nombre');
  const agenciaMap = {};
  agencias.forEach(a => agenciaMap[a.id] = a);

  // Group by agency_id
  const byAgency = {};
  for (const equipo of equipos) {
    if (!byAgency[equipo.agencia_id]) {
      byAgency[equipo.agencia_id] = [];
    }
    byAgency[equipo.agencia_id].push(equipo);
  }

  let totalDuplicatesFound = 0;
  const reports = [];
  const duplicateIdsToMerge = [];

  for (const [agenciaId, list] of Object.entries(byAgency)) {
    if (list.length <= 1) continue;

    // Group by normalized combined string
    const normalizedGroups = {};
    for (const eq of list) {
      const isMigratedSerial = eq.serial && (eq.serial.startsWith('migrated-') || eq.serial.startsWith('fallback-'));
      const combined = `${eq.marca || ''} ${eq.modelo || ''} ${!isMigratedSerial && eq.serial ? `SERIAL: ${eq.serial}` : ''}`.trim();
      const norm = normalizeString(combined);

      if (!normalizedGroups[norm]) normalizedGroups[norm] = [];
      normalizedGroups[norm].push({ eq, combined });
    }

    const duplicates = Object.entries(normalizedGroups).filter(([norm, items]) => items.length > 1);
    if (duplicates.length > 0) {
      const ag = agenciaMap[agenciaId] || { cod: '?', nombre: '?' };
      reports.push(`\nAgencia: ${ag.cod} - ${ag.nombre}`);
      for (const [norm, items] of duplicates) {
        totalDuplicatesFound += (items.length - 1);
        reports.push(`  Normalizado: "${norm}"`);
        
        // Let's decide a "master" equipment to keep (e.g. the first one)
        const master = items[0];
        reports.push(`    [MANTENER] ID: ${master.eq.id} -> "${master.combined}"`);
        
        for (let i = 1; i < items.length; i++) {
          const dup = items[i];
          reports.push(`    [ELIMINAR] ID: ${dup.eq.id} -> "${dup.combined}"`);
          duplicateIdsToMerge.push({
            keepId: master.eq.id,
            removeId: dup.eq.id
          });
        }
      }
    }
  }

  console.log(reports.join('\n'));
  console.log(`\nTotal de duplicados encontrados: ${totalDuplicatesFound}`);
}

run();
