import { supabase } from './supabase';

// ─── VEHICLES ─────────────────────────────────────────────────────────────────
export const fetchVehicles = async () => {
  const { data, error } = await supabase
    .from('vehicles').select('*').order('position', { ascending: true });
  if (error) throw error;
  return data;
};

export const insertVehicle = async (vehicle) => {
  const { data, error } = await supabase
    .from('vehicles').upsert(vehicle, { onConflict: 'id', ignoreDuplicates: true })
    .select().single();
  if (error) throw error;
  return data;
};

export const updateVehicle = async (id, updates) => {
  const { error } = await supabase.from('vehicles').update(updates).eq('id', id);
  if (error) throw error;
};

export const deleteVehicle = async (id) => {
  const { error } = await supabase.from('vehicles').delete().eq('id', id);
  if (error) throw error;
};

// ─── ROUTES ───────────────────────────────────────────────────────────────────
export const fetchRoutes = async () => {
  const { data, error } = await supabase
    .from('routes').select('*')
    .order('departure_date', { ascending: true })
    .order('departure_time', { ascending: true });
  if (error) throw error;
  return data;
};

export const insertRoute = async (route) => {
  const { data, error } = await supabase
    .from('routes').insert(route).select().single();
  if (error) throw error;
  return data;
};

export const updateRoute = async (id, updates) => {
  const { data, error } = await supabase
    .from('routes').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
};

export const deleteRoute = async (id) => {
  const { error } = await supabase.from('routes').delete().eq('id', id);
  if (error) throw error;
};

export const deleteRoutesForVehicle = async (vehicleId) => {
  const { error } = await supabase.from('routes').delete().eq('vehicle_id', vehicleId);
  if (error) throw error;
};

// ─── DAY NOTES ────────────────────────────────────────────────────────────────
export const fetchDayNotes = async () => {
  const { data, error } = await supabase.from('day_notes').select('*');
  if (error) throw error;
  return Object.fromEntries(data.map(r => [r.id, { notes: r.notes, tags: r.tags || [] }]));
};

export const upsertDayNote = async (vehicleId, dateStr, notes, tags) => {
  const id = `${vehicleId}_${dateStr}`;
  const { error } = await supabase.from('day_notes').upsert({
    id, vehicle_id: vehicleId, date_str: dateStr,
    notes, tags, updated_at: new Date().toISOString(),
  });
  if (error) throw error;
};

export const deleteDayNotesForVehicle = async (vehicleId) => {
  const { error } = await supabase.from('day_notes').delete().eq('vehicle_id', vehicleId);
  if (error) throw error;
};

// ─── TAGS ─────────────────────────────────────────────────────────────────────
export const fetchTags = async () => {
  const { data, error } = await supabase
    .from('tags').select('*').order('position', { ascending: true });
  if (error) throw error;
  return data;
};

export const insertTag = async (tag) => {
  const { error } = await supabase
    .from('tags').upsert(tag, { onConflict: 'id', ignoreDuplicates: true });
  if (error) throw error;
};

export const deleteTag = async (id) => {
  const { error } = await supabase.from('tags').delete().eq('id', id);
  if (error) throw error;
};

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
export const fetchSetting = async (key) => {
  const { data } = await supabase.from('settings').select('value').eq('key', key).single();
  return data?.value ?? null;
};

export const upsertSetting = async (key, value) => {
  const { error } = await supabase.from('settings').upsert({ key, value });
  if (error) throw error;
};
