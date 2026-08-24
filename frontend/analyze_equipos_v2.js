import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://lvgdhtajxrtrbrsgvgcy.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2Z2RodGFqeHJ0cmJyc2d2Z2N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MTE4NTYsImV4cCI6MjA5OTE4Nzg1Nn0.TT_GLtM2fSS_MSPaoiRCRRWoOX3GwokfznAcchnTwGA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function normalizeString(str) {
  if (!str) return '';
  let clean = str.toUpperCase().trim();
  clean = clean.replace(/SERIAL:\s*/g, 'SERIAL:');
  clean = clean.replace(/DE\s+/g, ''); // remove "DE " (e.g. UPS XMART DE 10KVA -> UPS XMART 10KVA)
  clean = clean.replace(/\s+/g, ' '); // replace multiple spaces with single
  clean = clean.replace(/(\d+)\s+KVA/g, '$1KVA'); // remove space before KVA
  return clean.trim();
}

async function run() {
  const { data: equipos, error } = await supabase.from('equipos_ups').select('*');
  const { data: agencias } = await supabase.from('agencias').select('id, cod, nombre');
  const agenciaMap = {};
  agencias.forEach(a => agenciaMap[a.id] = a);

  const byAgency = {};
  for (const equipo of equipos) {
    if (!byAgency[equipo.agencia_id]) byAgency[equipo.agencia_id] = [];
    byAgency[equipo.agencia_id].push(equipo);
  }

  let totalDuplicatesFound = 0;
  const reports = [];

  for (const [agenciaId, list] of Object.entries(byAgency)) {
    if (list.length <= 1) continue;

    const normalizedGroups = {};
    for (const eq of list) {
      // Reconstruct what the UI displays exactly
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
        for (const item of items) {
          reports.push(`  ID: ${item.eq.id} -> "${item.combined}"`);
        }
      }
    }
  }

  console.log(reports.join('\n'));
  console.log(`\nTotal de duplicados lógicos encontrados: ${totalDuplicatesFound}`);
}

run();
