import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://lvgdhtajxrtrbrsgvgcy.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2Z2RodGFqeHJ0cmJyc2d2Z2N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MTE4NTYsImV4cCI6MjA5OTE4Nzg1Nn0.TT_GLtM2fSS_MSPaoiRCRRWoOX3GwokfznAcchnTwGA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function normalizeString(str) {
  if (!str) return '';
  // Convert to uppercase, remove extra whitespace, standardise "10 KVA" to "10KVA"
  let clean = str.toUpperCase().trim();
  clean = clean.replace(/\s+/g, ' '); // replace multiple spaces with single
  clean = clean.replace(/(\d+)\s+KVA/g, '$1KVA'); // remove space before KVA
  return clean;
}

async function run() {
  console.log("Fetching historico_mantenimientos...");
  const { data: mttos, error } = await supabase.from('historico_mantenimientos').select('agencia_id, equipo');
  if (error) {
    console.error(error);
    return;
  }

  const { data: agencias } = await supabase.from('agencias').select('id, cod, nombre');
  const agenciaMap = {};
  agencias.forEach(a => agenciaMap[a.id] = a);

  // Group by agency_id
  const byAgency = {};
  for (const mtto of mttos) {
    if (!mtto.equipo || mtto.equipo === 'Desconocido' || mtto.equipo === 'N/A') continue;
    
    if (!byAgency[mtto.agencia_id]) {
      byAgency[mtto.agencia_id] = new Set();
    }
    byAgency[mtto.agencia_id].add(mtto.equipo);
  }

  let totalDuplicatesFound = 0;
  const reports = [];

  for (const [agenciaId, equiposSet] of Object.entries(byAgency)) {
    const equipos = Array.from(equiposSet);
    if (equipos.length <= 1) continue;

    // Group by normalized string
    const normalizedGroups = {};
    for (const eq of equipos) {
      const norm = normalizeString(eq);
      if (!normalizedGroups[norm]) normalizedGroups[norm] = [];
      normalizedGroups[norm].push(eq);
    }

    const duplicates = Object.entries(normalizedGroups).filter(([norm, list]) => list.length > 1);
    if (duplicates.length > 0) {
      const ag = agenciaMap[agenciaId] || { cod: '?', nombre: '?' };
      reports.push(`\nAgencia: ${ag.cod} - ${ag.nombre}`);
      for (const [norm, list] of duplicates) {
        totalDuplicatesFound += (list.length - 1);
        reports.push(`  Normalizado: "${norm}"`);
        for (const orig of list) {
          reports.push(`    - "${orig}"`);
        }
      }
    }
  }

  console.log(reports.join('\n'));
  console.log(`\nTotal duplicados lógicos encontrados: ${totalDuplicatesFound}`);
}

run();
