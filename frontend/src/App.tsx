import { useState, useMemo, useEffect } from 'react';
import { Search, Activity, Battery, AlertTriangle, Calendar, CheckCircle2, ChevronRight, Zap, MapPin, ChevronDown, Plus, X, BarChart3, Trash2, Edit2, Sun, Moon, User } from 'lucide-react';
import './index.css';

import { supabase } from './lib/supabaseClient';
import backupData from './data.json';

const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr || dateStr === 'N/D' || dateStr === 'Sin registros') return dateStr || 'N/D';
  if (dateStr === '2021/2022') return dateStr;
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

// --- Tipos y Datos de Prueba ---
type Inspeccion = {
  id?: number;
  fecha: string | null;
  raw_fecha?: string | null;
  proximo_mantenimiento: string | null;
  estatus: string;
  is_operativo: boolean;
  observacion: string;
  fotos: {
    bypass?: string[];
    ups?: string[];
    otras?: string[];
  };
  equipo?: string;
  equipo_id?: number;
  respalda?: string;
  equipo_desincorporado?: string | null;
  planillas?: string[];
};

type Agencia = {
  id?: number;
  cod: string;
  nombre: string;
  estado: string;
  region: string;
  estatus: string;
  equipos: number;
  kva: number;
  equipo_base: string;
  baterias_base: string;
  equipos_instalados: string[];
  inspecciones: Inspeccion[];
  planillas_generales?: string[];
};

