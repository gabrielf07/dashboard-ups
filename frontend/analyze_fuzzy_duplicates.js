import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://lvgdhtajxrtrbrsgvgcy.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2Z2RodGFqeHJ0cmJyc2d2Z2N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MTE4NTYsImV4cCI6MjA5OTE4Nzg1Nn0.TT_GLtM2fSS_MSPaoiRCRRWoOX3GwokfznAcchnTwGA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function levenshteinDistance(a, b) {
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

function extractSerial(str) {
    const match = str.toUpperCase().match(/SERIAL:?\s*([A-Z0-9\-]+)/);
    return match ? match[1] : null;
}

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
  const { data: equipos } = await supabase.from('equipos_ups').select('*');
  
  const byAgency = {};
  for (const equipo of equipos) {
    if (!byAgency[equipo.agencia_id]) byAgency[equipo.agencia_id] = [];
    byAgency[equipo.agencia_id].push(equipo);
  }

  let fuzzyDupes = [];

  for (const [agenciaId, list] of Object.entries(byAgency)) {
    if (list.length <= 1) continue;

    const validEquipos = list.filter(e => e.marca !== 'Desconocido');
    
    // check for fuzzy matches
    for (let i = 0; i < validEquipos.length; i++) {
        for (let j = i + 1; j < validEquipos.length; j++) {
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
            let reason = '';
            
            if (serial1 && serial2 && serial1 === serial2) {
                isMatch = true;
                reason = `Exact Serial Match (${serial1})`;
            } else if (serial1 && serial2 && levenshteinDistance(serial1, serial2) <= 2 && serial1.length > 5) {
                isMatch = true;
                reason = `Fuzzy Serial Match (${serial1} vs ${serial2})`;
            } else if (similarity > 0.80) {
                isMatch = true;
                reason = `High String Similarity (${similarity.toFixed(2)})`;
            }
            
            if (isMatch) {
                fuzzyDupes.push({
                    agenciaId,
                    eq1: eq1.marca,
                    eq2: eq2.marca,
                    reason,
                    id1: eq1.id,
                    id2: eq2.id
                });
            }
        }
    }
  }

  console.log(`Found ${fuzzyDupes.length} fuzzy duplicates`);
  console.log(JSON.stringify(fuzzyDupes.slice(0, 10), null, 2));
}

run();
