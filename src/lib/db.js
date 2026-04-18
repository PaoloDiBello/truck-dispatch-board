import { supabase } from './supabase';

// ─── VEHICLES ─────────────────────────────────────────────────────────────────
export const fetchVehicles = async () => {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .order('position', { ascending: true });
  if (error) throw error;
  return data;
};

export const insertVehicle = async (vehicle) => {
  const { data, error } = await supabase
    .from('vehicles')
    .upsert(vehicle, { onConflict: 'id', ignoreDuplicates: true })
    .select()
    .single();
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

// ─── CELLS ────────────────────────────────────────────────────────────────────
export const fetchCells = async () => {
  const { data, error } = await supabase.from('cells').select('*');
  if (error) throw error;
  // convert array to keyed map: { [vehicleId_dateStr]: data }
  return Object.fromEntries(data.map(row => [row.id, row.data]));
};

export const upsertCell = async (vehicleId, dateStr, data) => {
  const id = `${vehicleId}_${dateStr}`;
  const { error } = await supabase.from('cells').upsert({
    id,
    vehicle_id: vehicleId,
    date_str: dateStr,
    data,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
};

export const deleteCellsForVehicle = async (vehicleId) => {
  const { error } = await supabase.from('cells').delete().eq('vehicle_id', vehicleId);
  if (error) throw error;
};

// ─── TAGS ─────────────────────────────────────────────────────────────────────
export const fetchTags = async () => {
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .order('position', { ascending: true });
  if (error) throw error;
  return data;
};

export const insertTag = async (tag) => {
  const { error } = await supabase
    .from('tags')
    .upsert(tag, { onConflict: 'id', ignoreDuplicates: true });
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
