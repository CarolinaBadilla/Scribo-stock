// src/services/supabase.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Agregar logs para debug
console.log('Supabase URL:', supabaseUrl ? '✅ Configurada' : '❌ Faltante');
console.log('Supabase Key:', supabaseAnonKey ? '✅ Configurada' : '❌ Faltante');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Faltan las variables de entorno de Supabase');
  console.error('VITE_SUPABASE_URL:', supabaseUrl);
  console.error('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey);
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');