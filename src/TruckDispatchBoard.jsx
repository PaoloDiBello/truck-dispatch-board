import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import {
  Plus, Trash2, Settings, X, Clock, MapPin, Euro, Package, Phone, Building2,
  ChevronLeft, ChevronRight, Bell, Key, Truck, Calendar, Edit2,
  AlertCircle, CheckCircle2, ArrowRight, Calculator, StickyNote, Tag as TagIcon,
  User, Search, Sparkles, Navigation, Gauge, Star, ChevronDown, Check, Palette,
} from 'lucide-react';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const MAX_SPEED = 90;
const DRIVING_BEFORE_BREAK = 4 * 60;
const BREAK_DURATION = 45;
const DAYS_ES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// Tag colors — user picks one of these
const TAG_COLORS = {
  amber:   { bg: 'bg-amber-500',   text: 'text-white', ring: 'ring-amber-400'   },
  red:     { bg: 'bg-red-500',     text: 'text-white', ring: 'ring-red-400'     },
  purple:  { bg: 'bg-purple-500',  text: 'text-white', ring: 'ring-purple-400'  },
  emerald: { bg: 'bg-emerald-500', text: 'text-white', ring: 'ring-emerald-400' },
  orange:  { bg: 'bg-orange-500',  text: 'text-white', ring: 'ring-orange-400'  },
  blue:    { bg: 'bg-blue-500',    text: 'text-white', ring: 'ring-blue-400'    },
  pink:    { bg: 'bg-pink-500',    text: 'text-white', ring: 'ring-pink-400'    },
  cyan:    { bg: 'bg-cyan-500',    text: 'text-white', ring: 'ring-cyan-400'    },
  slate:   { bg: 'bg-slate-600',   text: 'text-white', ring: 'ring-slate-400'   },
  indigo:  { bg: 'bg-indigo-500',  text: 'text-white', ring: 'ring-indigo-400'  },
};
const COLOR_CYCLE = ['amber','red','purple','emerald','orange','blue','pink','cyan','slate','indigo'];

