import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://lvgdhtajxrtrbrsgvgcy.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2Z2RodGFqeHJ0cmJyc2d2Z2N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MTE4NTYsImV4cCI6MjA5OTE4Nzg1Nn0.TT_GLtM2fSS_MSPaoiRCRRWoOX3GwokfznAcchnTwGA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export function levenshteinDistance(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) == a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

export function extractSerial(str) {
    const match = str.toUpperCase().match(/SERIAL:?\s*([A-Z0-9\-]+)/);
    // filter out generic short/bad serials
    if (match && match[1].length > 4 && match[1] !== 'S/N' && match[1] !== 'N/A') {
        return match[1];
    }
    return null;
}

export function normalizeString(str) {
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
  console.log("Fetching all equipment data...");
  const { data: equipos, error: eqErr } = await supabase.from('equipos_ups').select('*');
  if (eqErr) {
    console.error("Error fetching equipos:", eqErr);
    return;
  }
  
  const { data: historicos, error: histErr } = await supabase.from('historico_mantenimientos').select('id, equipo_id');
  if (histErr) {
    console.error("Error fetching historicos:", histErr);
    return;
  }

  const byAgency = {};
  for (const equipo of equipos) {
    if (!byAgency[equipo.agencia_id]) byAgency[equipo.agencia_id] = [];
    byAgency[equipo.agencia_id].push(equipo);
  }

  let totalMerged = 0;
  let totalDesconocidosDeleted = 0;
  let totalDesconocidosMerged = 0;

  for (const [agenciaId, list] of Object.entries(byAgency)) {
    if (list.length <= 1) {
      // Check if the single item is a "Desconocido" with NO inspections
      if (list.length === 1 && list[0].marca === 'Desconocido') {
        const hasInsps = historicos.some(h => h.equipo_id === list[0].id);
        if (!hasInsps) {
          console.log(`Deleting orphan Desconocido ${list[0].id} in agency ${agenciaId}`);
          await supabase.from('equipos_ups').delete().eq('id', list[0].id);
          totalDesconocidosDeleted++;
        }
      }
      continue;
    }

    const validEquipos = list.filter(e => e.marca !== 'Desconocido');
    const desconocidos = list.filter(e => e.marca === 'Desconocido');

    // 1. Process "Desconocido"
    for (const desc of desconocidos) {
      const hasInsps = historicos.some(h => h.equipo_id === desc.id);
      if (!hasInsps) {
        // Safe to delete completely
        console.log(`Deleting orphan Desconocido ${desc.id} in agency ${agenciaId}`);
        await supabase.from('equipos_ups').delete().eq('id', desc.id);
        totalDesconocidosDeleted++;
      } else if (validEquipos.length === 1) {
        // Merge into the ONLY valid equipment
        const masterId = validEquipos[0].id;
        console.log(`Merging Desconocido ${desc.id} into master ${masterId}`);
        await supabase.from('historico_mantenimientos').update({ equipo_id: masterId }).eq('equipo_id', desc.id);
        await supabase.from('equipos_ups').delete().eq('id', desc.id);
        totalDesconocidosMerged++;
      } else {
        console.log(`Warning: Desconocido ${desc.id} has inspections but there are ${validEquipos.length} valid equipments. Cannot safely merge automatically.`);
      }
    }

    // 2. Process Fuzzy Duplicates
    if (validEquipos.length > 1) {
      let mergedIds = new Set();
      
      for (let i = 0; i < validEquipos.length; i++) {
          if (mergedIds.has(validEquipos[i].id)) continue;

          for (let j = i + 1; j < validEquipos.length; j++) {
              if (mergedIds.has(validEquipos[j].id)) continue;

              const eq1 = validEquipos[i];
              const eq2 = validEquipos[j];
              
              const norm1 = normalizeString(eq1.marca);
              const norm2 = normalizeString(eq2.marca);
              
              const dist = levenshteinDistance(norm1, norm2);
              const maxLength = Math.max(norm1.length, norm2.length);
              const similarity = 1 - dist / maxLength;
              
              const serial1 = extractSerial(eq1.marca);
              const serial2 = extractSerial(eq2.marca);
              
              let isMatch = false;
              
              if (serial1 && serial2 && serial1 === serial2) {
                  isMatch = true;
              } else if (serial1 && serial2 && levenshteinDistance(serial1, serial2) <= 2 && serial1.length > 5) {
                  isMatch = true;
              } else if (similarity > 0.80) {
                  isMatch = true;
              }
              
              if (isMatch) {
                  // Merge eq2 into eq1
                  const masterId = eq1.id;
                  const dupId = eq2.id;
                  
                  console.log(`Merging valid duplicate ${dupId} into master ${masterId} (Agency: ${agenciaId})`);
                  
                  // Re-assign inspections
                  const { error: updErr } = await supabase
                    .from('historico_mantenimientos')
                    .update({ equipo_id: masterId })
                    .eq('equipo_id', dupId);
                  
                  if (!updErr) {
                    const { error: delErr } = await supabase
                      .from('equipos_ups')
                      .delete()
                      .eq('id', dupId);
                      
                    if (!delErr) {
                      mergedIds.add(dupId);
                      totalMerged++;
                    } else {
                      console.error(`Failed to delete dup ${dupId}:`, delErr);
                    }
                  } else {
                    console.error(`Failed to reassign historicos for ${dupId}:`, updErr);
                  }
              }
          }
      }
    }
  }

  console.log(`\n¡Proceso Finalizado!`);
  console.log(`- Equipos unificados por similitud: ${totalMerged}`);
  console.log(`- Desconocidos huerfanos eliminados: ${totalDesconocidosDeleted}`);
  console.log(`- Desconocidos unificados (al unico equipo real): ${totalDesconocidosMerged}`);
}

run();