function App() {
  const [currentView, setCurrentView] = useState<'dashboard' | 'agencia'>(
    () => (sessionStorage.getItem('currentView') as 'dashboard' | 'agencia') || 'dashboard'
  );

  const [theme, setTheme] = useState<'light' | 'dark'>(
    () => (localStorage.getItem('theme') as 'light' | 'dark') || 'light'
  );

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  const getPersonaAsignada = (region: string) => {
    const r = region.toLowerCase();
    if (r.includes('oriente') || r.includes('guayana')) {
      return 'Técnico B';
    }
    return 'Técnico A';
  };

  const [expandedRegions, setExpandedRegions] = useState<string[]>(() => {
    const saved = sessionStorage.getItem('activeRegion');
    return saved ? [saved] : [];
  });
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterEquipo, setFilterEquipo] = useState<string>('');
  const [activeRegion, setActiveRegion] = useState<string>(
    () => sessionStorage.getItem('activeRegion') || ''
  );
  const [activeState, setActiveState] = useState<string>(
    () => sessionStorage.getItem('activeState') || ''
  );
  const [selectedAgencia, setSelectedAgencia] = useState<Agencia | null>(null);

  useEffect(() => {
    sessionStorage.setItem('currentView', currentView);
    sessionStorage.setItem('activeRegion', activeRegion);
    sessionStorage.setItem('activeState', activeState);
    if (selectedAgencia) {
      sessionStorage.setItem('selectedAgenciaCod', selectedAgencia.cod);
    } else if (currentView === 'dashboard') {
      sessionStorage.removeItem('selectedAgenciaCod');
    }
  }, [currentView, activeRegion, activeState, selectedAgencia]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // State from Supabase
  const [localAgenciasData, setLocalAgenciasData] = useState<Agencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: regionesEstados, error: reErr } = await supabase.from('regiones_estados').select('*');
      const { data: agenciasDB, error: agErr } = await supabase.from('agencias').select('*');
      const { data: equiposDB, error: eqErr } = await supabase.from('equipos_ups').select('*');
      const { data: mantenimientosDB, error: mttoErr } = await supabase.from('historico_mantenimientos').select('*');
      const { data: fotosDB, error: fotoErr } = await supabase.from('registro_fotografico').select('*');

      if (reErr || agErr || eqErr || mttoErr || fotoErr || !agenciasDB) {
        throw new Error("Supabase request failed or returned null");
      }

      let planillasMap: Record<string, string[]> = {};
      try {
        const res = await fetch('/planillas_map.json?t=' + new Date().getTime());
        if (res.ok) {
          planillasMap = await res.json();
        }
      } catch (e) {
        console.error("No se pudo cargar el mapa de planillas", e);
      }

      const formattedData: Agencia[] = agenciasDB.map(ag => {
        const regionEstado = regionesEstados?.find(r => r.id === ag.estado_id);
        const equiposAgencia = equiposDB?.filter(e => e.agencia_id === ag.id) || [];
        
        const equiposIds = equiposAgencia.map(e => e.id);
        const inspeccionesAgencia = mantenimientosDB?.filter(m => equiposIds.includes(m.equipo_id)) || [];

        let todasLasPlanillasDb: string[] = [];

        const inspeccionesFormatted = inspeccionesAgencia.map(insp => {
          const fotosInsp = fotosDB?.filter(f => f.mantenimiento_id === insp.id) || [];
          todasLasPlanillasDb.push(...fotosInsp.filter(f => f.tipo_archivo === 'planilla_pdf').map(f => f.url_imagen));
          const equipo = equiposAgencia.find(e => e.id === insp.equipo_id);
          
          let equipoStr = '';
          if (equipo) {
            const isMigratedSerial = equipo.serial && (equipo.serial.startsWith('migrated-') || equipo.serial.startsWith('fallback-'));
            equipoStr = `${equipo.marca || ''} ${equipo.modelo || ''} ${!isMigratedSerial && equipo.serial ? `SERIAL: ${equipo.serial}` : ''}`.trim();
          }

          return {
            id: insp.id,
            fecha: insp.fecha_visita === '2000-01-01' ? '2021/2022' : insp.fecha_visita,
            raw_fecha: insp.fecha_visita,
            proximo_mantenimiento: insp.fecha_visita === '2000-01-01' ? null : insp.fecha_proximo_mtto,
            estatus: insp.estatus_textual || (insp.is_operativo ? '100% OPERATIVO' : 'INOPERATIVO'),
            is_operativo: insp.is_operativo,
            observacion: insp.tipo_actividad || '', 
            equipo: equipoStr,
            equipo_id: insp.equipo_id,
            respalda: insp.respalda || '',
            equipo_desincorporado: insp.equipo_desincorporado || null,
            fotos: {
              bypass: fotosInsp.filter(f => f.tipo_archivo === 'imagen' && f.etapa === 'Bypass').map(f => f.url_imagen),
              ups: fotosInsp.filter(f => f.tipo_archivo === 'imagen' && f.etapa === 'UPS').map(f => f.url_imagen),
              otras: fotosInsp.filter(f => f.tipo_archivo === 'imagen' && (f.etapa !== 'Bypass' && f.etapa !== 'UPS')).map(f => f.url_imagen)
            },
            planillas: [] // Dejamos vacío para que no se renderice en la tabla
          };
        }).sort((a, b) => new Date(b.raw_fecha || 0).getTime() - new Date(a.raw_fecha || 0).getTime());

        const equipos_instalados_str = equiposAgencia.map(e => {
          const isMigrated = e.serial && (e.serial.startsWith('migrated-') || e.serial.startsWith('fallback-'));
          return `${e.marca || ''} ${e.modelo || ''} ${!isMigrated && e.serial ? `SERIAL: ${e.serial}` : ''}`.trim();
        });

        const equiposFisicos = equipos_instalados_str.filter(eq => {
          if (!eq || eq === 'Desconocido') return true;
          return !eq.includes('/') && !eq.includes('&') && !eq.includes(' Y ');
        });
        const totalEquipos = equiposFisicos.length;
        const totalKva = equiposAgencia.reduce((acc, eq) => {
          let cap = 0;
          if (eq.capacidad_kva) {
            const parsed = parseFloat(eq.capacidad_kva);
            if (!isNaN(parsed)) cap = parsed;
          }
          if (cap === 0 && eq.marca) {
            const match = eq.marca.match(/(\d+(?:\.\d+)?)\s*KVA/i);
            if (match) {
              const parsed = parseFloat(match[1]);
              if (!isNaN(parsed)) cap = parsed;
            }
          }
          return acc + cap;
        }, 0);

        return {
          id: ag.id,
          cod: ag.cod,
          nombre: ag.nombre,
          estado: regionEstado?.estado || 'Desconocido',
          region: regionEstado?.region || 'Desconocido',
          estatus: ag.estatus_agencia || 'Activa',
          equipos: totalEquipos,
          kva: totalKva,
          equipo_base: '',
          baterias_base: '',
          equipos_instalados: equipos_instalados_str,
          inspecciones: inspeccionesFormatted,
          planillas_generales: [...(planillasMap[ag.cod] || []), ...todasLasPlanillasDb]
        };
      });

      setLocalAgenciasData(formattedData);
      
      if (formattedData.length > 0 && expandedRegions.length === 0) {
        setExpandedRegions([formattedData[0].region]);
        setActiveRegion(formattedData[0].region);
        setActiveState(formattedData[0].estado);
      }
    } catch (error) {
      console.error("Error fetching data, using backup data.json:", error);
      const formattedBackup = backupData as Agencia[];
      setLocalAgenciasData(formattedBackup);
      
      if (formattedBackup.length > 0 && expandedRegions.length === 0) {
        setExpandedRegions([formattedBackup[0].region]);
        setActiveRegion(formattedBackup[0].region);
        setActiveState(formattedBackup[0].estado);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const savedCod = sessionStorage.getItem('selectedAgenciaCod');
    if (selectedAgencia) {
      const updated = localAgenciasData.find(a => a.id === selectedAgencia.id);
      if (updated) {
        setSelectedAgencia(updated);
      }
    } else if (savedCod && localAgenciasData.length > 0) {
      const savedAgencia = localAgenciasData.find(a => a.cod === savedCod);
      if (savedAgencia) {
        setSelectedAgencia(savedAgencia);
      }
    }
  }, [localAgenciasData, selectedAgencia?.id]);

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [isNewEquipo, setIsNewEquipo] = useState(false);
  const [newRecord, setNewRecord] = useState<Partial<Inspeccion>>({
    fecha: new Date().toISOString().split('T')[0],
    is_operativo: true,
    estatus: '100% OPERATIVO',
    observacion: '',
    equipo_desincorporado: '',
    respalda: ''
  });
  const [filesImages, setFilesImages] = useState<FileList | null>(null);
  const [filesPdfs, setFilesPdfs] = useState<FileList | null>(null);

  // Lógica de derivación de datos
  const regions = useMemo(() => Array.from(new Set(localAgenciasData.map(a => a.region))), [localAgenciasData]);
  const getStatesByRegion = (region: string) => Array.from(new Set(localAgenciasData.filter(a => a.region === region).map(a => a.estado)));
  
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return localAgenciasData.filter(a => 
      a.nombre.toLowerCase().includes(query) || 
      a.cod.includes(query) ||
      a.estado.toLowerCase().includes(query)
    );
  }, [searchQuery, localAgenciasData]);

  const agenciasEnEstado = useMemo(() => {
    return localAgenciasData.filter(a => a.region === activeRegion && a.estado === activeState);
  }, [activeRegion, activeState, localAgenciasData]);

  // Dashboard Stats
  const dashboardStats = useMemo(() => {
    const totalUPS = localAgenciasData.reduce((acc, a) => acc + (a.equipos || 0), 0);
    const totalKva = localAgenciasData.reduce((acc, a) => acc + (a.kva || 0), 0);
    const today = new Date().toISOString().split('T')[0];

    const agenciasPendientesList = localAgenciasData.filter(a => {
      const hasEquipos = (a.equipos && a.equipos > 0) || (a.equipos_instalados && a.equipos_instalados.length > 0) || a.equipo_base;
      if (!hasEquipos && (!a.inspecciones || a.inspecciones.length === 0)) return false;

      // Si no tiene inspecciones, es pendiente
      if (!a.inspecciones || a.inspecciones.length === 0) return true;
      
      const latest = a.inspecciones[0];
      
      // No aplica para UPS con fecha de 2024 o anteriores
      if (latest.fecha && latest.fecha < '2025-01-01') return false;

      // Si la visita se hizo hoy, no está retrasado
      if (latest.fecha === today) return false;

      // Si la fecha de próximo mantenimiento es anterior a hoy, está retrasado
      if (latest.proximo_mantenimiento && latest.proximo_mantenimiento < today) return true;

      return false;
    });

    // Ordenar de la visita más reciente a la más antigua
    agenciasPendientesList.sort((a, b) => {
      const dateA = a.inspecciones && a.inspecciones.length > 0 ? (a.inspecciones[0].raw_fecha || a.inspecciones[0].fecha || '') : '';
      const dateB = b.inspecciones && b.inspecciones.length > 0 ? (b.inspecciones[0].raw_fecha || b.inspecciones[0].fecha || '') : '';
      
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1; // Agencias sin visita al final
      if (!dateB) return -1;
      
      return dateB.localeCompare(dateA); // Descendente (más reciente primero)
    });

    const agenciasTotal = localAgenciasData.length;
    const agenciasAtendidas = agenciasTotal - agenciasPendientesList.length;
    const progresoMtto = agenciasTotal === 0 ? 0 : Math.round((agenciasAtendidas / agenciasTotal) * 100);
    
    // Proximos Mantenimientos (closest future dates)
    const allInspections = localAgenciasData.flatMap(a => 
      (a.inspecciones || []).map(i => ({ ...i, agenciaCod: a.cod, agenciaNombre: a.nombre }))
    );
    const proximos = allInspections
      .filter(i => i.proximo_mantenimiento && i.proximo_mantenimiento >= today)
      .sort((a, b) => a.proximo_mantenimiento!.localeCompare(b.proximo_mantenimiento!))
      .slice(0, 5);

    return { totalUPS, totalKva, agenciasAtendidas, agenciasTotal, progresoMtto, proximos, agenciasPendientesList };
  }, [localAgenciasData]);

  // Cuando cambia la agencia seleccionada, reseteamos los filtros
  useEffect(() => {
    setFilterDate('');
    setFilterEquipo('');
  }, [selectedAgencia]);

  const toggleRegion = (region: string) => {
    setExpandedRegions(prev => 
      prev.includes(region) ? prev.filter(r => r !== region) : [...prev, region]
    );
  };

  // Handlers
  const handleSelectAgencia = (agencia: Agencia) => {
    const updatedAgencia = localAgenciasData.find(a => a.cod === agencia.cod) || agencia;
    setSelectedAgencia(updatedAgencia);
    setActiveRegion(updatedAgencia.region);
    setActiveState(updatedAgencia.estado);
    setSearchQuery(''); 
    setCurrentView('agencia');
  };

  const handleStateClick = (estado: string, region: string) => {
    setActiveState(estado);
    const firstAgencia = localAgenciasData.find(a => a.region === region && a.estado === estado);
    if (firstAgencia) {
      handleSelectAgencia(firstAgencia);
    }
  };

  const existingEquipos = useMemo(() => {
    if (!selectedAgencia) return [];
    const fromInstalados = selectedAgencia.equipos_instalados || [];
    const fromInspecciones = (selectedAgencia.inspecciones || []).map(i => i.equipo).filter(Boolean) as string[];
    return Array.from(new Set([...fromInstalados, ...fromInspecciones, selectedAgencia.equipo_base].filter(Boolean)));
  }, [selectedAgencia]);

  const uploadFile = async (file: File) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const { error } = await supabase.storage.from('evidencias').upload(`mantenimientos/${fileName}`, file);
    if (error) {
      console.error("Error uploading file:", error);
      alert("Error al subir el archivo a Supabase: Violación de política de seguridad (RLS). Por favor, asegúrate de haber habilitado los permisos de INSERT (Allow anonymous uploads) en el bucket 'evidencias' desde tu panel de Supabase.");
      return null;
    }
    const { data: publicUrlData } = supabase.storage.from('evidencias').getPublicUrl(`mantenimientos/${fileName}`);
    return publicUrlData.publicUrl;
  };

  const handleSaveRecord = async () => {
    if (!selectedAgencia || !selectedAgencia.id) return;
    setSaving(true);

    try {
      let equipoId = null;

      if (isNewEquipo && newRecord.equipo) {
        // Normalizar texto para evitar duplicados futuros
        let normalizedEquipo = newRecord.equipo.toUpperCase().trim()
          .replace(/SERIAL:\s*/g, 'SERIAL:')
          .replace(/DE\s+/g, '')
          .replace(/\s+/g, ' ')
          .replace(/(\d+)\s+KVA/g, '$1KVA');
          
        const { data: newEq, error: eqErr } = await supabase.from('equipos_ups').insert({
          agencia_id: selectedAgencia.id,
          marca: normalizedEquipo,
          serial: `NEW-${Date.now()}`
        }).select().single();
        if (eqErr) throw eqErr;
        equipoId = newEq.id;
      } else {
        // En un esquema ideal, el <select> debería guardar el ID. 
        // Como guardamos string en newRecord.equipo, buscamos el equipo matching.
        // Haremos una busqueda por marca+modelo+serial.
        const { data: eqDB } = await supabase.from('equipos_ups').select('id, marca, modelo, serial').eq('agencia_id', selectedAgencia.id);
        const match = eqDB?.find(e => {
          const isMigrated = e.serial && (e.serial.startsWith('migrated-') || e.serial.startsWith('fallback-'));
          const equipoStr = `${e.marca || ''} ${e.modelo || ''} ${!isMigrated && e.serial ? `SERIAL: ${e.serial}` : ''}`.trim();
          return equipoStr === newRecord.equipo;
        });
        if (match) equipoId = match.id;
        
        // Fallback: Si no lo encontramos, creamos uno nuevo con el string
        if (!equipoId) {
          const { data: newEqFallback } = await supabase.from('equipos_ups').insert({
            agencia_id: selectedAgencia.id,
            marca: newRecord.equipo || 'Equipo Desconocido'
          }).select().single();
          if (newEqFallback) equipoId = newEqFallback.id;
        }
      }

      // Insertar o Actualizar Mantenimiento
      let mtto = null;

      if (newRecord.id) {
        const { data: updatedMtto, error: mttoErr } = await supabase.from('historico_mantenimientos').update({
          equipo_id: equipoId,
          fecha_visita: newRecord.fecha || new Date().toISOString().split('T')[0],
          tipo_actividad: newRecord.observacion || '',
          estatus_textual: newRecord.estatus || '',
          is_operativo: newRecord.is_operativo !== false,
          equipo_desincorporado: newRecord.equipo_desincorporado || null,
          respalda: newRecord.respalda || ''
        }).eq('id', newRecord.id).select().single();
        if (mttoErr) throw mttoErr;
        mtto = updatedMtto;
      } else {
        const { data: insertedMtto, error: mttoErr } = await supabase.from('historico_mantenimientos').insert({
          equipo_id: equipoId,
          fecha_visita: newRecord.fecha || new Date().toISOString().split('T')[0],
          tipo_actividad: newRecord.observacion || '',
          estatus_textual: newRecord.estatus || '',
          is_operativo: newRecord.is_operativo !== false,
          equipo_desincorporado: newRecord.equipo_desincorporado || null,
          respalda: newRecord.respalda || ''
        }).select().single();
        if (mttoErr) throw mttoErr;
        mtto = insertedMtto;
      }

      // Subir e Insertar Fotos
      if (filesImages && filesImages.length > 0) {
        for (let i = 0; i < filesImages.length; i++) {
          const file = filesImages[i];
          const url = await uploadFile(file);
          if (url) {
            await supabase.from('registro_fotografico').insert({
              mantenimiento_id: mtto.id,
              url_imagen: url,
              etapa: 'Otros',
              tipo_archivo: 'imagen'
            });
          }
        }
      }

      // Subir e Insertar PDFs
      if (filesPdfs && filesPdfs.length > 0) {
        for (let i = 0; i < filesPdfs.length; i++) {
          const file = filesPdfs[i];
          const url = await uploadFile(file);
          if (url) {
            await supabase.from('registro_fotografico').insert({
              mantenimiento_id: mtto.id,
              url_imagen: url,
              etapa: 'Planilla',
              tipo_archivo: 'planilla_pdf'
            });
          }
        }
      }

      // Refresh Data
      await fetchData();
      
      // Update selectedAgencia reference
      // For simplicity, fetchData updates localAgenciasData and we rely on the user to re-click or we just let it be.
      // But we can just close the modal.
      setShowAddModal(false);
      
      setNewRecord({
        fecha: new Date().toISOString().split('T')[0],
        is_operativo: true,
        estatus: '100% OPERATIVO',
        observacion: '',
        equipo_desincorporado: '',
        respalda: ''
      });
      setIsNewEquipo(false);
      setFilesImages(null);
      setFilesPdfs(null);

    } catch (error) {
      console.error("Error guardando registro:", error);
      alert("Hubo un error al guardar el registro. Revisa la consola.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRecord = async (insp: Inspeccion) => {
    if (window.confirm('¿Está seguro de que desea eliminar este registro? Esta acción no se puede deshacer.')) {
      try {
        setLoading(true);
        
        // Delete the inspection record
        const { error: errorInsp } = await supabase.from('historico_mantenimientos').delete().eq('id', insp.id);
        if (errorInsp) throw errorInsp;

        // If this inspection belonged to a specific equipment, check if it was the only inspection
        if (insp.equipo_id) {
          const { data: otherInsps } = await supabase.from('historico_mantenimientos').select('id').eq('equipo_id', insp.equipo_id);
          // If no other inspections remain for this equipment, delete the equipment to prevent ghost assets
          if (!otherInsps || otherInsps.length === 0) {
            await supabase.from('equipos_ups').delete().eq('id', insp.equipo_id);
          }
        }

        await fetchData();
      } catch (error) {
        console.error("Error al eliminar el registro:", error);
        alert("Hubo un error al eliminar el registro.");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleEditClick = (insp: Inspeccion) => {
    setNewRecord({
      id: insp.id,
      fecha: insp.fecha,
      equipo: insp.equipo,
      equipo_desincorporado: insp.equipo_desincorporado || '',
      respalda: insp.respalda || '',
      estatus: insp.estatus,
      is_operativo: insp.is_operativo,
      observacion: insp.observacion
    });
    setIsNewEquipo(false);
    setFilesImages(null);
    setFilesPdfs(null);
    setShowAddModal(true);
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '1rem' }}>
          <div className="brand" style={{ cursor: 'pointer', paddingRight: 0 }} onClick={() => setCurrentView('dashboard')}>
            <Zap className="brand-icon" size={28} />
            <span>UPS Control</span>
          </div>
          <button 
            onClick={toggleTheme} 
            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex' }}
            title={theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
          >
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>
        </div>

        <div className="search-container">
          <Search className="search-icon" size={18} />
          <input 
            type="text" 
            className="search-input" 
            placeholder="Buscar agencia o COD..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="nav-menu">
          <div 
            className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`}
            onClick={() => setCurrentView('dashboard')}
            style={{ marginBottom: '1rem', fontWeight: 600 }}
          >
            <BarChart3 size={18} /> Dashboard General
          </div>

          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem', paddingLeft: '0.5rem' }}>
            Regiones y Agencias
          </div>

          {searchQuery ? (
            <div className="search-results">
              {searchResults.length > 0 ? searchResults.map(agencia => (
                <div 
                  key={agencia.cod}
                  className="nav-item search-item"
                  onClick={() => handleSelectAgencia(agencia)}
                  style={{ cursor: 'pointer', padding: '0.5rem', borderRadius: '4px', background: 'var(--input-bg)', marginBottom: '0.25rem' }}
                >
                  <div style={{ fontWeight: 500 }}>{agencia.nombre}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    COD: {agencia.cod} • {agencia.estado}
                  </div>
                </div>
              )) : (
                <p className="text-secondary" style={{ padding: '0.5rem' }}>No se encontraron agencias.</p>
              )}
            </div>
          ) : (
            // Árbol de Regiones y Estados
            <div className="regions-tree">
              {regions.map(region => (
                <div key={region} className="nav-region-group">
                  <div 
                    className={`nav-item ${expandedRegions.includes(region) ? 'active' : ''}`}
                    onClick={() => toggleRegion(region)}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <span>{region}</span>
                    {expandedRegions.includes(region) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </div>
                  
                  {/* Submenú de Estados y Agencias */}
                  {expandedRegions.includes(region) && (
                    <div className="nav-states" style={{ paddingLeft: '0.5rem', marginTop: '0.25rem' }}>
                      {getStatesByRegion(region).map(estado => (
                        <div key={estado} className="state-group" style={{ marginBottom: '0.5rem' }}>
                          <div 
                            className={`nav-item state-item ${activeState === estado ? 'active-state' : ''}`}
                            onClick={() => handleStateClick(estado, region)}
                            style={{ fontSize: '0.9rem', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: activeState === estado ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                          >
                            <MapPin size={14} /> {estado}
                          </div>
                          
                          {/* Lista de agencias si el estado está activo */}
                          {activeState === estado && (
                            <div className="agencias-list" style={{ paddingLeft: '1.5rem', marginTop: '0.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                               {agenciasEnEstado.map(agencia => (
                                  <div 
                                    key={agencia.cod}
                                    className={`nav-item agencia-item ${selectedAgencia?.cod === agencia.cod && currentView === 'agencia' ? 'active-agencia' : ''}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSelectAgencia(agencia);
                                    }}
                                    style={{ 
                                      fontSize: '0.85rem', 
                                      padding: '0.4rem 0.75rem',
                                      background: selectedAgencia?.cod === agencia.cod && currentView === 'agencia' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                                      color: selectedAgencia?.cod === agencia.cod && currentView === 'agencia' ? 'var(--accent-color)' : 'var(--text-secondary)'
                                    }}
                                  >
                                    COD {agencia.cod} - {agencia.nombre.replace('Agencia ', '').replace('Sucursal ', '')}
                                  </div>
                               ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', flexDirection: 'column', gap: '1rem' }}>
            <div className="spinner" style={{ border: '4px solid rgba(255,255,255,0.1)', borderTop: '4px solid var(--accent-color)', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite' }}></div>
            <p className="text-secondary">Conectando con Supabase y cargando datos...</p>
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          </div>
        ) : currentView === 'dashboard' && (
          <div className="dashboard-view">
            <header className="header mb-4">
              <div>
                <h1>Dashboard de Control y Análisis</h1>
                <p className="text-secondary">Visión general del estado de la red de UPS</p>
              </div>
            </header>

            <div className="dashboard-grid mb-4">
              <div className="card glass-panel">
                <div className="card-title">
                  <Activity size={20} className="text-accent" /> Total UPS Activos
                </div>
                <div className="card-value">{dashboardStats.totalUPS}</div>
                <p className="text-secondary">En {dashboardStats.agenciasTotal} agencias registradas</p>
              </div>

              <div className="card glass-panel">
                <div className="card-title">
                  <Battery size={20} className="text-success" /> Capacidad Respaldada
                </div>
                <div className="card-value">{dashboardStats.totalKva.toLocaleString()} KVA</div>
                <p className="text-secondary">Suma total de capacidad instalada</p>
              </div>

              <div className="card glass-panel">
                <div className="card-title">
                  <Calendar size={20} className="text-warning" /> Progreso de Mantenimientos
                </div>
                <div className="progress-container mt-4">
                  <div className="progress-header">
                    <span>Agencias Atendidas</span>
                    <span>{dashboardStats.agenciasAtendidas} / {dashboardStats.agenciasTotal}</span>
                  </div>
                  <div className="progress-bar-bg">
                    <div className="progress-bar-fill" style={{ width: `${dashboardStats.progresoMtto}%` }}></div>
                  </div>
                  <div className="text-secondary mt-4" style={{ fontSize: '0.85rem' }}>
                    {dashboardStats.progresoMtto}% de cobertura
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
              <div className="card glass-panel" style={{ margin: 0 }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Calendar className="text-warning" /> Próximos Mantenimientos
                </h2>
                {dashboardStats.proximos.length > 0 ? (
                  <div className="table-container">
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)' }}>
                          <th style={{ padding: '1rem', fontWeight: '500', whiteSpace: 'nowrap', width: '100px' }}>Fecha Prog.</th>
                          <th style={{ padding: '1rem', fontWeight: '500' }}>Agencia</th>
                          <th style={{ padding: '1rem', fontWeight: '500' }}>Equipo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboardStats.proximos.map((mtto, idx) => {
                          let fDate = formatDate(mtto.proximo_mantenimiento);
                          return (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                              <td style={{ padding: '1rem', fontWeight: '500', color: 'var(--warning-color)', whiteSpace: 'nowrap' }}>{fDate}</td>
                              <td style={{ padding: '1rem' }}>{mtto.agenciaNombre} (COD: {mtto.agenciaCod})</td>
                              <td style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{mtto.equipo || 'N/D'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-secondary">No hay mantenimientos futuros programados a la vista.</p>
                )}
              </div>

              <div className="card glass-panel" style={{ margin: 0 }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertTriangle className="text-danger" /> Agencias Pendientes ({dashboardStats.agenciasPendientesList.length})
                </h2>
                {dashboardStats.agenciasPendientesList.length > 0 ? (
                  <div style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '0.5rem' }} className="custom-scrollbar">
                    {dashboardStats.agenciasPendientesList.map((a: Agencia) => {
                      const ultMnto = a.inspecciones && a.inspecciones.length > 0 ? formatDate(a.inspecciones[0].fecha) : 'Sin registros';
                      return (
                        <div key={a.cod} style={{ 
                          background: 'var(--input-bg)', 
                          padding: '1rem', 
                          borderRadius: '8px', 
                          marginBottom: '0.75rem',
                          borderLeft: '4px solid var(--danger-color)'
                        }}>
                          <div style={{ fontWeight: 500, fontSize: '0.95rem', marginBottom: '0.25rem' }}>
                            COD: {a.cod} - {a.nombre}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            <div>
                              Última visita: <span style={{ color: ultMnto === 'Sin registros' ? 'var(--warning-color)' : 'var(--text-primary)', fontWeight: 500 }}>{ultMnto}</span>
                            </div>
                            {a.inspecciones && a.inspecciones.length > 0 && a.inspecciones[0].proximo_mantenimiento && (
                              <div>
                                Visita correspondiente: <span style={{ color: 'var(--danger-color)', fontWeight: 600 }}>{formatDate(a.inspecciones[0].proximo_mantenimiento)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-success" style={{ fontWeight: 500 }}>¡Excelente! No hay agencias pendientes por atender.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {currentView === 'agencia' && selectedAgencia && (
          <>
            <header className="header">
              <div>
                <p className="text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {selectedAgencia.region} <ChevronRight size={14} /> {selectedAgencia.estado}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <h1 style={{ margin: 0 }}>{selectedAgencia.nombre} (COD: {selectedAgencia.cod})</h1>
                  <span style={{ 
                    display: 'flex', alignItems: 'center', gap: '0.35rem', 
                    fontSize: '0.75rem', fontWeight: 600, 
                    background: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent-color)', 
                    padding: '0.25rem 0.75rem', borderRadius: '99px', border: '1px solid rgba(59, 130, 246, 0.3)'
                  }} title="Personal encargado de esta sucursal">
                    <User size={14} /> Asignado: {getPersonaAsignada(selectedAgencia.region)}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <div className="glass-panel" style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className={selectedAgencia.estatus === 'Activa' ? "text-success" : "text-warning"} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}>
                    <CheckCircle2 size={16} /> {selectedAgencia.estatus}
                  </span>
                </div>
                <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
                  <Plus size={18} /> Nuevo Registro
                </button>
              </div>
            </header>

            {/* Top KPIs Grid */}
            <div className="dashboard-grid">
              <div className="card glass-panel">
                <div className="card-title">
                  <Activity size={20} /> Equipos Activos
                </div>
                <div className="card-value text-accent">{selectedAgencia.equipos ?? 0} UPS</div>
                <p className="text-secondary">Capacidad Total: {selectedAgencia.kva} KVA</p>
              </div>

              <div className="card glass-panel">
                <div className="card-title">
                  <Activity size={20} /> Última Visita
                </div>
                {selectedAgencia.inspecciones && selectedAgencia.inspecciones.length > 0 ? (
                  <>
                    <div className="card-value text-accent">{formatDate(selectedAgencia.inspecciones[0].fecha) || 'N/D'}</div>
                    <p className="text-secondary">Registro más reciente</p>
                  </>
                ) : (
                  <>
                    <div className="card-value text-secondary">N/D</div>
                    <p className="text-secondary">Sin historial</p>
                  </>
                )}
              </div>

              <div className="card glass-panel">
                <div className="card-title">
                  <Calendar size={20} /> Próximo Mantenimiento
                </div>
                {selectedAgencia.inspecciones && selectedAgencia.inspecciones.length > 0 && selectedAgencia.inspecciones[0].proximo_mantenimiento ? (
                  <>
                    <div className="card-value text-warning">{selectedAgencia.inspecciones[0].proximo_mantenimiento}</div>
                    <p className="text-secondary">Según última intervención</p>
                  </>
                ) : (
                  <>
                    <div className="card-value text-secondary">N/D</div>
                    <p className="text-secondary">Sin historial reciente</p>
                  </>
                )}
              </div>

              <div className="card glass-panel">
                <div className="card-title">
                  <AlertTriangle size={20} /> Incidencias
                </div>
                <div className="card-value">0</div>
                <p className="text-secondary text-success">Sin reportes activos</p>
              </div>
            </div>



            {/* Unified Table Section */}
            <div className="card glass-panel" style={{ marginTop: '1.5rem', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '600' }}>Registros de Inspección y Activos</h2>
                
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  {/* Date Filter Dropdown */}
                  {selectedAgencia.inspecciones && selectedAgencia.inspecciones.length > 0 && (
                    <select 
                      value={filterDate} 
                      onChange={(e) => setFilterDate(e.target.value)}
                      className="form-control"
                      style={{ padding: '0.5rem 1rem', width: 'auto' }}
                    >
                      <option value="">Todas las fechas</option>
                      {[...new Set(selectedAgencia.inspecciones.map(i => i.fecha).filter(Boolean))].map((f, idx) => (
                        <option key={idx} value={f!}>{formatDate(f)}</option>
                      ))}
                    </select>
                  )}

                  {/* Equipo Filter Dropdown */}
                  {selectedAgencia.inspecciones && selectedAgencia.inspecciones.length > 0 && (
                    <select 
                      value={filterEquipo} 
                      onChange={(e) => setFilterEquipo(e.target.value)}
                      className="form-control"
                      style={{ padding: '0.5rem 1rem', width: 'auto' }}
                    >
                      <option value="">Todos los equipos</option>
                      {[...new Set(selectedAgencia.inspecciones.map(i => i.equipo).filter(Boolean))].map((eq, idx) => (
                        <option key={idx} value={eq!}>{eq}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div className="table-container">
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '1100px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '1rem', fontWeight: '500', minWidth: '130px' }}>Fecha</th>
                      <th style={{ padding: '1rem', fontWeight: '500', minWidth: '220px' }}>Equipo / Serial</th>
                      <th style={{ padding: '1rem', fontWeight: '500', width: '20%', minWidth: '200px' }}>Respalda</th>
                      <th style={{ padding: '1rem', fontWeight: '500', minWidth: '90px', width: '100px' }}>Equipo Desincorporado</th>
                      <th style={{ padding: '1rem', fontWeight: '500', minWidth: '150px' }}>Estatus</th>
                      <th style={{ padding: '1rem', fontWeight: '500', width: '25%', minWidth: '250px' }}>Observaciones</th>
                      <th style={{ padding: '1rem', fontWeight: '500', minWidth: '120px' }}>Adjuntos</th>
                      <th style={{ padding: '1rem', fontWeight: '500', minWidth: '100px' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedAgencia.inspecciones && selectedAgencia.inspecciones.length > 0 ? (
                      selectedAgencia.inspecciones
                        .filter(insp => filterDate === '' || insp.fecha === filterDate)
                        .filter(insp => filterEquipo === '' || insp.equipo === filterEquipo)
                        .map((insp, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                          <td style={{ padding: '1rem', verticalAlign: 'top' }}>
                            <span style={{ fontWeight: '500' }}>{formatDate(insp.fecha) || 'N/D'}</span>
                            {insp.proximo_mantenimiento && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                                Próx: {formatDate(insp.proximo_mantenimiento)}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '1rem', verticalAlign: 'top', fontSize: '0.9rem' }}>
                            {insp.equipo || selectedAgencia.equipo_base || 'N/D'}
                          </td>
                          <td style={{ padding: '1rem', verticalAlign: 'top', fontSize: '0.9rem' }}>
                            {insp.respalda || 'N/D'}
                          </td>
                          <td style={{ padding: '1rem', verticalAlign: 'top', fontSize: '0.9rem', color: 'var(--danger-color)' }}>
                            {insp.equipo_desincorporado ? insp.equipo_desincorporado : <span style={{color: 'var(--text-secondary)'}}>-</span>}
                          </td>
                          <td style={{ padding: '1rem', verticalAlign: 'top' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '500', fontSize: '0.9rem' }}>
                              {insp.is_operativo ? <CheckCircle2 size={16} className="text-success" /> : <AlertTriangle size={16} className="text-warning" />}
                              {insp.estatus}
                            </div>
                          </td>
                          <td style={{ padding: '1rem', verticalAlign: 'top', fontSize: '0.85rem', whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>
                            {insp.observacion || 'Sin observaciones.'}
                          </td>
                          <td style={{ padding: '1rem', verticalAlign: 'top' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                              {/* Rendering Photos */}
                              {insp.fotos && (insp.fotos.bypass?.length || 0 > 0 || insp.fotos.ups?.length || 0 > 0 || insp.fotos.otras?.length || 0 > 0) && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                  {(insp.fotos.bypass?.length || 0) > 0 && (
                                    <div>
                                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Bypass</span>
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                        {insp.fotos.bypass!.map((foto: string, fidx: number) => (
                                          <a href={foto} target="_blank" rel="noreferrer" key={`bp-${fidx}`}>
                                            <div className="glass-panel" 
                                                 style={{ backgroundImage: `url("${foto}")`, backgroundSize: 'cover', backgroundPosition: 'center', width: '45px', height: '35px', borderRadius: '4px', border: '1px solid var(--glass-border)' }}
                                                 title="Ver Bypass">
                                            </div>
                                          </a>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {(insp.fotos.ups?.length || 0) > 0 && (
                                    <div>
                                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>UPS</span>
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                        {insp.fotos.ups!.map((foto: string, fidx: number) => (
                                          <a href={foto} target="_blank" rel="noreferrer" key={`ups-${fidx}`}>
                                            <div className="glass-panel" 
                                                 style={{ backgroundImage: `url("${foto}")`, backgroundSize: 'cover', backgroundPosition: 'center', width: '45px', height: '35px', borderRadius: '4px', border: '1px solid var(--glass-border)' }}
                                                 title="Ver UPS">
                                            </div>
                                          </a>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {(insp.fotos.otras?.length || 0) > 0 && (
                                    <div>
                                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Otras (Baterías/Tablero)</span>
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                        {insp.fotos.otras!.map((foto: string, fidx: number) => (
                                          <a href={foto} target="_blank" rel="noreferrer" key={`otras-${fidx}`}>
                                            <div className="glass-panel" 
                                                 style={{ backgroundImage: `url("${foto}")`, backgroundSize: 'cover', backgroundPosition: 'center', width: '45px', height: '35px', borderRadius: '4px', border: '1px solid var(--glass-border)' }}
                                                 title="Ver Otras Fotos">
                                            </div>
                                          </a>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                              
                              {/* Rendering Planillas */}
                              {insp.planillas && insp.planillas.length > 0 && (
                                <div>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Planillas</span>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    {insp.planillas.map((planilla: string, pidx: number) => (
                                      <a href={planilla} target="_blank" rel="noreferrer" key={pidx} style={{ textDecoration: 'none' }}>
                                        <div className="glass-panel" 
                                             style={{ padding: '0.25rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem', borderRadius: '4px', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', fontSize: '0.8rem' }}>
                                          📄 PDF
                                        </div>
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {(!insp.fotos || Object.keys(insp.fotos).length === 0 || (!insp.fotos.bypass?.length && !insp.fotos.ups?.length && !insp.fotos.otras?.length)) && (!insp.planillas || insp.planillas.length === 0) && (
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Sin adjuntos</span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '1rem', verticalAlign: 'top' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                              <button 
                                onClick={() => handleEditClick(insp)}
                                style={{ background: 'transparent', border: 'none', color: 'var(--accent-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}
                                title="Editar Registro"
                              >
                                <Edit2 size={14} /> Editar
                              </button>
                              <button 
                                onClick={() => handleDeleteRecord(insp)}
                                style={{ background: 'transparent', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}
                                title="Eliminar Registro"
                              >
                                <Trash2 size={14} /> Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                          No hay historial registrado para esta agencia.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Documentación General Section */}
            {selectedAgencia.planillas_generales && selectedAgencia.planillas_generales.length > 0 && (
              <div className="card glass-panel" style={{ marginTop: '1.5rem', marginBottom: '2rem', flexShrink: 0 }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  📄 Documentación General de la Agencia
                </h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                  {selectedAgencia.planillas_generales.map((planilla, idx) => (
                    <a href={planilla} target="_blank" rel="noreferrer" key={idx} style={{ textDecoration: 'none' }}>
                      <div className="glass-panel" 
                           style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '6px', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', fontSize: '0.9rem', transition: 'all 0.2s', background: 'rgba(255,255,255,0.05)' }}
                           title="Ver / Descargar Planilla">
                        📄 {planilla.split('/').pop()}
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Modal Agregar Registro */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{newRecord.id ? 'Editar Registro de Inspección' : 'Nuevo Registro de Inspección'}</h2>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label>Fecha de Inspección</label>
                <input 
                  type="date" 
                  className="form-control" 
                  value={newRecord.fecha || ''} 
                  onChange={(e) => setNewRecord({...newRecord, fecha: e.target.value})} 
                />
              </div>

              <div className="form-group">
                <label>Equipo / Serial Instalado</label>
                
                {!isNewEquipo && existingEquipos.length > 0 ? (
                  <select 
                    className="form-control"
                    value={newRecord.equipo || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'NUEVO') {
                        setIsNewEquipo(true);
                        setNewRecord({...newRecord, equipo: ''});
                      } else {
                        setNewRecord({...newRecord, equipo: val});
                      }
                    }}
                  >
                    <option value="">-- Seleccione un equipo existente --</option>
                    {existingEquipos.map((eq, idx) => (
                      <option key={idx} value={eq}>{eq}</option>
                    ))}
                    <option value="NUEVO">+ Registrar un equipo nuevo...</option>
                  </select>
                ) : null}

                {(isNewEquipo || existingEquipos.length === 0) && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: existingEquipos.length > 0 ? '0.5rem' : '0' }}>
                    <input 
                      type="text" 
                      className="form-control" 
                      style={{ flex: 1 }}
                      placeholder="Ej: UPS EATON 6KVA MODELO: 9PX6000K..."
                      value={newRecord.equipo || ''} 
                      onChange={(e) => setNewRecord({...newRecord, equipo: e.target.value})} 
                    />
                    {existingEquipos.length > 0 && (
                      <button className="btn btn-outline" onClick={() => {
                        setIsNewEquipo(false);
                        setNewRecord({...newRecord, equipo: ''});
                      }}>Cancelar</button>
                    )}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>Equipo Desincorporado (Opcional)</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Serial/Modelo del equipo retirado si aplica..."
                  value={newRecord.equipo_desincorporado || ''} 
                  onChange={(e) => setNewRecord({...newRecord, equipo_desincorporado: e.target.value})} 
                />
              </div>

              <div className="form-group">
                <label>Áreas que Respalda</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Ej: 1 RACK DE COMUNICACIONES, 3 TAQUILLAS..."
                  value={newRecord.respalda || ''} 
                  onChange={(e) => setNewRecord({...newRecord, respalda: e.target.value})} 
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Estatus Textual</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Ej: 100% OPERATIVO"
                    value={newRecord.estatus || ''} 
                    onChange={(e) => setNewRecord({...newRecord, estatus: e.target.value})} 
                  />
                </div>
                <div className="form-group">
                  <label>¿Se encuentra Operativo?</label>
                  <select 
                    className="form-control"
                    value={newRecord.is_operativo ? "true" : "false"}
                    onChange={(e) => setNewRecord({...newRecord, is_operativo: e.target.value === "true"})}
                  >
                    <option value="true">Sí (Operativo)</option>
                    <option value="false">No (Falla/Inoperativo)</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Observaciones de la Visita</label>
                <textarea 
                  className="form-control" 
                  rows={4}
                  placeholder="Detalles del mantenimiento, cambios realizados..."
                  value={newRecord.observacion || ''}
                  onChange={(e) => setNewRecord({...newRecord, observacion: e.target.value})}
                ></textarea>
              </div>

              <div className="form-group">
                <label>Evidencias Fotográficas (Fotos .jpg, .png)</label>
                <input type="file" multiple accept="image/*" className="form-control" style={{ padding: '0.5rem' }} onChange={(e) => setFilesImages(e.target.files)} />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Seleccione las imágenes del UPS y Bypass.</span>
              </div>

              <div className="form-group">
                <label>Planillas Firmadas (PDF)</label>
                <input type="file" multiple accept=".pdf" className="form-control" style={{ padding: '0.5rem' }} onChange={(e) => setFilesPdfs(e.target.files)} />
              </div>

            </div>

            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowAddModal(false)} disabled={saving}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSaveRecord} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar Registro'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
