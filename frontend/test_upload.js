import { createClient } from '@supabase/supabase-js';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://lvgdhtajxrtrbrsgvgcy.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2Z2RodGFqeHJ0cmJyc2d2Z2N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MTE4NTYsImV4cCI6MjA5OTE4Nzg1Nn0.TT_GLtM2fSS_MSPaoiRCRRWoOX3GwokfznAcchnTwGA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testUpload() {
  const fakeFile = new Blob(['hello world'], { type: 'text/plain' });
  const fileName = `test_${Date.now()}.txt`;
  
  console.log("Intentando subir archivo...");
  const { data, error } = await supabase.storage.from('evidencias').upload(`mantenimientos/${fileName}`, fakeFile);
  
  if (error) {
    console.error("Error al subir:", error);
  } else {
    console.log("Subida exitosa:", data);
  }
}

testUpload();