const DEFAULT_TAGS = [
  { id: 'ups',     label: 'UPS',     color: 'amber'   },
  { id: 'dsv',     label: 'DSV',     color: 'red'     },
  { id: 'extra',   label: 'Extra',   color: 'purple'  },
  { id: 'fiesta',  label: 'Fiesta',  color: 'emerald' },
  { id: 'urgente', label: 'Urgente', color: 'orange'  },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 10);

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
  return Array.from({ length: includeSaturday ? 6 : 5 }, (_, i) => {
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
const daysBetween = (a, b) => Math.round((new Date(toISODate(b)) - new Date(toISODate(a))) / 86400000);

const calculateDrivingTime = (km) => {
  if (!km) return null;
  const mins = (km / MAX_SPEED) * 60;
  return Math.round(mins + Math.floor(mins / DRIVING_BEFORE_BREAK) * BREAK_DURATION);
};

const formatDuration = (mins) => {
  if (mins == null) return '—';
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
};

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

const geocodeCache = {};
const geocodeCity = async (city) => {
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

const getRouteDistance = async (origin, destination, apiKey) => {
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

// ─── STORAGE ──────────────────────────────────────────────────────────────────
const storage = {
  get: (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } },
};

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function TruckDispatchBoard() {
  const [vehicles, setVehicles]           = useState([]);
  const [cells, setCells]                 = useState({});
  const [savedTags, setSavedTags]         = useState(DEFAULT_TAGS);
  const [weekOffset, setWeekOffset]       = useState(0);
  const [includeSaturday, setSat]         = useState(false);
  const [apiKey, setApiKey]               = useState('');
  const [editingCell, setEditingCell]     = useState(null);
  const [showSettings, setShowSettings]   = useState(false);
  const [showTrucks, setShowTrucks]       = useState(false);
  const [hoveredCell, setHoveredCell]     = useState(null);
  const [tooltipPos, setTooltipPos]       = useState({ x: 0, y: 0 });
  const [notification, setNotification]   = useState(null);
  const [loading, setLoading]             = useState(true);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [toast, setToast]                 = useState(null);
  const [filterText, setFilterText]       = useState('');

  const weekDates = getWeekDates(weekOffset, includeSaturday);

  useEffect(() => {
    const v  = storage.get('vehicles');
    const c  = storage.get('cells');
    const k  = storage.get('apiKey');
    const s  = storage.get('includeSaturday');
    const tg = storage.get('savedTags');
    setVehicles(v || [
      { id: uid(), plate: '9055MTB',  driver: 'Paquetero' },
      { id: uid(), plate: 'R0578BDJ', driver: '' },
      { id: uid(), plate: '7228LMT',  driver: '' },
    ]);
    if (c)  setCells(c);
    if (k)  setApiKey(k);
    if (s != null) setSat(s);
    if (tg) setSavedTags(tg);
    setLoading(false);
  }, []);

  useEffect(() => { if (!loading) storage.set('vehicles', vehicles); }, [vehicles, loading]);
  useEffect(() => { if (!loading) storage.set('cells', cells); }, [cells, loading]);
  useEffect(() => { if (!loading) storage.set('apiKey', apiKey); }, [apiKey, loading]);
  useEffect(() => { if (!loading) storage.set('includeSaturday', includeSaturday); }, [includeSaturday, loading]);
  useEffect(() => { if (!loading) storage.set('savedTags', savedTags); }, [savedTags, loading]);

  useEffect(() => {
    const tick = setInterval(() => {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
      const today = toISODate(now);
      Object.entries(cells).forEach(([key, cell]) => {
        cell.routes?.forEach((r) => {
          if (r.arrivalDate === today && r.arrivalTime <= currentTime && !r._notified && r.origin && r.destination) {
            const vehicle = vehicles.find((v) => v.id === key.split('_')[0]);
            setNotification({ vehicle: vehicle?.plate || 'Camión', driver: vehicle?.driver || '', route: `${r.origin} → ${r.destination}`, time: r.arrivalTime });
            setCells((prev) => ({
              ...prev,
              [key]: { ...prev[key], routes: prev[key].routes.map((rt) => rt === r ? { ...rt, _notified: true } : rt) },
            }));
          }
        });
      });
    }, 30000);
    return () => clearInterval(tick);
  }, [cells, vehicles]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const addVehicle    = (data) => setVehicles((p) => [...p, { id: uid(), plate: data.plate || '', driver: data.driver || '' }]);
  const updateVehicle = (id, data) => setVehicles((p) => p.map((v) => v.id === id ? { ...v, ...data } : v));
  const deleteVehicle = (id) => {
    const v = vehicles.find((x) => x.id === id);
    const assignedKeys = Object.keys(cells).filter((k) => k.startsWith(id + '_') && (
      cells[k].routes?.length || cells[k].notes || cells[k].tags?.length
    ));
    const recordCount = assignedKeys.length;
    const routeCount  = assignedKeys.reduce((s, k) => s + (cells[k].routes?.length || 0), 0);

    const detail = recordCount > 0
      ? `Este camión tiene ${recordCount} día${recordCount !== 1 ? 's' : ''} con datos asignados (${routeCount} ruta${routeCount !== 1 ? 's' : ''}). Todo se eliminará de forma permanente.`
      : 'Este camión no tiene datos asignados.';

    setConfirmDialog({
      title: 'Eliminar camión',
      message: `¿Eliminar "${v?.plate || 'este camión'}"?\n\n${detail}`,
      confirmLabel: 'Sí, eliminar',
      danger: true,
      onConfirm: () => {
        setVehicles((p) => p.filter((x) => x.id !== id));
        setCells((p) => {
          const nc = { ...p };
          Object.keys(nc).filter((k) => k.startsWith(id + '_')).forEach((k) => delete nc[k]);
          return nc;
        });
        setConfirmDialog(null);
        showToast('Camión eliminado');
      },
    });
  };

  const getCell = useCallback((vehicleId, date) =>
    cells[`${vehicleId}_${toISODate(date)}`] || { title: '', routes: [], notes: '', tags: [], company: {} },
  [cells]);

  const saveCell = (vehicleId, date, data) => {
    setCells((prev) => ({ ...prev, [`${vehicleId}_${toISODate(date)}`]: data }));
    showToast('Guardado');
  };

  const getSpanningRoutes = useCallback((vehicleId, date) => {
    const dateStr = toISODate(date);
    const result = [];
    for (let i = 1; i <= 14; i++) {
      const d = new Date(date);
      d.setDate(d.getDate() - i);
      const cell = cells[`${vehicleId}_${toISODate(d)}`];
      if (!cell?.routes) continue;
      for (const r of cell.routes) {
        if (!r.departureDate || !r.arrivalDate) continue;
        if (r.departureDate < dateStr && r.arrivalDate >= dateStr) {
          result.push({ ...r, _spanType: r.arrivalDate === dateStr ? 'arrival' : 'transit' });
        }
      }
    }
    return result;
  }, [cells]);

  const filteredVehicles = vehicles.filter((v) => {
    if (!filterText) return true;
    const t = filterText.toLowerCase();
    return v.plate.toLowerCase().includes(t) || (v.driver || '').toLowerCase().includes(t);
  });

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-slate-100">
      <div className="flex items-center gap-3 text-slate-500">
        <Truck className="w-5 h-5 animate-pulse text-blue-500" /> Cargando…
      </div>
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-slate-100 text-slate-800" style={{ fontFamily: 'system-ui,-apple-system,sans-serif' }}>

      {/* ── HEADER ── */}
      <header className="bg-white border-b border-slate-200 shadow-sm z-10">
        <div className="flex items-center justify-between px-5 py-3 gap-3">
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
              <Truck className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-slate-900 leading-tight">Planificador de Rutas</div>
              <div className="text-xs text-slate-500">Gestor semanal de camiones</div>
            </div>
          </div>
          <div className="relative flex-1 max-w-xs hidden md:block">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={filterText} onChange={(e) => setFilterText(e.target.value)}
              placeholder="Buscar matrícula o conductor…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition"
            />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowTrucks(true)} className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:border-blue-400 hover:text-blue-600 text-sm font-medium transition">
              <Truck className="w-4 h-4" /><span className="hidden sm:inline">Gestionar flota</span>
            </button>
            <button onClick={() => setShowSettings(true)} className="p-2 hover:bg-slate-100 rounded-lg transition text-slate-600" title="Ajustes">
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between px-5 py-2 border-t border-slate-100 bg-slate-50">
          <div className="flex items-center gap-1">
            <button onClick={() => setWeekOffset(weekOffset - 1)} className="p-1.5 rounded-lg hover:bg-white transition text-slate-500 hover:text-slate-800">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 px-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-semibold text-slate-800">
                {formatDateFull(weekDates[0])} – {formatDateFull(weekDates[weekDates.length - 1])}
              </span>
              {weekOffset === 0 && <span className="px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-700 text-xs font-semibold">Hoy</span>}
              {weekOffset !== 0 && <span className="text-xs text-slate-500">{weekOffset < 0 ? `${Math.abs(weekOffset)} sem. atrás` : `en ${weekOffset} sem.`}</span>}
            </div>
            <button onClick={() => setWeekOffset(weekOffset + 1)} className="p-1.5 rounded-lg hover:bg-white transition text-slate-500 hover:text-slate-800">
              <ChevronRight className="w-4 h-4" />
            </button>
            {weekOffset !== 0 && (
              <button onClick={() => setWeekOffset(0)} className="ml-1 px-3 py-1 text-xs bg-white border border-slate-200 rounded-lg hover:border-blue-400 hover:text-blue-600 transition font-medium">
                Ir a hoy
              </button>
            )}
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
            <input type="checkbox" checked={includeSaturday} onChange={(e) => setSat(e.target.checked)} className="rounded accent-blue-600" />
            Incluir sábados
          </label>
        </div>
      </header>

      {/* ── GRID ── */}
      <div className="flex-1 overflow-auto">
        <table className="border-collapse" style={{ minWidth: `${220 + weekDates.length * 200}px`, width: '100%' }}>
          <colgroup>
            <col style={{ width: '220px', minWidth: '220px' }} />
            {weekDates.map((_, i) => <col key={i} style={{ minWidth: '200px' }} />)}
          </colgroup>
          <thead className="sticky top-0 z-20">
            <tr>
              <th className="sticky left-0 z-30 bg-slate-100 border-b-2 border-r border-slate-200 p-3 text-left">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Flota</div>
                <div className="text-xs text-slate-400 font-normal mt-0.5">{filteredVehicles.length}/{vehicles.length}</div>
              </th>
              {weekDates.map((d, i) => {
                const isToday = isSameDay(d, new Date());
                return (
                  <th key={i} className={`border-b-2 border-r border-slate-200 p-3 text-center ${isToday ? 'bg-blue-600' : 'bg-slate-100'}`}>
                    <div className={`text-xs font-bold uppercase tracking-wider ${isToday ? 'text-blue-200' : 'text-slate-500'}`}>{DAYS_ES[i]}</div>
                    <div className={`text-sm font-bold mt-0.5 ${isToday ? 'text-white' : 'text-slate-700'}`}>{formatDateFull(d)}</div>
                    {isToday && <div className="text-[10px] font-bold text-blue-200 mt-0.5 tracking-widest">HOY</div>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {filteredVehicles.map((v) => (
              <tr key={v.id} className="group/row">
                <td className="sticky left-0 z-10 bg-white border-b border-r border-slate-200 p-3 align-middle group-hover/row:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
                      <Truck className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-slate-800 truncate">
                        {v.plate || <span className="font-normal italic text-slate-400">Sin matrícula</span>}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                        {v.driver ? <><User className="w-3 h-3 text-slate-400 flex-shrink-0" />{v.driver}</> : <span className="italic text-slate-400">Sin conductor</span>}
                      </div>
                    </div>
                  </div>
                </td>
                {weekDates.map((d, di) => {
                  const cell     = getCell(v.id, d);
                  const spanning = getSpanningRoutes(v.id, d);
                  const cellKey  = `${v.id}_${toISODate(d)}`;
                  const isToday  = isSameDay(d, new Date());
                  const hasCompany = cell.company?.name || cell.company?.contact || cell.company?.price;
                  const hasContent = cell.routes?.length || cell.tags?.length || cell.notes || spanning.length;
                  return (
                    <td
                      key={di}
                      onClick={() => setEditingCell({ vehicleId: v.id, date: d, data: cell })}
                      onMouseEnter={(e) => {
                        if (hasCompany) {
                          const r = e.currentTarget.getBoundingClientRect();
                          setTooltipPos({ x: r.left + r.width / 2, y: r.top });
                          setHoveredCell(cellKey);
                        }
                      }}
                      onMouseLeave={() => setHoveredCell(null)}
                      className={`border-b border-r border-slate-200 p-2 align-top cursor-pointer transition-colors relative group/cell
                        ${isToday ? 'bg-blue-50/40 hover:bg-blue-50/70' : 'bg-white hover:bg-slate-50'}`}
                      style={{ height: '120px' }}
                    >
                      {hasContent
                        ? <CellContent cell={cell} spanning={spanning} date={d} savedTags={savedTags} />
                        : <div className="h-full flex items-center justify-center">
                            <span className="text-xs text-slate-300 group-hover/cell:text-slate-400 flex items-center gap-1 transition-colors">
                              <Plus className="w-3 h-3" /> Añadir
                            </span>
                          </div>
                      }
                      {hoveredCell === cellKey && hasCompany && <CompanyTooltip company={cell.company} pos={tooltipPos} />}
                    </td>
                  );
                })}
              </tr>
            ))}
            {filteredVehicles.length === 0 && (
              <tr>
                <td colSpan={weekDates.length + 1} className="py-20 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                      <Truck className="w-8 h-8 text-slate-300" />
                    </div>
                    {vehicles.length === 0
                      ? <><div className="font-semibold text-slate-600">Sin camiones todavía</div><div className="text-sm text-slate-400">Usa "Gestionar flota" para añadir</div></>
                      : <><div className="font-semibold text-slate-600">Sin resultados</div><div className="text-sm text-slate-400">Nada coincide con "{filterText}"</div></>
                    }
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── FOOTER ── */}
      <footer className="px-5 py-2.5 bg-white border-t border-slate-200 flex justify-between items-center">
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><Gauge className="w-3.5 h-3.5 text-slate-400" />Vel. máx. <strong className="text-slate-700 ml-1">90 km/h</strong></span>
          <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-slate-400" />Pausa <strong className="text-slate-700 ml-1">45 min / 4 h</strong></span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          {apiKey
            ? <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /><span className="text-emerald-700 font-medium">OpenRouteService activo</span></>
            : <><AlertCircle className="w-3.5 h-3.5 text-amber-500" /><span className="text-amber-700 font-medium">Cálculo aproximado</span></>
          }
        </div>
      </footer>

      {/* ── MODALS ── */}
      {showTrucks && (
        <TrucksModal vehicles={vehicles} onAdd={addVehicle} onUpdate={updateVehicle} onDelete={deleteVehicle} onClose={() => setShowTrucks(false)} />
      )}
      {editingCell && (
        <CellEditor
          vehicleId={editingCell.vehicleId} date={editingCell.date} data={editingCell.data}
          apiKey={apiKey}
          savedTags={savedTags}
          onSave={(data) => { saveCell(editingCell.vehicleId, editingCell.date, data); setEditingCell(null); }}
          onClear={() => {
            const plate = vehicles.find(v=>v.id===editingCell.vehicleId)?.plate || 'este camión';
            const vid = editingCell.vehicleId;
            const daysWithData = Object.keys(cells).filter(k => k.startsWith(vid + '_')).length;
            setConfirmDialog({
              title: 'Borrar todo',
              message: `¿Eliminar TODOS los datos de ${plate} de todas las semanas?${daysWithData > 0 ? ` (${daysWithData} día${daysWithData !== 1 ? 's' : ''} con datos)` : ''} Esta acción no se puede deshacer.`,
              confirmLabel: 'Sí, borrar todo',
              danger: true,
              onConfirm: () => {
                setCells(prev => {
                  const nc = { ...prev };
                  Object.keys(nc).filter(k => k.startsWith(vid + '_')).forEach(k => delete nc[k]);
                  storage.set('cells', nc);
                  return nc;
                });
                setEditingCell(null);
                setConfirmDialog(null);
                showToast('Datos borrados');
              },
            });
          }}
          onAddTag={(newTag) => {
            setSavedTags(prev => {
              const updated = [...prev, newTag];
              storage.set('tags', updated);
              return updated;
            });
          }}
          onDeleteTag={(id) => {
            setSavedTags(prev => {
              const updated = prev.filter(t => t.id !== id);
              storage.set('tags', updated);
              return updated;
            });
          }}
          onCancel={() => setEditingCell(null)}
          vehicleName={vehicles.find((v) => v.id === editingCell.vehicleId)?.plate || ''}
          driverName={vehicles.find((v) => v.id === editingCell.vehicleId)?.driver || ''}
        />
      )}
      {showSettings && (
        <SettingsModal
          apiKey={apiKey}
          savedTags={savedTags}
          onSaveTags={setSavedTags}
          onSave={(k) => { setApiKey(k); setShowSettings(false); }}
          onClose={() => setShowSettings(false)}
        />
      )}
      {confirmDialog && (
        <ConfirmDialog {...confirmDialog} onCancel={() => setConfirmDialog(null)} />
      )}

      {notification && (
        <div className="fixed top-4 right-4 z-50 bg-white rounded-xl shadow-2xl border border-slate-200 max-w-sm overflow-hidden">
          <div className="border-l-4 border-emerald-500 p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <Bell className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-slate-800">Llegada estimada</div>
              <div className="text-sm text-slate-700 font-medium mt-0.5">{notification.vehicle}{notification.driver && ` · ${notification.driver}`}</div>
              <div className="text-sm text-slate-600">{notification.route}</div>
              <div className="text-xs text-slate-500 mt-0.5">Hora prevista: <strong>{notification.time}</strong></div>
            </div>
            <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 pointer-events-none">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" /> {toast}
        </div>
      )}
    </div>
  );
}

// ─── TRUCKS MODAL ─────────────────────────────────────────────────────────────
function TrucksModal({ vehicles, onAdd, onUpdate, onDelete, onClose }) {
  const { register, handleSubmit, reset } = useForm({ defaultValues: { plate: '', driver: '' } });
  const submit = (data) => { if (!data.plate.trim()) return; onAdd(data); reset(); };

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-md bg-white h-full flex flex-col shadow-2xl">
        <header className="px-6 py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
              <Truck className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="font-bold text-slate-900">Gestionar flota</div>
              <div className="text-xs text-slate-500">{vehicles.length} camión{vehicles.length !== 1 ? 'es' : ''}</div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><X className="w-5 h-5" /></button>
        </header>
        <div className="flex-1 overflow-y-auto py-3 px-4 space-y-2">
          {vehicles.length === 0 && <div className="py-12 text-center text-slate-400 text-sm">Añade tu primer camión abajo.</div>}
          {vehicles.map((v, idx) => (
            <TruckRow key={v.id} vehicle={v} index={idx + 1} onUpdate={(d) => onUpdate(v.id, d)} onDelete={() => onDelete(v.id)} />
          ))}
        </div>
        <div className="border-t border-slate-200 px-4 py-4 bg-slate-50 flex-shrink-0">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Añadir camión</div>
          <form onSubmit={handleSubmit(submit)} className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Matrícula *</label>
                <input {...register('plate')} placeholder="1234ABC" className={`${inputCls} font-mono`} />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Conductor</label>
                <input {...register('driver')} placeholder="Nombre" className={inputCls} />
              </div>
            </div>
            <button type="submit" className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-bold transition shadow-sm">
              <Plus className="w-4 h-4" /> Añadir camión
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function TruckRow({ vehicle, index, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const { register, handleSubmit, reset } = useForm({ defaultValues: { plate: vehicle.plate, driver: vehicle.driver } });
  const save   = (d) => { onUpdate(d); setEditing(false); };
  const cancel = () => { reset(); setEditing(false); };

  if (editing) return (
    <form onSubmit={handleSubmit(save)} className="bg-blue-50 border-2 border-blue-200 rounded-xl p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-blue-600 font-semibold mb-1 block">Matrícula</label>
          <input {...register('plate')} autoFocus onKeyDown={(e) => e.key === 'Escape' && cancel()} className={`${inputCls} font-mono`} />
        </div>
        <div>
          <label className="text-xs text-blue-600 font-semibold mb-1 block">Conductor</label>
          <input {...register('driver')} onKeyDown={(e) => e.key === 'Escape' && cancel()} className={inputCls} />
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" className="flex-1 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold">Guardar</button>
        <button type="button" onClick={cancel} className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-600">Cancelar</button>
      </div>
    </form>
  );

  return (
    <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3 group hover:border-slate-300 transition-colors">
      <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 flex-shrink-0">{index}</div>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm text-slate-800 font-mono">{vehicle.plate || <span className="font-sans font-normal italic text-slate-400">Sin matrícula</span>}</div>
        <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
          {vehicle.driver ? <><User className="w-3 h-3 text-slate-400" />{vehicle.driver}</> : <span className="italic text-slate-400">Sin conductor</span>}
        </div>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => setEditing(true)} className="p-1.5 hover:bg-blue-50 rounded-lg text-slate-400 hover:text-blue-600 transition"><Edit2 className="w-3.5 h-3.5" /></button>
        <button onClick={onDelete} className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  );
}

// ─── CELL CONTENT ─────────────────────────────────────────────────────────────
function CellContent({ cell, spanning, date, savedTags }) {
  const routes  = cell.routes || [];
  const tags    = cell.tags   || [];

  return (
    <div className="space-y-1.5">
      {/* Service title — shown first, most prominent */}
      {cell.title && (
        <div className="px-2 py-1 bg-blue-600 rounded-md">
          <div className="font-bold text-xs text-white truncate leading-tight">{cell.title}</div>
        </div>
      )}

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map((tagId, i) => {
            const tag = savedTags?.find((t) => t.id === tagId);
            if (!tag) return null;
            const c = TAG_COLORS[tag.color] || TAG_COLORS.slate;
            return <span key={i} className={`px-1.5 py-0.5 rounded-md text-[11px] font-bold ${c.bg} ${c.text}`}>{tag.label}</span>;
          })}
        </div>
      )}

      {/* Spanning routes: transit or arrival */}
      {spanning.map((r, i) => (
        r._spanType === 'transit'
          ? <TransitStrip key={`t${i}`} route={r} />
          : <ArrivalStrip key={`a${i}`} route={r} />
      ))}

      {/* Own routes (departure day) */}
      {routes.map((r, i) => {
        const isMulti = r.departureDate && r.arrivalDate && r.departureDate !== r.arrivalDate;
        return (
          <div key={i} className={`rounded-lg border-l-[3px] px-2 py-1.5 ${isMulti ? 'bg-indigo-50 border-l-indigo-500' : 'bg-blue-50 border-l-blue-500'}`}>
            <div className="flex items-center gap-1 font-bold text-xs text-slate-800 truncate">
              <MapPin className={`w-3 h-3 flex-shrink-0 ${isMulti ? 'text-indigo-500' : 'text-blue-500'}`} />
              <span className="truncate">{r.origin || '—'}</span>
              {r.origin && r.destination && <ArrowRight className="w-2.5 h-2.5 flex-shrink-0 text-slate-400" />}
              {r.destination && <span className="truncate">{r.destination}</span>}
            </div>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {r.departureTime && (
                <span className="flex items-center gap-1 text-xs text-slate-600 font-medium">
                  <Clock className="w-3 h-3 text-slate-400" />{r.departureTime}
                  {isMulti && <span className="text-[10px] font-bold text-indigo-600 ml-0.5">sal.</span>}
                </span>
              )}
              {r.distanceKm != null && (
                <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${isMulti ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700'}`}>
                  {r.distanceKm} km
                </span>
              )}
              {isMulti && (
                <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[10px] font-bold">
                  {daysBetween(r.departureDate, r.arrivalDate) + 1}d
                </span>
              )}
            </div>
          </div>
        );
      })}

      {cell.notes && (
        <div className="flex items-start gap-1.5">
          <StickyNote className="w-3 h-3 mt-0.5 text-slate-400 flex-shrink-0" />
          <span className="text-xs text-slate-500 italic line-clamp-1">{cell.notes}</span>
        </div>
      )}
    </div>
  );
}

// Transit day: truck visually driving across the cell
function TransitStrip({ route }) {
  return (
    <div className="rounded-lg bg-amber-50 border border-amber-200 px-2 py-1.5 overflow-hidden">
      {/* Road strip */}
      <div className="flex items-center gap-1 mb-1">
        <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">En ruta</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-amber-800 font-semibold truncate flex-shrink min-w-0">{route.origin}</span>
        {/* Road visual */}
        <div className="flex-1 flex items-center gap-0.5 mx-1 min-w-0">
          <div className="flex-1 h-px bg-amber-300" />
          <Truck className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
          <div className="flex-1 h-px bg-amber-300 border-dashed" style={{ borderTop: '1px dashed #fcd34d', height: 0 }} />
        </div>
        <span className="text-[10px] text-amber-800 font-semibold truncate flex-shrink min-w-0">{route.destination}</span>
      </div>
    </div>
  );
}

// Arrival day: truck arriving with time
function ArrivalStrip({ route }) {
  return (
    <div className="rounded-lg bg-emerald-50 border-l-[3px] border-l-emerald-500 border border-emerald-200 px-2 py-1.5">
      <div className="flex items-center gap-1 font-bold text-xs text-emerald-700">
        <CheckCircle2 className="w-3 h-3 flex-shrink-0" /> Llegada
        {route.arrivalTime && <span className="ml-auto font-bold text-emerald-800 flex items-center gap-0.5"><Clock className="w-3 h-3" />{route.arrivalTime}</span>}
      </div>
      <div className="text-xs text-slate-600 mt-0.5 truncate font-medium">
        {route.origin} → {route.destination}
      </div>
    </div>
  );
}

// ─── COMPANY TOOLTIP ──────────────────────────────────────────────────────────
function CompanyTooltip({ company, pos }) {
  return (
    <div className="fixed z-50 bg-slate-900 text-white text-sm rounded-xl shadow-2xl p-4 pointer-events-none"
      style={{ left: pos.x, top: pos.y - 8, transform: 'translate(-50%,-100%)', minWidth: '220px', maxWidth: '280px' }}>
      {company.name    && <div className="flex items-center gap-2 font-bold mb-2"><Building2 className="w-4 h-4 text-blue-400" /> {company.name}</div>}
      {company.contact && <div className="flex items-center gap-2 text-slate-300 mb-1.5 text-xs"><Phone className="w-3.5 h-3.5 text-slate-500" /> {company.contact}</div>}
      {company.price   && (
        <div className="flex items-center gap-2 text-slate-300 mb-1.5 text-xs">
          <Euro className="w-3.5 h-3.5 text-slate-500" /> {company.price} €
          {company.pricePerKm && <span className="font-semibold text-emerald-400 ml-1">· {company.pricePerKm} €/km</span>}
        </div>
      )}
      {company.cargo   && <div className="flex items-center gap-2 text-slate-300 text-xs"><Package className="w-3.5 h-3.5 text-slate-500" /> {company.cargo}</div>}
      {company.notes   && <div className="text-slate-400 mt-2 pt-2 border-t border-slate-700 text-xs italic">{company.notes}</div>}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full">
        <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-slate-900" />
      </div>
    </div>
  );
}

// ─── TAG PICKER ───────────────────────────────────────────────────────────────
// Shows all tags as chips. Click to toggle. "+" opens an inline new-tag form.
function TagCombobox({ savedTags, selectedIds, onSelect, onCreateAndSelect, onDeleteTag }) {
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState('blue');
  const inputRef = useRef(null);

  useEffect(() => { if (creating) inputRef.current?.focus(); }, [creating]);

  const handleCreate = () => {
    const label = newLabel.trim();
    if (!label) return;
    const newTag = { id: uid(), label, color: newColor };
    onCreateAndSelect(label, newTag);
    setNewLabel('');
    setNewColor('blue');
    setCreating(false);
  };

  return (
    <div className="space-y-2">
      {/* All tags as chips */}
      {savedTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {savedTags.map(tag => {
            const c = TAG_COLORS[tag.color] || TAG_COLORS.slate;
            const active = selectedIds.includes(tag.id);
            return (
              <div key={tag.id} className="group relative">
                <button type="button" onClick={() => onSelect(tag.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    active
                      ? `${c.bg} ${c.text} border-transparent shadow-sm`
                      : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'
                  }`}>
                  {active && <Check className="w-3 h-3 inline mr-1 -mt-0.5" />}{tag.label}
                </button>
                {/* delete on long-hover */}
                {onDeleteTag && (
                  <button type="button" onClick={() => onDeleteTag(tag.id)}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full items-center justify-center hidden group-hover:flex transition">
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New tag inline form */}
      {creating ? (
        <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-200">
          <input
            ref={inputRef}
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCreate(); } if (e.key === 'Escape') setCreating(false); }}
            placeholder="Nombre de la etiqueta"
            className="flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none min-w-0"
          />
          <div className="flex items-center gap-1">
            {COLOR_CYCLE.map(col => (
              <button key={col} type="button" onClick={() => setNewColor(col)}
                className={`w-4 h-4 rounded-full flex-shrink-0 ${TAG_COLORS[col].bg} transition-transform ${newColor === col ? 'scale-125 ring-2 ring-offset-1 ring-slate-300' : 'hover:scale-110 opacity-60 hover:opacity-100'}`}
              />
            ))}
          </div>
          <button type="button" onClick={handleCreate} disabled={!newLabel.trim()}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold text-white transition disabled:opacity-40 flex-shrink-0 ${TAG_COLORS[newColor]?.bg || 'bg-blue-500'}`}>
            Añadir
          </button>
          <button type="button" onClick={() => setCreating(false)} className="text-slate-400 hover:text-slate-600 flex-shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 font-medium transition">
          <Plus className="w-3.5 h-3.5" /> Nueva etiqueta
        </button>
      )}
    </div>
  );
}

// ─── CELL EDITOR ──────────────────────────────────────────────────────────────
function CellEditor({ date, data, apiKey, savedTags, onSave, onClear, onCancel, onAddTag, onDeleteTag, vehicleName, driverName }) {
  const defaultRoute = () => ({
    origin: '', destination: '',
    departureDate: toISODate(date), departureTime: '',
    arrivalDate: toISODate(date), arrivalTime: '',
    distanceKm: null, estimatedMinutes: null, source: null,
  });

  const { register, handleSubmit, control, watch, setValue, getValues } = useForm({
    defaultValues: {
      title:   data.title   || '',
      routes:  data.routes?.length ? data.routes : [defaultRoute()],
      notes:   data.notes   || '',
      tags:    data.tags    || [],
      company: data.company || {},
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'routes' });
  const [calculating, setCalculating] = useState(-1);
  const [routeErrors, setRouteErrors] = useState({});
  const [localNewTags, setLocalNewTags] = useState([]);
  const allTags = [...savedTags, ...localNewTags];
  const [showCompany, setShowCompany] = useState(
    !!(data.company?.name || data.company?.contact || data.company?.price || data.company?.cargo || data.company?.notes)
  );

  const tags         = watch('tags');
  const routes       = watch('routes');
  const companyPrice = watch('company.price');
  const totalKm      = routes.reduce((s, r) => s + (Number(r.distanceKm) || 0), 0);
  const pricePerKm   = totalKm > 0 && companyPrice ? (parseFloat(companyPrice) / totalKm).toFixed(2) : null;

  const toggleTag = (tag) => {
    const curr = getValues('tags');
    setValue('tags', curr.includes(tag) ? curr.filter((t) => t !== tag) : [...curr, tag]);
  };

  const calcRoute = async (idx) => {
    const r = getValues(`routes.${idx}`);
    if (!r.origin || !r.destination) {
      setRouteErrors((p) => ({ ...p, [idx]: 'Introduce origen y destino' }));
      return;
    }
    setCalculating(idx);
    setRouteErrors((p) => ({ ...p, [idx]: null }));
    const result = await getRouteDistance(r.origin, r.destination, apiKey);
    if (result) {
      const mins = calculateDrivingTime(result.distanceKm);
      setValue(`routes.${idx}.distanceKm`, result.distanceKm);
      setValue(`routes.${idx}.estimatedMinutes`, mins);
      setValue(`routes.${idx}.source`, result.source);
      const arr = addMinutesToDateTime(getValues(`routes.${idx}.departureDate`), getValues(`routes.${idx}.departureTime`), mins);
      if (arr) { setValue(`routes.${idx}.arrivalDate`, arr.date); setValue(`routes.${idx}.arrivalTime`, arr.time); }
    } else {
      setRouteErrors((p) => ({ ...p, [idx]: 'No se pudo localizar alguna ciudad' }));
    }
    setCalculating(-1);
  };

  const onSubmit = (d) => {
    onSave({
      title:   d.title.trim(),
      routes:  d.routes.filter((r) => r.origin || r.destination),
      notes:   d.notes,
      tags:    d.tags,
      company: { ...d.company, pricePerKm },
    });
  };

  return (
    <div className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onCancel}>
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: 'min(92vh, 760px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Truck className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-white">{vehicleName || 'Sin matrícula'}</div>
              <div className="text-xs text-blue-200 flex items-center gap-2 mt-0.5">
                {driverName && <><User className="w-3 h-3" />{driverName} · </>}
                <Calendar className="w-3 h-3" />{formatDateFull(date)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {(data.routes?.length > 0 || data.notes || data.tags?.length > 0) && (
              <button
                type="button" onClick={onClear}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-red-500 text-white rounded-xl text-xs font-semibold transition mr-1"
                title="Borrar todos los datos de este camión"
              >
                <Trash2 className="w-3.5 h-3.5" /> Borrar
              </button>
            )}
            <button onClick={onCancel} className="p-2 hover:bg-white/20 rounded-xl transition"><X className="w-5 h-5 text-white" /></button>
          </div>
        </header>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">

            {/* Title + Tags — grouped at top as "what is this service" */}
            <section className="space-y-3">
              <IconInput
                icon={<Edit2 className="w-3.5 h-3.5" />}
                iconColor="text-slate-400"
                {...register('title')}
                placeholder="Nombre del servicio"
                className="text-base font-semibold placeholder-slate-300"
              />
              <TagCombobox savedTags={allTags} selectedIds={tags} onSelect={toggleTag} onCreateAndSelect={(label, newTag) => {
                setLocalNewTags(p => [...p, newTag]);
                onAddTag?.(newTag);
                setValue('tags', [...getValues('tags'), newTag.id]);
              }} onDeleteTag={(id) => {
                onDeleteTag?.(id);
                setLocalNewTags(p => p.filter(t => t.id !== id));
                setValue('tags', getValues('tags').filter(t => t !== id));
              }} />
            </section>

            {/* Routes */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <SectionLabel icon={<MapPin className="w-3.5 h-3.5" />} label="Rutas" note="máx. 3" />
                {fields.length < 3 && (
                  <button type="button" onClick={() => append(defaultRoute())} className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-semibold">
                    <Plus className="w-3.5 h-3.5" /> Añadir ruta
                  </button>
                )}
              </div>
              <div className="space-y-4">
                {fields.map((field, i) => {
                  const r = routes[i] || {};
                  const isMulti = r.departureDate && r.arrivalDate && r.departureDate !== r.arrivalDate;
                  return (
                    <div key={field.id} className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                      {/* Route header */}
                      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-500">Ruta {i + 1}</span>
                          {isMulti && <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[11px] font-bold">{daysBetween(r.departureDate, r.arrivalDate) + 1} días</span>}
                        </div>
                        <button type="button" onClick={() => remove(i)} className="p-1 hover:bg-red-50 rounded-lg text-slate-300 hover:text-red-400 transition">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="p-4 space-y-4">
                        {/* Origin → Destination — visual journey line */}
                        <div className="flex items-center gap-2">
                          <div className="flex-1 relative">
                            <input {...register(`routes.${i}.origin`)} placeholder="Origen" className="w-full px-3 py-2.5 pr-8 text-sm font-medium border border-slate-200 rounded-lg focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none transition" />
                            <MapPin className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300 pointer-events-none" />
                          </div>
                          <ArrowRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                          <div className="flex-1 relative">
                            <input {...register(`routes.${i}.destination`)} placeholder="Destino" className="w-full px-3 py-2.5 pr-8 text-sm font-medium border border-slate-200 rounded-lg focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none transition" />
                            <Navigation className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300 pointer-events-none" />
                          </div>
                        </div>

                        {/* Departure / Arrival — two columns, labels as column headers */}
                        <div className="grid grid-cols-2 gap-3">
                          {/* Departure column */}
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5 px-1">
                              <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Salida</span>
                            </div>
                            <div className="relative">
                              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                              <input type="date" {...register(`routes.${i}.departureDate`)} className="w-full pl-8 pr-2 py-2 text-sm border border-slate-200 rounded-lg focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none transition" />
                            </div>
                            <div className="relative">
                              <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                              <input type="time" {...register(`routes.${i}.departureTime`, {
                                onChange: (e) => {
                                  const mins = getValues(`routes.${i}.estimatedMinutes`);
                                  const dep  = getValues(`routes.${i}.departureDate`);
                                  if (mins && dep) {
                                    const arr = addMinutesToDateTime(dep, e.target.value, mins);
                                    if (arr) { setValue(`routes.${i}.arrivalDate`, arr.date); setValue(`routes.${i}.arrivalTime`, arr.time); }
                                  }
                                },
                              })} className="w-full pl-8 pr-2 py-2 text-sm border border-slate-200 rounded-lg focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none transition" />
                            </div>
                          </div>
                          {/* Arrival column */}
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5 px-1">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Llegada</span>
                            </div>
                            <div className="relative">
                              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                              <input type="date" {...register(`routes.${i}.arrivalDate`)} min={r.departureDate} className="w-full pl-8 pr-2 py-2 text-sm border border-slate-200 rounded-lg focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
                            </div>
                            <div className="relative">
                              <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                              <input type="time" {...register(`routes.${i}.arrivalTime`)} className="w-full pl-8 pr-2 py-2 text-sm border border-slate-200 rounded-lg focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
                            </div>
                          </div>
                        </div>

                        {/* Calculate + result */}
                        <div className="flex items-center gap-3">
                          <button type="button" onClick={() => calcRoute(i)} disabled={calculating === i}
                            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-40 font-medium transition">
                            <Calculator className="w-3.5 h-3.5" />
                            {calculating === i ? 'Calculando…' : 'Calcular distancia'}
                          </button>
                          {r.distanceKm != null && (
                            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                              <span className="font-bold">{r.distanceKm} km</span>
                              <span className="text-slate-300">·</span>
                              <span className="text-slate-500">{formatDuration(r.estimatedMinutes)}</span>
                              {r.source === 'APROX' && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[11px] font-bold">APROX</span>}
                            </div>
                          )}
                        </div>
                        {routeErrors[i] && (
                          <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {routeErrors[i]}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Company — collapsible, auto-filled from saved */}
            <section>
              <button
                type="button"
                onClick={() => setShowCompany((p) => !p)}
                className="flex items-center gap-2 w-full text-left group"
              >
                <SectionLabel icon={<Building2 className="w-3.5 h-3.5" />} label="Datos de empresa" />
                <ChevronDown className={`w-4 h-4 text-slate-400 ml-auto transition-transform ${showCompany ? 'rotate-180' : ''}`} />
              </button>
              {showCompany && (
                <CompanyFields
                  register={register}
                  pricePerKm={pricePerKm}
                  totalKm={totalKm}
                />
              )}
              {!showCompany && watch('company.name') && (
                <div className="mt-2 px-3 py-2 bg-slate-50 rounded-lg text-xs text-slate-600 flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-semibold">{watch('company.name')}</span>
                  {watch('company.price') && <span className="text-slate-400">· {watch('company.price')} €</span>}
                </div>
              )}
            </section>

            {/* Notes */}
            <section>
              <div className="relative">
                <span className="absolute left-3 top-3 pointer-events-none text-slate-400"><StickyNote className="w-3.5 h-3.5" /></span>
                <textarea {...register('notes')} placeholder="Notas, observaciones, incidencias…" className={`w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition resize-none`} rows={3} />
              </div>
            </section>
          </div>
        </div>

        {/* Footer — always visible, outside scroll */}
        <footer className="px-6 py-4 bg-white border-t-2 border-slate-100 flex justify-end gap-2 flex-shrink-0 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
          <button type="button" onClick={onCancel} className="px-5 py-2.5 text-sm text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => handleSubmit(onSubmit)()}
            className="px-6 py-2.5 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold shadow-sm transition"
          >
            Guardar cambios
          </button>
        </footer>
      </div>
    </div>
  );
}

// ─── COMPANY FIELDS ──────────────────────────────────────────────────────────
function CompanyFields({ register, pricePerKm, totalKm }) {
  return (
    <div className="mt-3 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <IconInput icon={<Building2 className="w-3.5 h-3.5" />} placeholder="Empresa" className="bg-white" {...register('company.name')} />
        <IconInput icon={<Phone className="w-3.5 h-3.5" />} iconColor="text-slate-400" placeholder="+34 600 000 000" className="bg-white" {...register('company.contact')} />
        <IconInput icon={<Euro className="w-3.5 h-3.5" />} iconColor="text-emerald-500" placeholder="Precio (€)" type="number" step="0.01" className="bg-white" {...register('company.price')} />
        <IconInput icon={<Package className="w-3.5 h-3.5" />} iconColor="text-amber-500" placeholder="Mercancía" className="bg-white" {...register('company.cargo')} />
        <div className="col-span-2">
          <IconInput icon={<StickyNote className="w-3.5 h-3.5" />} iconColor="text-slate-400" placeholder="Referencia, instrucciones especiales…" className="bg-white" {...register('company.notes')} />
        </div>
      </div>
      {pricePerKm && (
        <div className="flex items-center gap-2 text-sm bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
          <Euro className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span className="text-slate-600">Precio por km:</span>
          <span className="font-bold text-emerald-700 text-base">{pricePerKm} €/km</span>
          <span className="text-slate-400 text-xs ml-auto">{totalKm} km totales</span>
        </div>
      )}
    </div>
  );
}

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
function SettingsModal({ apiKey, savedTags, onSaveTags, onSave, onClose }) {
  const { register, handleSubmit } = useForm({ defaultValues: { apiKey } });
  const [tab, setTab] = useState('api'); // 'api' | 'tags'

  return (
    <div className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col" style={{ maxHeight: '90vh', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
        <header className="px-6 py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center"><Settings className="w-5 h-5 text-slate-600" /></div>
            <div className="font-bold text-slate-900">Ajustes</div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl"><X className="w-5 h-5 text-slate-500" /></button>
        </header>

        {/* Tab bar */}
        <div className="flex border-b border-slate-200 flex-shrink-0">
          {[['api', <Key className="w-3.5 h-3.5" />, 'API de rutas'], ['tags', <TagIcon className="w-3.5 h-3.5" />, 'Etiquetas']].map(([id, icon, label]) => (
            <button key={id} type="button" onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition ${tab === id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {icon}{label}
            </button>
          ))}
        </div>

        {tab === 'api' && (
          <>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <Field label="API Key · OpenRouteService">
                <input {...register('apiKey')} placeholder="Pega tu API key aquí…" className={`${inputCls} font-mono`} />
              </Field>
              <div className="text-sm bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
                <div className="font-bold text-blue-900 flex items-center gap-2"><Sparkles className="w-4 h-4" />Cómo obtener la API key (gratis)</div>
                <ol className="list-decimal list-inside space-y-1 text-slate-700 pl-1">
                  <li>Ve a <span className="font-mono text-blue-700 bg-white px-1.5 py-0.5 rounded border border-blue-100">openrouteservice.org</span></li>
                  <li>Regístrate → "Request a token"</li>
                  <li>Copia la clave y pégala arriba</li>
                </ol>
                <div className="pt-2 border-t border-blue-200 text-xs space-y-1">
                  <div><span className="font-semibold text-amber-700">Sin key:</span> distancia estimada (línea recta × 1.3)</div>
                  <div><span className="font-semibold text-emerald-700">Con key:</span> ruta real por carretera para camiones HGV</div>
                </div>
              </div>
            </div>
            <footer className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 flex-shrink-0">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-xl font-medium">Cancelar</button>
              <button type="button" onClick={handleSubmit((d) => onSave(d.apiKey))} className="px-6 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold shadow-sm">Guardar</button>
            </footer>
          </>
        )}
        {tab === 'tags' && (
          <div className="flex-1 flex flex-col min-h-0">
            <TagManager tags={savedTags} onSave={onSaveTags} onClose={onClose} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TAG MANAGER ──────────────────────────────────────────────────────────────
function TagManager({ tags, onSave, onClose }) {
  const [list, setList] = useState(tags);
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState('blue');
  const [editingId, setEditingId] = useState(null);
  const inputRef = useRef(null);

  const addTag = () => {
    const label = newLabel.trim();
    if (!label) return;
    setList((p) => [...p, { id: uid(), label, color: newColor }]);
    setNewLabel('');
    // Cycle color for next tag
    const idx = COLOR_CYCLE.indexOf(newColor);
    setNewColor(COLOR_CYCLE[(idx + 1) % COLOR_CYCLE.length]);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const deleteTag = (id) => setList((p) => p.filter((t) => t.id !== id));

  const updateTag = (id, changes) => setList((p) => p.map((t) => t.id === id ? { ...t, ...changes } : t));

  const handleSave = () => { onSave(list); onClose(); };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto p-6 space-y-2 min-h-0">
        <p className="text-sm text-slate-500 mb-4">
          Cada etiqueta representa una empresa o tipo de trabajo. Haz clic en el color para cambiarlo.
        </p>

        {list.length === 0 && <p className="text-sm text-slate-400 italic py-4 text-center">Sin etiquetas todavía.</p>}
        {list.map((tag) => {
          const c = TAG_COLORS[tag.color] || TAG_COLORS.slate;
          const isEditing = editingId === tag.id;
          return (
            <div key={tag.id} className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
              {/* Color dot — click to cycle */}
              <button type="button"
                onClick={() => updateTag(tag.id, { color: COLOR_CYCLE[(COLOR_CYCLE.indexOf(tag.color) + 1) % COLOR_CYCLE.length] })}
                className={`w-7 h-7 rounded-full ${c.bg} flex-shrink-0 hover:scale-110 transition-transform ring-2 ring-white shadow-sm`}
                title="Cambiar color"
              />

              {/* Label */}
              {isEditing ? (
                <input
                  autoFocus
                  defaultValue={tag.label}
                  onBlur={(e) => { updateTag(tag.id, { label: e.target.value.trim() || tag.label }); setEditingId(null); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { updateTag(tag.id, { label: e.target.value.trim() || tag.label }); setEditingId(null); }
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  className="flex-1 px-2 py-1 text-sm border border-blue-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              ) : (
                <span className="flex-1 text-sm font-semibold text-slate-800">{tag.label}</span>
              )}

              {/* Preview badge */}
              <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${c.bg} ${c.text} flex-shrink-0`}>{tag.label}</span>

              {/* Actions — always visible */}
              <button type="button" onClick={() => setEditingId(tag.id)} className="p-1.5 hover:bg-blue-50 rounded-lg text-slate-400 hover:text-blue-600 transition flex-shrink-0" title="Renombrar">
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => deleteTag(tag.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition flex-shrink-0" title="Eliminar">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Add new — fixed above footer */}
      <div className="border-t border-slate-200 px-6 pt-4 pb-3 bg-white flex-shrink-0">
        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Nueva etiqueta</div>
        <div className="space-y-3">
          {/* Name — full width */}
          <input
            ref={inputRef}
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTag()}
            placeholder="ej. Mercadona, Urgente, Extra…"
            className={inputCls}
          />
          {/* Color row */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium flex-shrink-0">Color:</span>
            <div className="flex gap-2 flex-wrap">
              {COLOR_CYCLE.map((col) => {
                const c = TAG_COLORS[col];
                return (
                  <button key={col} type="button" onClick={() => setNewColor(col)}
                    className={`w-6 h-6 rounded-full ${c.bg} transition-transform ${newColor === col ? 'ring-2 ring-offset-1 ring-slate-600 scale-110' : 'hover:scale-105'}`}
                  />
                );
              })}
            </div>
            {newLabel && (
              <span className={`ml-auto px-2 py-0.5 rounded-md text-[11px] font-bold flex-shrink-0 ${TAG_COLORS[newColor].bg} ${TAG_COLORS[newColor].text}`}>
                {newLabel}
              </span>
            )}
          </div>
          {/* Add button — full width */}
          <button type="button" onClick={addTag}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition shadow-sm">
            <Plus className="w-4 h-4" /> Añadir etiqueta
          </button>
        </div>
      </div>

      {/* Sticky footer */}
      <footer className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 flex-shrink-0 shadow-[0_-2px_8px_rgba(0,0,0,0.05)]">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-xl font-medium">Cancelar</button>
        <button type="button" onClick={handleSave} className="px-6 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold shadow-sm">Guardar etiquetas</button>
      </footer>
    </div>
  );
}

// ─── CONFIRM ──────────────────────────────────────────────────────────────────
function ConfirmDialog({ title, message, confirmLabel, danger, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 flex items-start gap-4">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${danger ? 'bg-red-100' : 'bg-blue-100'}`}>
            <AlertCircle className={`w-5 h-5 ${danger ? 'text-red-600' : 'text-blue-600'}`} />
          </div>
          <div>
            <div className="font-bold text-slate-900 mb-1">{title}</div>
            <div className="text-sm text-slate-600 leading-relaxed space-y-1">
              {message.split('\n\n').map((p, i) => <p key={i}>{p}</p>)}
            </div>
          </div>
        </div>
        <div className="px-6 pb-6 flex gap-2 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition">Cancelar</button>
          <button onClick={onConfirm} className={`px-5 py-2 text-sm text-white rounded-xl font-bold transition ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PRIMITIVES ───────────────────────────────────────────────────────────────
const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition';

function Field({ label, children }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block">{label}</label>
      {children}
    </div>
  );
}

// Input with a leading icon baked in — icon sits inside the border, input text indented
function IconInput({ icon, iconColor = 'text-slate-400', className = '', inputRef, ...props }) {
  return (
    <div className="relative flex items-center">
      <span className={`absolute left-3 flex-shrink-0 pointer-events-none ${iconColor}`}>{icon}</span>
      <input
        ref={inputRef}
        className={`w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition ${className}`}
        {...props}
      />
    </div>
  );
}

function SectionLabel({ icon, label, note }) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
      <span className="text-slate-400">{icon}</span>
      {label}
      {note && <span className="font-normal normal-case text-slate-400 ml-1">· {note}</span>}
    </div>
  );
}

