import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Replace these with your actual keys from .env
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://lvgdhtajxrtrbrsgvgcy.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2Z2RodGFqeHJ0cmJyc2d2Z2N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MTE4NTYsImV4cCI6MjA5OTE4Nzg1Nn0.TT_GLtM2fSS_MSPaoiRCRRWoOX3GwokfznAcchnTwGA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function retry(fn, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fn();
      if (res.error && res.error.message && res.error.message.includes('fetch failed')) {
         throw res.error;
      }
      return res;
    } catch (e) {
      if (i === retries - 1) return { error: e };
      await sleep(1000);
    }
  }
}

async function migrate() {
  console.log("Iniciando migración de datos...");
  const rawData = fs.readFileSync(path.join(__dirname, 'src/data.json'), 'utf8');
  const agenciasData = JSON.parse(rawData);

  // 1. Regiones y Estados únicos
  const regionEstadoSet = new Set();
  agenciasData.forEach(ag => {
    regionEstadoSet.add(JSON.stringify({ region: ag.region, estado: ag.estado }));
  });

  const uniqueRegionEstados = Array.from(regionEstadoSet).map(s => JSON.parse(s));
  
  for (const re of uniqueRegionEstados) {
    const { data, error } = await retry(() => supabase.from('regiones_estados').upsert({ region: re.region, estado: re.estado }, { onConflict: 'region, estado' }).select());
    if (error) console.error("Error inserting region:", error);
  }
  
  const { data: dbRegionEstados } = await retry(() => supabase.from('regiones_estados').select('*'));

  // 2. Insert Agencias
  for (const ag of agenciasData) {
    const reId = dbRegionEstados.find(re => re.region === ag.region && re.estado === ag.estado)?.id;
    
    // Insert or update agencia
    const { data: agenciaDB, error: agErr } = await retry(() => supabase.from('agencias').upsert({
      cod: ag.cod,
      nombre: ag.nombre,
      estado_id: reId,
      estatus_agencia: ag.estatus
    }, { onConflict: 'cod' }).select().single());

    if (agErr || !agenciaDB) {
      console.error("Error inserting agencia", ag.cod, agErr);
      continue;
    }
    
    const agenciaId = agenciaDB.id;

    // 3. Equipos e Inspecciones
    let equiposMap = {}; // name -> id

    // Registramos todos los equipos instalados o mencionados
    const allEquiposNames = new Set([...(ag.equipos_instalados || []), ...(ag.inspecciones?.map(i => i.equipo) || [])].filter(Boolean));
    
    // Also include equipo_base if missing? Sure.
    if (ag.equipo_base) allEquiposNames.add(ag.equipo_base);

    for (const eqName of allEquiposNames) {
      const deterministicSerial = `migrated-${agenciaId}-${eqName.replace(/[^a-zA-Z0-9]/g, '')}`;
      const { data: eqDB, error: eqErr } = await retry(() => supabase.from('equipos_ups').insert({
        agencia_id: agenciaId,
        marca: eqName,
        serial: deterministicSerial 
      }).select().single()); 
      
      if (!eqErr && eqDB) {
        equiposMap[eqName] = eqDB.id;
      }
    }

    // Now insert inspections
    if (ag.inspecciones && ag.inspecciones.length > 0) {
      for (const insp of ag.inspecciones) {
        let eId = equiposMap[insp.equipo];
        if (!eId) {
          // fallback equipo
          const fallbackSerial = `fallback-${agenciaId}-${(insp.equipo || 'Desconocido').replace(/[^a-zA-Z0-9]/g, '')}`;
          const { data: newEq } = await retry(() => supabase.from('equipos_ups').insert({
            agencia_id: agenciaId,
            marca: insp.equipo || 'Desconocido',
            serial: fallbackSerial
          }).select().single());
          if (newEq) {
             eId = newEq.id;
             equiposMap[insp.equipo || 'Desconocido'] = eId;
          }
        }

        // Insert mtto
        // Note: the schema has UNIQUE constraint on (equipo_id, tipo_actividad, fecha_visita)
        // the schema date fields are DATE, so they expect YYYY-MM-DD.
        // if fecha is null, we might need a fallback.
        const fechaVisita = insp.fecha || '2000-01-01';
        const tipoAct = (insp.observacion || '').substring(0, 500);

        const { data: mttoDB, error: mttoErr } = await retry(() => supabase.from('historico_mantenimientos').insert({
          equipo_id: eId,
          tipo_actividad: tipoAct || 'No indica',
          estatus_textual: insp.estatus || 'Desconocido',
          is_operativo: String(insp.estatus).toLowerCase().includes('operativo'),
          fecha_visita: fechaVisita,
          equipo_desincorporado: insp.equipo_desincorporado || null,
          respalda: insp.respalda || ''
        }).select().single());

        if (mttoErr || !mttoDB) {
           console.error("Error inserting mtto for agencia", ag.cod, mttoErr);
           continue;
        }

        const mttoId = mttoDB.id;

        // Insert Fotos
        if (insp.fotos) {
           const { bypass, ups, otras } = insp.fotos;
           
           const pushFotos = async (fotosArr, etapa) => {
             if (!fotosArr) return;
             for (const f of fotosArr) {
                await retry(() => supabase.from('registro_fotografico').insert({
                  mantenimiento_id: mttoId,
                  url_imagen: f,
                  etapa: etapa,
                  tipo_archivo: 'imagen'
                }));
             }
           };

           await pushFotos(bypass, 'Bypass');
           await pushFotos(ups, 'UPS');
           await pushFotos(otras, 'Otros');
        }

        // Insert Planillas
        if (insp.planillas && insp.planillas.length > 0) {
           for (const p of insp.planillas) {
              await retry(() => supabase.from('registro_fotografico').insert({
                  mantenimiento_id: mttoId,
                  url_imagen: p,
                  etapa: 'Planilla',
                  tipo_archivo: 'planilla_pdf'
              }));
           }
        }
      }
    }
  }
  console.log("¡Migración completada exitosamente!");
}

migrate();
