import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, Trash2, Settings, X, Clock, MapPin, Euro, Package, Phone, Building2,
  ChevronLeft, ChevronRight, Bell, Key, Truck, Calendar, MoreVertical, Edit2,
  Copy, AlertCircle, CheckCircle2, ArrowRight, Calculator, StickyNote, Tag as TagIcon,
  User, Search, Filter, Sparkles
} from 'lucide-react';

// ============ CONSTANTES ============
const MAX_SPEED = 90;
const DRIVING_BEFORE_BREAK = 4 * 60;
const BREAK_DURATION = 45;
const DAYS_ES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DAYS_ES_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const TAG_STYLES = {
  UPS:     { bg: 'bg-amber-500',   text: 'text-white', label: 'UPS' },
  DSV:     { bg: 'bg-red-500',     text: 'text-white', label: 'DSV' },
  EXTRA:   { bg: 'bg-purple-500',  text: 'text-white', label: 'Extra' },
  FIESTA:  { bg: 'bg-emerald-500', text: 'text-white', label: 'Fiesta' },
  URGENTE: { bg: 'bg-orange-500',  text: 'text-white', label: 'Urgente' },
};

// ============ HELPERS ============
const uid = () => Math.random().toString(36).slice(2, 10);

const formatDate = (d) => {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
};

const formatDateFull = (d) => {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
};

const getWeekDates = (offset = 0, includeSaturday = false) => {
  const today = new Date();
  const dow = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dow + 6) % 7) + offset * 7);
  monday.setHours(0, 0, 0, 0);
  const count = includeSaturday ? 6 : 5;
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
};

const toISODate = (d) => {
  const dd = new Date(d);
  dd.setHours(0, 0, 0, 0);
  return dd.toISOString().slice(0, 10);
};

const isSameDay = (a, b) => toISODate(a) === toISODate(b);

const daysBetween = (a, b) => {
  const da = new Date(toISODate(a));
  const db = new Date(toISODate(b));
  return Math.round((db - da) / (1000 * 60 * 60 * 24));
};

const calculateDrivingTime = (distanceKm) => {
  if (!distanceKm) return null;
  const drivingMinutes = (distanceKm / MAX_SPEED) * 60;
  const breaks = Math.floor(drivingMinutes / DRIVING_BEFORE_BREAK);
  return Math.round(drivingMinutes + breaks * BREAK_DURATION);
};

const formatDuration = (mins) => {
  if (!mins && mins !== 0) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
};

// Suma minutos a fecha+hora y devuelve {date, time}
const addMinutesToDateTime = (dateStr, timeStr, mins) => {
  if (!dateStr || !timeStr || mins == null) return null;
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date(dateStr);
  d.setHours(h, m + mins, 0, 0);
  return {
    date: toISODate(d),
    time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
  };
};

// Geocoding con Nominatim
const geocodeCache = {};
const geocodeCity = async (cityName) => {
  if (!cityName || cityName.trim().length < 2) return null;
  const key = cityName.trim().toLowerCase();
  if (geocodeCache[key]) return geocodeCache[key];
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cityName)}&format=json&limit=1`,
      { headers: { 'Accept-Language': 'es' } }
    );
    const data = await res.json();
    if (data && data[0]) {
      const result = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), name: data[0].display_name };
      geocodeCache[key] = result;
      return result;
    }
  } catch (e) { console.error('Geocoding error', e); }
  return null;
};

const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) ** 2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c * 1.3;
};

const getRouteDistance = async (origin, destination, apiKey) => {
  const originCoords = await geocodeCity(origin);
  const destCoords = await geocodeCity(destination);
  if (!originCoords || !destCoords) return null;

  if (apiKey && apiKey.trim()) {
    try {
      const res = await fetch(
        `https://api.openrouteservice.org/v2/directions/driving-hgv?api_key=${apiKey}&start=${originCoords.lon},${originCoords.lat}&end=${destCoords.lon},${destCoords.lat}`
      );
      const data = await res.json();
      if (data.features && data.features[0]) {
        return { distanceKm: Math.round(data.features[0].properties.summary.distance / 1000), source: 'ORS' };
      }
    } catch (e) { console.error('ORS error', e); }
  }
  const km = haversineDistance(originCoords.lat, originCoords.lon, destCoords.lat, destCoords.lon);
  return { distanceKm: Math.round(km), source: 'APROX' };
};

