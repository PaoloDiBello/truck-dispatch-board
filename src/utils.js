import { MAX_SPEED, DRIVING_BEFORE_BREAK, BREAK_DURATION } from './constants';

export const uid = () => Math.random().toString(36).slice(2, 10);

export const formatDateFull = (d) => {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
};

export const getWeekDates = (offset = 0, includeSaturday = false) => {
  const today = new Date();
  const dow = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dow + 6) % 7) + offset * 7);
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: includeSaturday ? 6 : 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
};

export const toISODate = (d) => {
  const dd = new Date(d);
  return [
    dd.getFullYear(),
    String(dd.getMonth() + 1).padStart(2, '0'),
    String(dd.getDate()).padStart(2, '0'),
  ].join('-');
};

export const isSameDay = (a, b) => toISODate(a) === toISODate(b);

export const daysBetween = (a, b) =>
  Math.round((new Date(toISODate(b)) - new Date(toISODate(a))) / 86400000);

export const calculateDrivingTime = (km) => {
  if (!km) return null;
  const mins = (km / MAX_SPEED) * 60;
  return Math.round(mins + Math.floor(mins / DRIVING_BEFORE_BREAK) * BREAK_DURATION);
};

export const formatDuration = (mins) => {
  if (mins == null) return '—';
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
};

export const subtractMinutesFromDateTime = (dateStr, timeStr, mins) => {
  if (!dateStr || !timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date(dateStr);
  d.setHours(h, m - mins, 0, 0);
  return {
    date: toISODate(d),
    time: `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`,
  };
};

export const addMinutesToDateTime = (dateStr, timeStr, mins) => {
  if (!dateStr || !timeStr || mins == null) return null;
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date(dateStr);
  d.setHours(h, m + mins, 0, 0);
  return {
    date: toISODate(d),
    time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
  };
};

const geocodeCache = {};
export const geocodeCity = async (city) => {
  if (!city || city.trim().length < 2) return null;
  const key = city.trim().toLowerCase();
  if (geocodeCache[key]) return geocodeCache[key];
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`,
      { headers: { 'Accept-Language': 'es' } }
    );
    const data = await res.json();
    if (data?.[0]) {
      const r = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
      geocodeCache[key] = r;
      return r;
    }
  } catch { /* ignore */ }
  return null;
};

const haversine = (lat1, lon1, lat2, lon2) => {
  const R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLon = (lon2-lon1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) * 1.3;
};

export const getRouteDistance = async (origin, destination, apiKey) => {
  const [o, d] = await Promise.all([geocodeCity(origin), geocodeCity(destination)]);
  if (!o || !d) return null;
  if (apiKey?.trim()) {
    try {
      const res = await fetch(
        `https://api.openrouteservice.org/v2/directions/driving-hgv?api_key=${apiKey}&start=${o.lon},${o.lat}&end=${d.lon},${d.lat}`
      );
      const data = await res.json();
      if (data.features?.[0])
        return { distanceKm: Math.round(data.features[0].properties.summary.distance / 1000), source: 'ORS' };
    } catch { /* fallback */ }
  }
  return { distanceKm: Math.round(haversine(o.lat, o.lon, d.lat, d.lon)), source: 'APROX' };
};