// ============ APP ============
export default function TruckDispatchBoard() {
  const [vehicles, setVehicles] = useState([]);
  const [cells, setCells] = useState({});
  const [weekOffset, setWeekOffset] = useState(0);
  const [includeSaturday, setIncludeSaturday] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [editingCell, setEditingCell] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [vehicleMenu, setVehicleMenu] = useState(null);
  const [hoveredCell, setHoveredCell] = useState(null);
  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [toast, setToast] = useState(null);
  const [filterText, setFilterText] = useState('');

  const weekDates = getWeekDates(weekOffset, includeSaturday);
  const isCurrentWeek = weekOffset === 0;

  // Cargar datos
  useEffect(() => {
    (async () => {
      try {
        const [vRes, cRes, kRes, sRes] = await Promise.all([
          window.storage.get('vehicles').catch(() => null),
          window.storage.get('cells').catch(() => null),
          window.storage.get('apiKey').catch(() => null),
          window.storage.get('includeSaturday').catch(() => null),
        ]);
        if (vRes?.value) setVehicles(JSON.parse(vRes.value));
        else setVehicles([
          { id: uid(), plate: '9055MTB', driver: 'Paquetero' },
          { id: uid(), plate: 'R0578BDJ', driver: '' },
          { id: uid(), plate: '7228LMT', driver: '' },
        ]);
        if (cRes?.value) setCells(JSON.parse(cRes.value));
        if (kRes?.value) setApiKey(kRes.value);
        if (sRes?.value) setIncludeSaturday(JSON.parse(sRes.value));
      } catch (e) { console.error('Load error', e); }
      setLoading(false);
    })();
  }, []);

  // Guardar
  useEffect(() => { if (!loading) window.storage.set('vehicles', JSON.stringify(vehicles)).catch(console.error); }, [vehicles, loading]);
  useEffect(() => { if (!loading) window.storage.set('cells', JSON.stringify(cells)).catch(console.error); }, [cells, loading]);
  useEffect(() => { if (!loading) window.storage.set('apiKey', apiKey).catch(console.error); }, [apiKey, loading]);
  useEffect(() => { if (!loading) window.storage.set('includeSaturday', JSON.stringify(includeSaturday)).catch(console.error); }, [includeSaturday, loading]);

  // Cerrar menú al hacer clic fuera
  useEffect(() => {
    const handler = () => setVehicleMenu(null);
    if (vehicleMenu) {
      document.addEventListener('click', handler);
      return () => document.removeEventListener('click', handler);
    }
  }, [vehicleMenu]);

  // Notificaciones de llegada
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const today = toISODate(now);
      Object.entries(cells).forEach(([key, cell]) => {
        if (!cell.routes) return;
        cell.routes.forEach((r) => {
          if (r.arrivalDate === today && r.arrivalTime && r.arrivalTime <= currentTime && !r._notified && r.origin && r.destination) {
            const vId = key.split('_')[0];
            const vehicle = vehicles.find((v) => v.id === vId);
            setNotification({
              vehicle: vehicle?.plate || 'Camión',
              driver: vehicle?.driver || '',
              route: `${r.origin} → ${r.destination}`,
              time: r.arrivalTime,
            });
            setCells((prev) => ({
              ...prev,
              [key]: { ...prev[key], routes: prev[key].routes.map((rt) => rt === r ? { ...rt, _notified: true } : rt) },
            }));
          }
        });
      });
    }, 30000);
    return () => clearInterval(interval);
  }, [cells, vehicles]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const addVehicle = () => {
    const nv = { id: uid(), plate: '', driver: '' };
    setVehicles([...vehicles, nv]);
    setEditingVehicle(nv.id);
    showToast('Camión añadido', 'success');
  };

  const updateVehicle = (id, field, value) => {
    setVehicles(vehicles.map((v) => v.id === id ? { ...v, [field]: value } : v));
  };

  const duplicateVehicle = (id) => {
    const v = vehicles.find((x) => x.id === id);
    if (!v) return;
    const idx = vehicles.findIndex((x) => x.id === id);
    const copy = { id: uid(), plate: v.plate + ' (copia)', driver: v.driver };
    const newVehicles = [...vehicles];
    newVehicles.splice(idx + 1, 0, copy);
    setVehicles(newVehicles);
    setVehicleMenu(null);
    showToast('Camión duplicado', 'success');
  };

  const deleteVehicle = (id) => {
    const v = vehicles.find((x) => x.id === id);
    setConfirmDialog({
      title: 'Eliminar camión',
      message: `¿Seguro que quieres eliminar "${v?.plate || 'este camión'}"? Se perderán todos sus datos de todas las semanas.`,
      confirmLabel: 'Eliminar',
      danger: true,
      onConfirm: () => {
        setVehicles(vehicles.filter((x) => x.id !== id));
        const newCells = { ...cells };
        Object.keys(newCells).forEach((k) => { if (k.startsWith(id + '_')) delete newCells[k]; });
        setCells(newCells);
        setConfirmDialog(null);
        setVehicleMenu(null);
        showToast('Camión eliminado', 'success');
      },
    });
  };

  const getCell = (vehicleId, date) => {
    const key = `${vehicleId}_${toISODate(date)}`;
    return cells[key] || { routes: [], notes: '', tags: [], company: {} };
  };

  const saveCell = (vehicleId, date, data) => {
    const key = `${vehicleId}_${toISODate(date)}`;
    setCells({ ...cells, [key]: data });
    showToast('Guardado', 'success');
  };

  // Detectar rutas que llegan desde el día anterior (para banner "viene de...")
  const getIncomingRoute = (vehicleId, date) => {
    const prevDate = new Date(date);
    prevDate.setDate(prevDate.getDate() - 1);
    for (let i = 0; i < 5; i++) {
      const d = new Date(date);
      d.setDate(d.getDate() - i - 1);
      const prev = getCell(vehicleId, d);
      for (const r of (prev.routes || [])) {
        if (r.arrivalDate === toISODate(date) && r.departureDate !== r.arrivalDate) {
          return { route: r, fromDate: d };
        }
      }
    }
    return null;
  };

  const filteredVehicles = vehicles.filter((v) => {
    if (!filterText) return true;
    const t = filterText.toLowerCase();
    return v.plate.toLowerCase().includes(t) || v.driver.toLowerCase().includes(t);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="flex items-center gap-2 text-slate-500">
          <Truck className="w-5 h-5 animate-pulse" />
          <span>Cargando...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50 text-slate-900" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center text-white">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-slate-900 leading-tight">Planificador de Rutas</div>
              <div className="text-xs text-slate-500">Gestor semanal de camiones</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative hidden md:block">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Buscar camión o conductor..."
                className="pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 w-64 bg-slate-50"
              />
            </div>
            <button
              onClick={addVehicle}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium shadow-sm transition"
            >
              <Plus className="w-4 h-4" /> Nuevo camión
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 hover:bg-slate-100 rounded-lg transition text-slate-600"
              title="Ajustes"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* SUBHEADER: Navegación semana */}
        <div className="flex items-center justify-between px-5 py-2.5 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setWeekOffset(weekOffset - 1)}
              className="p-1.5 hover:bg-white rounded-lg transition text-slate-600 hover:text-slate-900"
              title="Semana anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 px-3">
              <Calendar className="w-4 h-4 text-slate-500" />
              <div className="text-sm">
                <span className="font-semibold text-slate-900">
                  {formatDateFull(weekDates[0])} – {formatDateFull(weekDates[weekDates.length - 1])}
                </span>
                {isCurrentWeek && (
                  <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded font-medium">
                    Semana actual
                  </span>
                )}
                {weekOffset < 0 && <span className="ml-2 text-xs text-slate-500">({Math.abs(weekOffset)} semana{Math.abs(weekOffset)>1?'s':''} atrás)</span>}
                {weekOffset > 0 && <span className="ml-2 text-xs text-slate-500">(en {weekOffset} semana{weekOffset>1?'s':''})</span>}
              </div>
            </div>
            <button
              onClick={() => setWeekOffset(weekOffset + 1)}
              className="p-1.5 hover:bg-white rounded-lg transition text-slate-600 hover:text-slate-900"
              title="Semana siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            {!isCurrentWeek && (
              <button
                onClick={() => setWeekOffset(0)}
                className="ml-2 px-3 py-1 text-xs bg-white border border-slate-200 rounded-lg hover:border-blue-500 hover:text-blue-600 transition font-medium"
              >
                Ir a hoy
              </button>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeSaturday}
              onChange={(e) => setIncludeSaturday(e.target.checked)}
              className="rounded accent-blue-600"
            />
            Incluir sábados
          </label>
        </div>
      </header>

      {/* GRID */}
      <div className="flex-1 overflow-auto">
        <table className="border-collapse" style={{ minWidth: '100%' }}>
          <thead className="sticky top-0 z-20">
            <tr>
              <th
                className="sticky left-0 z-30 bg-slate-100 border-b border-r border-slate-200 p-3 text-left"
                style={{ minWidth: '220px', width: '220px' }}
              >
                <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Camiones</div>
                <div className="text-xs text-slate-400 mt-0.5">{filteredVehicles.length} de {vehicles.length}</div>
              </th>
              {weekDates.map((d, i) => {
                const isToday = isSameDay(d, new Date());
                return (
                  <th
                    key={i}
                    className={`border-b border-r border-slate-200 p-2.5 text-center ${isToday ? 'bg-blue-50' : 'bg-slate-100'}`}
                    style={{ minWidth: '240px' }}
                  >
                    <div className={`text-xs font-semibold uppercase tracking-wide ${isToday ? 'text-blue-700' : 'text-slate-600'}`}>
                      {DAYS_ES[i]}
                    </div>
                    <div className={`text-sm font-medium mt-0.5 ${isToday ? 'text-blue-900' : 'text-slate-700'}`}>
                      {formatDateFull(d)}
                    </div>
                    {isToday && <div className="text-[10px] text-blue-600 font-semibold mt-0.5">HOY</div>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {filteredVehicles.map((v, vIdx) => (
              <tr key={v.id} className="group/row">
                <td
                  className="sticky left-0 z-10 bg-white border-b border-r border-slate-200 p-3 align-middle group-hover/row:bg-slate-50 transition"
                  style={{ minWidth: '220px', width: '220px' }}
                >
                  {editingVehicle === v.id ? (
                    <VehicleEditor
                      vehicle={v}
                      onSave={(data) => { updateVehicle(v.id, 'plate', data.plate); updateVehicle(v.id, 'driver', data.driver); setEditingVehicle(null); }}
                      onCancel={() => setEditingVehicle(null)}
                    />
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <Truck className="w-4 h-4 text-slate-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-sm text-slate-900 truncate">
                            {v.plate || <span className="text-slate-400 italic">Sin matrícula</span>}
                          </div>
                          <div className="text-xs text-slate-500 truncate flex items-center gap-1">
                            {v.driver ? (
                              <><User className="w-3 h-3" /> {v.driver}</>
                            ) : (
                              <span className="italic text-slate-400">Sin conductor</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="relative flex-shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); setVehicleMenu(vehicleMenu === v.id ? null : v.id); }}
                          className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition opacity-0 group-hover/row:opacity-100"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {vehicleMenu === v.id && (
                          <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-40 min-w-[160px]">
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditingVehicle(v.id); setVehicleMenu(null); }}
                              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-slate-50 text-left"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-slate-500" /> Renombrar
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); duplicateVehicle(v.id); }}
                              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-slate-50 text-left"
                            >
                              <Copy className="w-3.5 h-3.5 text-slate-500" /> Duplicar
                            </button>
                            <div className="border-t border-slate-100 my-1" />
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteVehicle(v.id); }}
                              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-red-50 text-red-600 text-left"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Eliminar
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </td>
                {weekDates.map((d, di) => {
                  const cell = getCell(v.id, d);
                  const cellKey = `${v.id}_${toISODate(d)}`;
                  const isToday = isSameDay(d, new Date());
                  const incoming = getIncomingRoute(v.id, d);
                  const hasTooltipData = cell.company?.name || cell.company?.contact || cell.company?.price || cell.company?.cargo;
                  return (
                    <td
                      key={di}
                      onClick={() => setEditingCell({ vehicleId: v.id, date: d, data: cell })}
                      onMouseEnter={(e) => {
                        if (hasTooltipData) {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top });
                          setHoveredCell(cellKey);
                        }
                      }}
                      onMouseLeave={() => setHoveredCell(null)}
                      className={`border-b border-r border-slate-200 p-2 align-top cursor-pointer transition relative ${
                        isToday ? 'bg-blue-50/30 hover:bg-blue-50' : 'bg-white hover:bg-slate-50'
                      }`}
                      style={{ minWidth: '240px', height: '110px' }}
                    >
                      <CellContent cell={cell} incoming={incoming} date={d} />
                      {hoveredCell === cellKey && <CompanyTooltip company={cell.company} pos={tooltipPos} />}
                    </td>
                  );
                })}
              </tr>
            ))}
            {filteredVehicles.length === 0 && (
              <tr>
                <td colSpan={weekDates.length + 1} className="text-center py-16">
                  <div className="flex flex-col items-center gap-3 text-slate-400">
                    <Truck className="w-12 h-12 opacity-40" />
                    <div>
                      {vehicles.length === 0 ? (
                        <>
                          <div className="font-medium text-slate-600">No hay camiones todavía</div>
                          <div className="text-sm">Pulsa "Nuevo camión" para empezar</div>
                        </>
                      ) : (
                        <>
                          <div className="font-medium text-slate-600">Sin resultados</div>
                          <div className="text-sm">No hay camiones que coincidan con "{filterText}"</div>
                        </>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* FOOTER */}
      <footer className="px-5 py-2 bg-white border-t border-slate-200 text-xs text-slate-500 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> 90 km/h · parada 45min/4h</div>
        </div>
        <div className="flex items-center gap-1.5">
          {apiKey ? (
            <><CheckCircle2 className="w-3 h-3 text-emerald-600" /> <span className="text-emerald-700">OpenRouteService activo</span></>
          ) : (
            <><AlertCircle className="w-3 h-3 text-amber-600" /> <span className="text-amber-700">Usando cálculo aproximado</span></>
          )}
        </div>
      </footer>

      {/* MODAL EDITOR */}
      {editingCell && (
        <CellEditor
          vehicleId={editingCell.vehicleId}
          date={editingCell.date}
          data={editingCell.data}
          apiKey={apiKey}
          onSave={(data) => { saveCell(editingCell.vehicleId, editingCell.date, data); setEditingCell(null); }}
          onCancel={() => setEditingCell(null)}
          vehicleName={vehicles.find((v) => v.id === editingCell.vehicleId)?.plate || ''}
          driverName={vehicles.find((v) => v.id === editingCell.vehicleId)?.driver || ''}
        />
      )}

      {/* MODAL AJUSTES */}
      {showSettings && <SettingsModal apiKey={apiKey} setApiKey={setApiKey} onClose={() => setShowSettings(false)} />}

      {/* CONFIRM DIALOG */}
      {confirmDialog && (
        <ConfirmDialog
          {...confirmDialog}
          onCancel={() => setConfirmDialog(null)}
        />
      )}

      {/* NOTIFICACIÓN */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden max-w-sm animate-in slide-in-from-right">
          <div className="border-l-4 border-emerald-500 p-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <Bell className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-slate-900">Llegada estimada</div>
                <div className="text-sm mt-1 space-y-0.5">
                  <div className="font-medium text-slate-700">{notification.vehicle}{notification.driver && ` · ${notification.driver}`}</div>
                  <div className="text-slate-600">{notification.route}</div>
                  <div className="text-xs text-slate-500">Hora prevista: {notification.time}</div>
                </div>
              </div>
              <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-600 p-0.5">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-sm px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ============ EDITOR DE NOMBRE DE CAMIÓN ============
function VehicleEditor({ vehicle, onSave, onCancel }) {
  const [plate, setPlate] = useState(vehicle.plate);
  const [driver, setDriver] = useState(vehicle.driver);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);

  const handleSave = () => onSave({ plate: plate.trim(), driver: driver.trim() });

  return (
    <div className="space-y-1.5">
      <input
        ref={inputRef}
        value={plate}
        onChange={(e) => setPlate(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onCancel(); }}
        placeholder="Matrícula"
        className="w-full px-2 py-1 text-sm font-semibold border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-200"
      />
      <input
        value={driver}
        onChange={(e) => setDriver(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onCancel(); }}
        placeholder="Conductor (opcional)"
        className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:border-blue-500"
      />
      <div className="flex gap-1 pt-1">
        <button onClick={handleSave} className="flex-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">
          Guardar
        </button>
        <button onClick={onCancel} className="px-2 py-1 text-xs bg-slate-100 rounded hover:bg-slate-200">
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ============ CONTENIDO DE CELDA ============
function CellContent({ cell, incoming, date }) {
  const routes = cell.routes || [];
  const tags = cell.tags || [];
  const isEmpty = routes.length === 0 && tags.length === 0 && !cell.notes;

  if (isEmpty && !incoming) {
    return (
      <div className="h-full flex items-center justify-center text-slate-300 group-hover:text-slate-400">
        <div className="flex items-center gap-1 text-xs opacity-0 hover:opacity-100 transition">
          <Plus className="w-3 h-3" /> Añadir
        </div>
      </div>
    );
  }

  return (
    <div className="text-xs space-y-1.5">
      {incoming && (
        <div className="flex items-center gap-1 bg-blue-50 border border-blue-200 rounded px-1.5 py-1 text-blue-700">
          <ArrowRight className="w-3 h-3 flex-shrink-0" />
          <span className="truncate text-[10px]">
            Continúa: <span className="font-semibold">{incoming.route.origin}</span> → <span className="font-semibold">{incoming.route.destination}</span>
            {incoming.route.arrivalTime && <span className="ml-1">· llega {incoming.route.arrivalTime}</span>}
          </span>
        </div>
      )}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map((t, i) => {
            const s = TAG_STYLES[t];
            if (!s) return null;
            return (
              <span key={i} className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${s.bg} ${s.text}`}>
                {s.label}
              </span>
            );
          })}
        </div>
      )}
      {routes.map((r, i) => {
        const isMultiDay = r.departureDate && r.arrivalDate && r.departureDate !== r.arrivalDate;
        const startsToday = r.departureDate === toISODate(date);
        const endsToday = r.arrivalDate === toISODate(date);
        return (
          <div key={i} className={`rounded-md px-1.5 py-1.5 border ${
            isMultiDay ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-center gap-1 font-medium text-slate-900 truncate">
              <MapPin className="w-3 h-3 text-blue-600 flex-shrink-0" />
              <span className="truncate">{r.origin || '—'}</span>
              <ArrowRight className="w-2.5 h-2.5 text-slate-400 flex-shrink-0" />
              <span className="truncate">{r.destination || '—'}</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-600 mt-1 flex-wrap">
              {r.departureTime && (
                <span className={`flex items-center gap-0.5 ${startsToday ? 'font-semibold text-slate-700' : ''}`}>
                  <Clock className="w-2.5 h-2.5" /> {r.departureTime}
                  {isMultiDay && startsToday && <span className="text-blue-600 ml-0.5">sal.</span>}
                </span>
              )}
              {r.arrivalTime && (
                <span className={`flex items-center gap-0.5 ${endsToday ? 'font-semibold text-emerald-700' : ''}`}>
                  <Clock className="w-2.5 h-2.5" /> {r.arrivalTime}
                  {isMultiDay && endsToday && <span className="text-emerald-600 ml-0.5">lleg.</span>}
                </span>
              )}
              {r.distanceKm != null && <span className="text-slate-500">· {r.distanceKm}km</span>}
              {isMultiDay && (
                <span className="px-1 py-0.5 rounded bg-blue-100 text-blue-700 font-semibold text-[9px]">
                  {daysBetween(r.departureDate, r.arrivalDate) + 1} días
                </span>
              )}
            </div>
          </div>
        );
      })}
      {cell.notes && (
        <div className="flex items-start gap-1 text-slate-600 text-[10px]">
          <StickyNote className="w-2.5 h-2.5 mt-0.5 flex-shrink-0" />
          <span className="italic line-clamp-2">{cell.notes}</span>
        </div>
      )}
    </div>
  );
}

// ============ TOOLTIP DE EMPRESA ============
function CompanyTooltip({ company, pos }) {
  return (
    <div
      className="fixed z-50 bg-slate-900 text-white text-xs rounded-lg shadow-2xl p-3 pointer-events-none"
      style={{ left: pos.x, top: pos.y - 10, transform: 'translate(-50%, -100%)', minWidth: '240px' }}
    >
      {company.name && (
        <div className="flex items-center gap-1.5 mb-1.5 font-semibold">
          <Building2 className="w-3.5 h-3.5" /> {company.name}
        </div>
      )}
      {company.contact && (
        <div className="flex items-center gap-1.5 mb-1 text-slate-300">
          <Phone className="w-3 h-3" /> {company.contact}
        </div>
      )}
      {company.price && (
        <div className="flex items-center gap-1.5 mb-1 text-slate-300">
          <Euro className="w-3 h-3" /> {company.price} €
          {company.pricePerKm && <span className="text-emerald-300 ml-1 font-medium">({company.pricePerKm} €/km)</span>}
        </div>
      )}
      {company.cargo && (
        <div className="flex items-center gap-1.5 mb-1 text-slate-300">
          <Package className="w-3 h-3" /> {company.cargo}
        </div>
      )}
      {company.notes && <div className="text-slate-400 mt-1.5 pt-1.5 border-t border-slate-700 italic">{company.notes}</div>}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full">
        <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-slate-900" />
      </div>
    </div>
  );
}

// ============ EDITOR DE CELDA ============
function CellEditor({ vehicleId, date, data, apiKey, onSave, onCancel, vehicleName, driverName }) {
  const defaultRoute = () => ({
    origin: '', destination: '',
    departureDate: toISODate(date), departureTime: '',
    arrivalDate: toISODate(date), arrivalTime: '',
    distanceKm: null, estimatedMinutes: null,
  });
  const [routes, setRoutes] = useState(data.routes?.length ? data.routes : [defaultRoute()]);
  const [notes, setNotes] = useState(data.notes || '');
  const [tags, setTags] = useState(data.tags || []);
  const [company, setCompany] = useState(data.company || {});
  const [calculating, setCalculating] = useState(-1);

  const addRoute = () => {
    if (routes.length >= 3) return;
    setRoutes([...routes, defaultRoute()]);
  };

  const removeRoute = (idx) => setRoutes(routes.filter((_, i) => i !== idx));

  const updateRoute = (idx, updates) => {
    const nr = [...routes];
    nr[idx] = { ...nr[idx], ...updates };
    setRoutes(nr);
  };

  const calculateRoute = async (idx) => {
    const r = routes[idx];
    if (!r.origin || !r.destination) {
      updateRoute(idx, { _error: 'Introduce origen y destino' });
      return;
    }
    setCalculating(idx);
    updateRoute(idx, { _error: null });
    const result = await getRouteDistance(r.origin, r.destination, apiKey);
    if (result) {
      const mins = calculateDrivingTime(result.distanceKm);
      let updates = { distanceKm: result.distanceKm, estimatedMinutes: mins, source: result.source, _error: null };
      if (r.departureDate && r.departureTime) {
        const arrival = addMinutesToDateTime(r.departureDate, r.departureTime, mins);
        if (arrival) {
          updates.arrivalDate = arrival.date;
          updates.arrivalTime = arrival.time;
        }
      }
      updateRoute(idx, updates);
    } else {
      updateRoute(idx, { _error: 'No se pudo localizar alguna de las ciudades' });
    }
    setCalculating(-1);
  };

  const toggleTag = (tag) => setTags(tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag]);

  const totalKm = routes.reduce((s, r) => s + (r.distanceKm || 0), 0);
  const pricePerKm = totalKm > 0 && company.price ? (parseFloat(company.price) / totalKm).toFixed(2) : null;

  const handleSave = () => {
    onSave({
      routes: routes.filter((r) => r.origin || r.destination).map((r) => { const { _error, ...clean } = r; return clean; }),
      notes, tags,
      company: { ...company, pricePerKm },
    });
  };

  return (
    <div className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <header className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Truck className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="font-bold text-slate-900">{vehicleName || 'Sin matrícula'}</div>
              <div className="text-xs text-slate-500 flex items-center gap-2">
                {driverName && <><User className="w-3 h-3" /> {driverName} · </>}
                <Calendar className="w-3 h-3" /> {formatDateFull(date)}
              </div>
            </div>
          </div>
          <button onClick={onCancel} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* TAGS */}
          <section>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
              <TagIcon className="w-3.5 h-3.5" /> Etiquetas
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(TAG_STYLES).map((t) => {
                const s = TAG_STYLES[t];
                const active = tags.includes(t);
                return (
                  <button
                    key={t}
                    onClick={() => toggleTag(t)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                      active ? `${s.bg} ${s.text} shadow-sm` : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* RUTAS */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                <MapPin className="w-3.5 h-3.5" /> Rutas
                <span className="text-slate-400 normal-case font-normal">· máx. 3</span>
              </div>
              {routes.length < 3 && (
                <button onClick={addRoute} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium">
                  <Plus className="w-3.5 h-3.5" /> Añadir ruta
                </button>
              )}
            </div>
            <div className="space-y-3">
              {routes.map((r, i) => {
                const isMultiDay = r.departureDate && r.arrivalDate && r.departureDate !== r.arrivalDate;
                return (
                  <div key={i} className="border border-slate-200 rounded-lg bg-slate-50 overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-slate-200">
                      <span className="text-xs font-semibold text-slate-700">Ruta {i + 1}</span>
                      <div className="flex items-center gap-2">
                        {isMultiDay && (
                          <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-semibold">
                            MULTI-DÍA ({daysBetween(r.departureDate, r.arrivalDate) + 1} días)
                          </span>
                        )}
                        {routes.length > 1 && (
                          <button onClick={() => removeRoute(i)} className="text-slate-400 hover:text-red-600 p-1">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="p-3 space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-medium text-slate-500 uppercase">Origen</label>
                          <input
                            type="text" placeholder="p. ej. Madrid"
                            value={r.origin}
                            onChange={(e) => updateRoute(i, { origin: e.target.value })}
                            className="w-full mt-0.5 px-2.5 py-1.5 border border-slate-300 rounded-md text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-medium text-slate-500 uppercase">Destino</label>
                          <input
                            type="text" placeholder="p. ej. Barcelona"
                            value={r.destination}
                            onChange={(e) => updateRoute(i, { destination: e.target.value })}
                            className="w-full mt-0.5 px-2.5 py-1.5 border border-slate-300 rounded-md text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                          />
                        </div>
                      </div>

                      {/* Salida: fecha + hora */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-medium text-slate-500 uppercase">Salida - Fecha</label>
                          <input
                            type="date"
                            value={r.departureDate || ''}
                            onChange={(e) => updateRoute(i, { departureDate: e.target.value })}
                            className="w-full mt-0.5 px-2.5 py-1.5 border border-slate-300 rounded-md text-sm focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-medium text-slate-500 uppercase">Salida - Hora</label>
                          <input
                            type="time"
                            value={r.departureTime || ''}
                            onChange={(e) => {
                              const depTime = e.target.value;
                              let updates = { departureTime: depTime };
                              if (r.estimatedMinutes && r.departureDate) {
                                const arrival = addMinutesToDateTime(r.departureDate, depTime, r.estimatedMinutes);
                                if (arrival) { updates.arrivalDate = arrival.date; updates.arrivalTime = arrival.time; }
                              }
                              updateRoute(i, updates);
                            }}
                            className="w-full mt-0.5 px-2.5 py-1.5 border border-slate-300 rounded-md text-sm focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Llegada: fecha + hora */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-medium text-slate-500 uppercase">Llegada - Fecha</label>
                          <input
                            type="date"
                            value={r.arrivalDate || ''}
                            onChange={(e) => updateRoute(i, { arrivalDate: e.target.value })}
                            min={r.departureDate}
                            className="w-full mt-0.5 px-2.5 py-1.5 border border-slate-300 rounded-md text-sm focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-medium text-slate-500 uppercase">Llegada - Hora</label>
                          <input
                            type="time"
                            value={r.arrivalTime || ''}
                            onChange={(e) => updateRoute(i, { arrivalTime: e.target.value })}
                            className="w-full mt-0.5 px-2.5 py-1.5 border border-slate-300 rounded-md text-sm focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <button
                          onClick={() => calculateRoute(i)}
                          disabled={calculating === i}
                          className="flex items-center gap-1.5 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 disabled:bg-slate-300 font-medium"
                        >
                          <Calculator className="w-3.5 h-3.5" />
                          {calculating === i ? 'Calculando...' : 'Calcular distancia y llegada'}
                        </button>
                        {r.distanceKm != null && (
                          <div className="text-xs text-slate-700 flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold">{r.distanceKm} km</span>
                            <span className="text-slate-400">·</span>
                            <span>{formatDuration(r.estimatedMinutes)}</span>
                            {r.source === 'APROX' && (
                              <span className="text-amber-700 bg-amber-50 border border-amber-200 px-1 py-0.5 rounded text-[9px] font-semibold">APROX</span>
                            )}
                          </div>
                        )}
                      </div>
                      {r._error && (
                        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> {r._error}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* EMPRESA */}
          <section>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
              <Building2 className="w-3.5 h-3.5" /> Datos de empresa
              <span className="text-slate-400 normal-case font-normal">· visibles al pasar el ratón</span>
            </div>
            <div className="grid grid-cols-2 gap-2 bg-slate-50 border border-slate-200 rounded-lg p-3">
              <input
                type="text" placeholder="Empresa contratante"
                value={company.name || ''}
                onChange={(e) => setCompany({ ...company, name: e.target.value })}
                className="px-2.5 py-1.5 border border-slate-300 rounded-md text-sm bg-white focus:border-blue-500 focus:outline-none"
              />
              <input
                type="text" placeholder="Contacto / teléfono"
                value={company.contact || ''}
                onChange={(e) => setCompany({ ...company, contact: e.target.value })}
                className="px-2.5 py-1.5 border border-slate-300 rounded-md text-sm bg-white focus:border-blue-500 focus:outline-none"
              />
              <input
                type="number" step="0.01" placeholder="Precio pactado (€)"
                value={company.price || ''}
                onChange={(e) => setCompany({ ...company, price: e.target.value })}
                className="px-2.5 py-1.5 border border-slate-300 rounded-md text-sm bg-white focus:border-blue-500 focus:outline-none"
              />
              <input
                type="text" placeholder="Material transportado"
                value={company.cargo || ''}
                onChange={(e) => setCompany({ ...company, cargo: e.target.value })}
                className="px-2.5 py-1.5 border border-slate-300 rounded-md text-sm bg-white focus:border-blue-500 focus:outline-none"
              />
              <textarea
                placeholder="Notas adicionales sobre el cliente..."
                value={company.notes || ''}
                onChange={(e) => setCompany({ ...company, notes: e.target.value })}
                className="px-2.5 py-1.5 border border-slate-300 rounded-md text-sm col-span-2 resize-none bg-white focus:border-blue-500 focus:outline-none"
                rows={2}
              />
            </div>
            {pricePerKm && (
              <div className="mt-2 flex items-center gap-2 text-xs bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
                <Euro className="w-4 h-4 text-emerald-600" />
                <span className="text-slate-700">Precio/km calculado:</span>
                <span className="font-bold text-emerald-700">{pricePerKm} €/km</span>
                <span className="text-slate-500 text-[10px] ml-auto">({totalKm} km totales)</span>
              </div>
            )}
          </section>

          {/* NOTAS */}
          <section>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
              <StickyNote className="w-3.5 h-3.5" /> Notas generales
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observaciones, incidencias, recordatorios..."
              className="w-full px-2.5 py-2 border border-slate-300 rounded-md text-sm resize-none focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              rows={3}
            />
          </section>
        </div>

        <footer className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex justify-end gap-2 flex-shrink-0">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-md font-medium">
            Cancelar
          </button>
          <button onClick={handleSave} className="px-5 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 font-semibold shadow-sm">
            Guardar cambios
          </button>
        </footer>
      </div>
    </div>
  );
}

// ============ AJUSTES ============
function SettingsModal({ apiKey, setApiKey, onClose }) {
  const [tempKey, setTempKey] = useState(apiKey);

  return (
    <div className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <header className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
              <Settings className="w-5 h-5 text-slate-600" />
            </div>
            <div className="font-bold text-slate-900">Ajustes</div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </header>
        <div className="p-6 space-y-4">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
              <Key className="w-3.5 h-3.5" /> API Key de OpenRouteService
            </label>
            <input
              type="text" value={tempKey}
              onChange={(e) => setTempKey(e.target.value)}
              placeholder="Pega aquí tu API key..."
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
            <div className="mt-3 text-xs bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
              <div className="font-semibold text-blue-900 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Cómo conseguir una API key (gratis, sin tarjeta)
              </div>
              <ol className="list-decimal list-inside space-y-1 text-slate-700 pl-1">
                <li>Ve a <span className="font-mono text-blue-700 bg-white px-1 rounded">openrouteservice.org</span></li>
                <li>Pulsa "Sign up" y crea una cuenta</li>
                <li>En tu dashboard: "Request a token" → crear nuevo</li>
                <li>Copia la clave y pégala aquí arriba</li>
              </ol>
              <div className="pt-1 text-slate-600 border-t border-blue-200 mt-2">
                <strong>Sin key:</strong> cálculo aproximado (línea recta × 1.3)<br/>
                <strong>Con key:</strong> rutas reales por carretera adaptadas a camiones
              </div>
            </div>
          </div>
        </div>
        <footer className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-md font-medium">
            Cancelar
          </button>
          <button
            onClick={() => { setApiKey(tempKey); onClose(); }}
            className="px-5 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 font-semibold shadow-sm"
          >
            Guardar
          </button>
        </footer>
      </div>
    </div>
  );
}

// ============ CONFIRM DIALOG ============
function ConfirmDialog({ title, message, confirmLabel, danger, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${danger ? 'bg-red-100' : 'bg-blue-100'}`}>
              <AlertCircle className={`w-5 h-5 ${danger ? 'text-red-600' : 'text-blue-600'}`} />
            </div>
            <div>
              <div className="font-bold text-slate-900 mb-1">{title}</div>
              <div className="text-sm text-slate-600">{message}</div>
            </div>
          </div>
        </div>
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-md font-medium">
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className={`px-5 py-2 text-sm text-white rounded-md font-semibold shadow-sm ${
              danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
