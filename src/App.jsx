import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, Settings, X, Truck, Calendar, AlertCircle, CheckCircle2,
  ChevronLeft, ChevronRight, Bell, User, Search, MousePointerClick,
} from 'lucide-react';
import { CellEditor } from './components/CellEditor';
import { OpsBar } from './components/OpsBar';
import { CellContent } from './components/CellContent';
import { TrucksModal } from './components/TrucksModal';
import { SettingsModal } from './components/SettingsModal';
import { ConfirmDialog } from './components/ConfirmDialog';
import { RemindersPanel } from './components/RemindersPanel';
import { DAYS_ES, DEFAULT_TAGS, DEFAULT_VEHICLES } from './constants';
import { uid, formatDateFull, getWeekDates, toISODate, isSameDay } from './utils';
import {
  fetchVehicles, insertVehicle, updateVehicle as dbUpdateVehicle, deleteVehicle as dbDeleteVehicle,
  fetchRoutes, insertRoute, updateRoute as dbUpdateRoute, deleteRoute as dbDeleteRoute, deleteRoutesForVehicle,
  fetchDayNotes, upsertDayNote, deleteDayNotesForVehicle,
  fetchTags, insertTag, deleteTag as dbDeleteTag,
  fetchSetting, upsertSetting,
} from './lib/db';
import { subtractMinutesFromDateTime, formatDuration } from './utils';

export default function App() {
  const [vehicles, setVehicles]           = useState([]);
  const [routes, setRoutes]               = useState([]);
  const [dayNotes, setDayNotes]           = useState({});
  const [savedTags, setSavedTags]         = useState(DEFAULT_TAGS);
  const [weekOffset, setWeekOffset]       = useState(0);
  const [includeSaturday, setSat]         = useState(false);
  const [apiKey, setApiKey]               = useState('');
  const [dayPanel, setDayPanel]           = useState(null); // { vehicleId, date }
  const [showSettings, setShowSettings]   = useState(false);
  const [showTrucks, setShowTrucks]       = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [showReminders, setShowReminders]   = useState(false);
  const [loading, setLoading]             = useState(true);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [toast, setToast]                 = useState(null);
  const [filterText, setFilterText]       = useState('');
  const [dbError, setDbError]             = useState(null);
  const notifiedIds = useRef(new Set());

  const weekDates = getWeekDates(weekOffset, includeSaturday);

  // ── BROWSER NOTIFICATION PERMISSION ────────────────────────────────────────
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // ── LOAD FROM SUPABASE ──────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [vs, rs, dn, tgs, key, sat] = await Promise.all([
          fetchVehicles(),
          fetchRoutes(),
          fetchDayNotes(),
          fetchTags(),
          fetchSetting('apiKey'),
          fetchSetting('includeSaturday'),
        ]);
        setVehicles(vs.length ? vs : DEFAULT_VEHICLES.map(v => ({ ...v })));
        setRoutes(rs);
        setDayNotes(dn);
        setApiKey(key || import.meta.env.VITE_ORS_KEY || '');
        if (sat) setSat(sat === 'true');
        if (!vs.length) await Promise.all(DEFAULT_VEHICLES.map(v => insertVehicle(v)));
        // Always upsert default tags (ignoreDuplicates=true) so new defaults get added without overwriting user edits
        const existingIds = new Set(tgs.map(t => t.id));
        const missing = DEFAULT_TAGS.filter(t => !existingIds.has(t.id));
        if (missing.length) await Promise.all(missing.map(t => insertTag(t)));
        const finalTags = tgs.length ? [...tgs, ...missing] : DEFAULT_TAGS;
        setSavedTags(finalTags);
      } catch (err) {
        console.error('Supabase load error:', err);
        setDbError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── ARRIVAL NOTIFICATIONS ───────────────────────────────────────────────────
  const dismissNotif    = (id) => setNotifications(p => p.filter(n => n.id !== id));
  const dismissAllNotifs = ()  => setNotifications([]);

  useEffect(() => {
    const tick = setInterval(() => {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
      const today = toISODate(now);
      const newNotifs = [];

      routes.forEach(r => {
        if (!r.origin || !r.destination) return;
        const vehicle = vehicles.find(v => v.id === r.vehicle_id);

        // Reminder items (new array format + backward compat with old {departure,arrival} format)
        const reminderItems = (() => {
          const rem = r.reminder;
          if (!rem) return [];
          if (Array.isArray(rem.items)) return rem.items;
          const legacy = [];
          if (rem.departure?.enabled && r.departure_date && r.departure_time)
            legacy.push({ id: `dep_${r.id}`, type: 'departure', minutesBefore: rem.departure.minutesBefore ?? 15 });
          if (rem.arrival?.enabled && r.arrival_date && r.arrival_time)
            legacy.push({ id: `arr_${r.id}`, type: 'arrival', minutesBefore: rem.arrival.minutesBefore ?? 0 });
          return legacy;
        })();

        reminderItems.forEach(item => {
          const isDep  = item.type === 'departure';
          const eDate  = isDep ? r.departure_date : r.arrival_date;
          const eTime  = isDep ? r.departure_time : r.arrival_time;
          if (!eDate || !eTime) return;
          const trigger = subtractMinutesFromDateTime(eDate, eTime, item.minutesBefore ?? 0);
          const notifId = `rem_${r.id}_${item.id}`;
          if (trigger?.date === today && trigger.time <= currentTime && !notifiedIds.current.has(notifId)) {
            notifiedIds.current.add(notifId);
            const offset = item.minutesBefore ?? 0;
            const notif  = { id: notifId, vehicleId: r.vehicle_id, vehicle: vehicle?.plate || 'Camión', driver: vehicle?.driver || '', route: `${r.origin} → ${r.destination}`, time: eTime, type: item.type, minutesBefore: offset };
            newNotifs.push(notif);
            if ('Notification' in window && Notification.permission === 'granted') {
              const label = item.label || (isDep ? 'Salida' : 'Llegada');
              const title = offset > 0 ? `${label} en ${formatDuration(offset)} · ${notif.vehicle}` : `${label} · ${notif.vehicle}`;
              new Notification(title, { body: `${notif.route}\n${eTime}${notif.driver ? ` · ${notif.driver}` : ''}`, icon: '/favicon.ico' });
            }
          }
        });
      });

      if (newNotifs.length > 0) {
        setNotifications(p => [...p, ...newNotifs]);
        setShowNotifPanel(true);
      }
    }, 30000);
    return () => clearInterval(tick);
  }, [routes, vehicles]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  // ── VEHICLES ────────────────────────────────────────────────────────────────
  const addVehicle = async (data) => {
    const v = { id: uid(), plate: data.plate || '', driver: data.driver || '', position: vehicles.length };
    await insertVehicle(v);
    setVehicles(p => [...p, v]);
  };

  const updateVehicle = async (id, data) => {
    await dbUpdateVehicle(id, data);
    setVehicles(p => p.map(v => v.id === id ? { ...v, ...data } : v));
  };

  const reorderVehicles = async (newOrder) => {
    setVehicles(newOrder);
    await Promise.all(newOrder.map((v, i) => dbUpdateVehicle(v.id, { position: i })));
  };

  const deleteVehicle = (id) => {
    const v = vehicles.find(x => x.id === id);
    const routeCount = routes.filter(r => r.vehicle_id === id).length;
    const detail = routeCount > 0
      ? `Este camión tiene ${routeCount} ruta${routeCount !== 1 ? 's' : ''}. Todo se eliminará.`
      : 'Este camión no tiene rutas asignadas.';
    setConfirmDialog({
      title: 'Eliminar camión',
      message: `¿Eliminar "${v?.plate || 'este camión'}"?\n\n${detail}`,
      confirmLabel: 'Sí, eliminar',
      danger: true,
      onConfirm: async () => {
        await dbDeleteVehicle(id);
        setVehicles(p => p.filter(x => x.id !== id));
        setRoutes(p => p.filter(r => r.vehicle_id !== id));
        setDayNotes(p => {
          const n = { ...p };
          Object.keys(n).filter(k => k.startsWith(id + '_')).forEach(k => delete n[k]);
          return n;
        });
        setConfirmDialog(null);
        showToast('Camión eliminado');
      },
    });
  };

  // ── ROUTES ──────────────────────────────────────────────────────────────────
  const addRoute = async (vehicleId, routeData) => {
    const route = { id: uid(), vehicle_id: vehicleId, ...routeData };
    const saved = await insertRoute(route);
    setRoutes(p => [...p, saved]);
    return saved;
  };

  const updateRouteById = async (id, updates) => {
    const saved = await dbUpdateRoute(id, updates);
    setRoutes(p => p.map(r => r.id === id ? saved : r));
    return saved;
  };

  const deleteRouteById = async (id) => {
    await dbDeleteRoute(id);
    setRoutes(p => p.filter(r => r.id !== id));
  };

  const clearAllForVehicle = (vehicleId, plate) => {
    const routeCount = routes.filter(r => r.vehicle_id === vehicleId).length;
    const dnCount = Object.keys(dayNotes).filter(k => k.startsWith(vehicleId + '_')).length;
    const detail = routeCount > 0 || dnCount > 0
      ? `${routeCount} ruta${routeCount !== 1 ? 's' : ''} y ${dnCount} nota${dnCount !== 1 ? 's' : ''} de día.`
      : 'Sin datos asignados.';
    setConfirmDialog({
      title: 'Borrar todo',
      message: `¿Eliminar TODOS los datos de ${plate} de todas las semanas?\n\n${detail}\n\nEsta acción no se puede deshacer.`,
      confirmLabel: 'Sí, borrar todo',
      danger: true,
      onConfirm: async () => {
        await Promise.all([deleteRoutesForVehicle(vehicleId), deleteDayNotesForVehicle(vehicleId)]);
        setRoutes(p => p.filter(r => r.vehicle_id !== vehicleId));
        setDayNotes(p => {
          const n = { ...p };
          Object.keys(n).filter(k => k.startsWith(vehicleId + '_')).forEach(k => delete n[k]);
          return n;
        });
        setDayPanel(null);
        setConfirmDialog(null);
        showToast('Datos borrados');
      },
    });
  };

  const clearDayForVehicle = (vehicleId, date) => {
    const dateStr = toISODate(date);
    const dayRoutes = routes.filter(r => r.vehicle_id === vehicleId && r.departure_date === dateStr);
    const hasDayNote = !!dayNotes[`${vehicleId}_${dateStr}`];
    if (dayRoutes.length === 0 && !hasDayNote) return;
    setConfirmDialog({
      title: 'Borrar datos de este día',
      message: `¿Eliminar las ${dayRoutes.length} ruta${dayRoutes.length !== 1 ? 's' : ''} que salen este día y la nota del día? El historial del camión en otras fechas no se verá afectado.`,
      confirmLabel: 'Sí, borrar este día',
      danger: true,
      onConfirm: async () => {
        await Promise.all(dayRoutes.map(r => dbDeleteRoute(r.id)));
        if (hasDayNote) await upsertDayNote(vehicleId, dateStr, '', []);
        setRoutes(p => p.filter(r => !(r.vehicle_id === vehicleId && r.departure_date === dateStr)));
        setDayNotes(p => { const n = { ...p }; delete n[`${vehicleId}_${dateStr}`]; return n; });
        setConfirmDialog(null);
        showToast('Datos del día borrados');
      },
    });
  };

  // ── DAY NOTES ────────────────────────────────────────────────────────────────
  const saveDayNote = async (vehicleId, date, notes, tags) => {
    const dateStr = toISODate(date);
    await upsertDayNote(vehicleId, dateStr, notes, tags);
    setDayNotes(prev => ({ ...prev, [`${vehicleId}_${dateStr}`]: { notes, tags } }));
    showToast('Notas guardadas');
  };

  // ── DERIVED GETTERS ──────────────────────────────────────────────────────────
  const getRoutesForDay = useCallback((vehicleId, date) => {
    const dateStr = toISODate(date);
    const departing = routes.filter(r => r.vehicle_id === vehicleId && r.departure_date === dateStr);
    const spanning  = routes
      .filter(r => r.vehicle_id === vehicleId && r.departure_date < dateStr && r.arrival_date >= dateStr)
      .map(r => ({ ...r, _spanType: r.arrival_date === dateStr ? 'arrival' : 'transit' }));
    return { departing, spanning };
  }, [routes]);

  const getDayNote = useCallback((vehicleId, date) =>
    dayNotes[`${vehicleId}_${toISODate(date)}`] || { notes: '', tags: [] },
  [dayNotes]);

  // ── TAGS ─────────────────────────────────────────────────────────────────────
  const addTag = async (newTag) => {
    await insertTag({ ...newTag, position: savedTags.length });
    setSavedTags(p => [...p, newTag]);
  };

  const removeTag = async (id) => {
    await dbDeleteTag(id);
    setSavedTags(p => p.filter(t => t.id !== id));
  };

  const saveTags = async (tags) => {
    await Promise.all(savedTags.map(t => dbDeleteTag(t.id)));
    await Promise.all(tags.map((t, i) => insertTag({ ...t, position: i })));
    setSavedTags(tags);
    showToast('Etiquetas guardadas');
  };

  // ── SETTINGS ─────────────────────────────────────────────────────────────────
  const saveApiKey = async (key) => {
    await upsertSetting('apiKey', key);
    setApiKey(key);
    setShowSettings(false);
  };

  const toggleSaturday = async (val) => {
    setSat(val);
    await upsertSetting('includeSaturday', String(val));
  };

  const filteredVehicles = vehicles.filter(v => {
    if (!filterText) return true;
    const t = filterText.toLowerCase();
    return v.plate.toLowerCase().includes(t) || (v.driver || '').toLowerCase().includes(t);
  });

  // ── RENDER ───────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-slate-100">
      <div className="flex items-center gap-3 text-slate-500">
        <Truck className="w-5 h-5 animate-pulse text-blue-500" /> Cargando…
      </div>
    </div>
  );

  if (dbError) return (
    <div className="flex items-center justify-center h-screen bg-slate-100 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
        <div className="font-bold text-slate-900 text-lg">Error de conexión</div>
        <p className="text-sm text-slate-500">No se pudo conectar con la base de datos.</p>
        <code className="block text-xs bg-red-50 text-red-700 p-3 rounded-lg text-left break-all">{dbError}</code>
        <button onClick={() => window.location.reload()} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition">Reintentar</button>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-slate-100 text-slate-800" style={{ fontFamily: 'system-ui,-apple-system,sans-serif' }}>

      {/* HEADER */}
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
            <input value={filterText} onChange={e => setFilterText(e.target.value)}
              placeholder="Buscar matrícula o conductor…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition" />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowTrucks(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:border-blue-400 hover:text-blue-600 text-sm font-medium transition">
              <Truck className="w-4 h-4" /><span className="hidden sm:inline">Gestionar flota</span>
            </button>
            <button onClick={() => setShowReminders(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:border-amber-400 hover:text-amber-600 text-sm font-medium transition">
              <Bell className="w-4 h-4" /><span className="hidden sm:inline">Recordatorios</span>
            </button>
            {/* Notification badge */}
            <button
              onClick={() => setShowNotifPanel(p => !p)}
              className="relative p-2 hover:bg-slate-100 rounded-lg transition text-slate-400 hover:text-amber-500" title="Notificaciones">
              <Bell className="w-4 h-4" />
              {notifications.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                  {notifications.length > 9 ? '9+' : notifications.length}
                </span>
              )}
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
            <input type="checkbox" checked={includeSaturday} onChange={e => toggleSaturday(e.target.checked)} className="rounded accent-blue-600" />
            Incluir sábados
          </label>
        </div>
      </header>

      {/* OPS BAR */}
      <OpsBar
        routes={routes}
        vehicles={vehicles}
        onCellOpen={(vehicleId, dateStr) => {
          const date = new Date(dateStr + 'T00:00:00');
          setDayPanel({ vehicleId, date });
        }}
      />

      {/* GRID */}
      <div className="flex-1 overflow-auto">
        <table className="border-collapse" style={{ minWidth: `${220 + weekDates.length * 200}px`, width: '100%', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '220px' }} />
            {weekDates.map((_, i) => <col key={i} style={{ width: '200px' }} />)}
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
            {filteredVehicles.map((v, rowIdx) => {
              const isEven = rowIdx % 2 === 0;
              const rowBg = isEven ? 'bg-white' : 'bg-slate-50';
              const rowHoverBg = 'group-hover/row:bg-blue-50/40';
              return (
              <tr key={v.id} className="group/row">
                <td className={`sticky left-0 z-10 ${rowBg} ${rowHoverBg} border-b-2 border-r-2 border-slate-200 p-3 align-middle transition-colors shadow-[1px_0_0_0_rgba(0,0,0,0.02)]`}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
                      <Truck className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-slate-800 truncate" title={v.plate || ''}>
                        {v.plate || <span className="font-normal italic text-slate-400">Sin matrícula</span>}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 truncate" title={v.driver || ''}>
                        {v.driver ? <><User className="w-3 h-3 text-slate-400 flex-shrink-0" />{v.driver}</> : <span className="italic text-slate-400">Sin conductor</span>}
                      </div>
                      {(() => { const n = routes.filter(r => r.vehicle_id === v.id).length; return n > 0
                        ? <div className="text-[10px] text-slate-400 mt-0.5">{n} ruta{n !== 1 ? 's' : ''} en total</div>
                        : <div className="text-[10px] text-blue-400 mt-0.5 font-medium flex items-center gap-0.5"><MousePointerClick className="w-3 h-3" /> Pulsa un día para empezar</div>;
                      })()}
                    </div>
                  </div>
                </td>
                {weekDates.map((d, di) => {
                  const { departing, spanning } = getRoutesForDay(v.id, d);
                  const dayNote = getDayNote(v.id, d);
                  const isToday = isSameDay(d, new Date());
                  const hasContent = departing.length > 0 || spanning.length > 0 || dayNote.notes || dayNote.tags?.length > 0;
                  const vehicleHasAnyRoutes = routes.some(r => r.vehicle_id === v.id);
                  return (
                    <td key={di}
                      onClick={() => setDayPanel({ vehicleId: v.id, date: d })}
                      className={`border-b-2 border-r border-slate-200 p-2.5 align-top cursor-pointer transition-all relative group/cell ${isToday ? 'bg-blue-50/40 hover:bg-blue-50/80' : `${rowBg} ${rowHoverBg} hover:bg-blue-50/50`}`}
                      style={{ minHeight: '90px' }}>
                      {hasContent
                        ? <CellContent departing={departing} spanning={spanning} dayNote={dayNote} savedTags={savedTags} />
                        : (
                          <div className="h-full min-h-[80px] flex flex-col items-center justify-center gap-1 opacity-0 group-hover/cell:opacity-100 transition-opacity">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${isToday ? 'bg-blue-100' : 'bg-slate-100'}`}>
                              <Plus className={`w-3.5 h-3.5 ${isToday ? 'text-blue-500' : 'text-slate-400'}`} />
                            </div>
                            <span className={`text-[10px] font-medium text-center leading-tight ${isToday ? 'text-blue-400' : 'text-slate-400'}`}>
                              {isToday ? 'Añadir ruta\nde hoy' : 'Añadir ruta'}
                            </span>
                          </div>
                        )
                      }
                      {/* First-run hint: show on today's cell only if vehicle has zero routes ever */}
                      {!hasContent && !vehicleHasAnyRoutes && isToday && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 pointer-events-none">
                          <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                            <Plus className="w-3.5 h-3.5 text-blue-500" />
                          </div>
                          <span className="text-[10px] font-semibold text-blue-400 text-center leading-tight px-2">
                            Pulsa para añadir una ruta
                          </span>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
              );
            })}
            {filteredVehicles.length === 0 && (
              <tr>
                <td colSpan={weekDates.length + 1} className="py-20 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                      <Truck className="w-8 h-8 text-slate-300" />
                    </div>
                    {vehicles.length === 0 ? (
                      <>
                        <div className="font-semibold text-slate-700 text-base">Todavía no hay camiones</div>
                        <div className="text-sm text-slate-400 max-w-xs">Añade tu flota usando el botón <strong className="text-slate-600">Gestionar flota</strong> en la barra superior. Después pulsa cualquier celda del calendario para registrar rutas.</div>
                        <button onClick={() => setShowTrucks(true)} className="mt-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition shadow-sm flex items-center gap-2">
                          <Truck className="w-4 h-4" /> Añadir primer camión
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="font-semibold text-slate-600">Sin resultados para "{filterText}"</div>
                        <div className="text-sm text-slate-400">Prueba con la matrícula o nombre del conductor</div>
                        <button onClick={() => setFilterText('')} className="mt-1 text-xs text-blue-500 hover:underline">Limpiar búsqueda</button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>


      {/* REMINDERS PANEL */}
      {showReminders && (
        <RemindersPanel
          routes={routes}
          vehicles={vehicles}
          onRouteUpdate={updateRouteById}
          onClose={() => setShowReminders(false)}
        />
      )}

      {/* NOTIFICATION PANEL */}
      {showNotifPanel && (
        <div className="fixed top-16 right-4 z-50 w-[420px] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
          <div className={`flex items-center justify-between px-4 py-3 text-white ${notifications.length > 0 ? 'bg-emerald-600' : 'bg-slate-600'}`}>
            <div className="flex items-center gap-2 font-bold text-sm">
              <Bell className="w-4 h-4" />
              {notifications.length > 0 ? `Llegadas pendientes (${notifications.length})` : 'Notificaciones'}
            </div>
            <div className="flex items-center gap-1">
              {notifications.length > 0 && <button onClick={dismissAllNotifs} className="text-xs text-emerald-200 hover:text-white px-2 py-0.5 rounded hover:bg-white/20 transition">Limpiar todo</button>}
              <button onClick={() => setShowNotifPanel(false)} className="hover:bg-white/20 rounded-lg p-1 transition"><X className="w-4 h-4" /></button>
            </div>
          </div>
          {notifications.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <CheckCircle2 className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <div className="text-sm font-semibold text-slate-500">Todo al día</div>
              <div className="text-xs text-slate-400 mt-1">Las llegadas se notifican automáticamente cuando se cumple la hora prevista</div>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
              {notifications.map(n => (
                <div key={n.id} className="p-3 flex items-start gap-3 hover:bg-slate-50 transition">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${n.type === 'departure' ? 'bg-blue-100' : 'bg-emerald-100'}`}>
                    {n.type === 'departure'
                      ? <ArrowRight className="w-3.5 h-3.5 text-blue-600" />
                      : <Bell className="w-3.5 h-3.5 text-emerald-600" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-slate-800">{n.vehicle}{n.driver && <span className="font-normal text-slate-500"> · {n.driver}</span>}</div>
                    <div className="text-xs text-slate-600 mt-0.5 break-words">{n.route}</div>
                    <div className={`text-xs font-semibold mt-1 ${n.type === 'departure' ? 'text-blue-700' : 'text-emerald-700'}`}>
                      {n.type === 'departure'
                        ? (n.minutesBefore > 0 ? `Salida en ${formatDuration(n.minutesBefore)} · ${n.time}` : `Salida: ${n.time}`)
                        : (n.minutesBefore > 0 ? `Llegada en ${formatDuration(n.minutesBefore)} · ${n.time}` : `Llegada prevista: ${n.time}`)
                      }
                    </div>
                  </div>
                  <button onClick={() => dismissNotif(n.id)} className="text-slate-300 hover:text-red-400 transition flex-shrink-0 mt-0.5"><X className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODALS */}
      {showTrucks && (
        <TrucksModal vehicles={vehicles} onAdd={addVehicle} onUpdate={updateVehicle} onDelete={deleteVehicle} onReorder={reorderVehicles} onClose={() => setShowTrucks(false)} />
      )}
      {dayPanel && (() => {
        const { departing, spanning } = getRoutesForDay(dayPanel.vehicleId, dayPanel.date);
        const dayNote = getDayNote(dayPanel.vehicleId, dayPanel.date);
        const vehicle = vehicles.find(v => v.id === dayPanel.vehicleId);
        const arrivingNotifs = notifications.filter(n => n.vehicleId === dayPanel.vehicleId);
        return (
          <CellEditor
            vehicleId={dayPanel.vehicleId}
            date={dayPanel.date}
            vehicles={vehicles}
            vehicleName={vehicle?.plate || ''}
            driverName={vehicle?.driver || ''}
            departing={departing}
            spanning={spanning}
            dayNote={dayNote}
            savedTags={savedTags}
            apiKey={apiKey}
            arrivingRoutes={arrivingNotifs}
            onDismissNotif={dismissNotif}
            onRouteCreate={(data) => addRoute(dayPanel.vehicleId, data)}
            onRouteUpdate={updateRouteById}
            onRouteDelete={deleteRouteById}
            onDayNoteSave={(notes, tags) => saveDayNote(dayPanel.vehicleId, dayPanel.date, notes, tags)}
            onClearDay={() => clearDayForVehicle(dayPanel.vehicleId, dayPanel.date)}
            onClearAll={() => clearAllForVehicle(dayPanel.vehicleId, vehicle?.plate || 'este camión')}
            onAddTag={addTag}
            onDeleteTag={removeTag}
            onClose={() => setDayPanel(null)}
          />
        );
      })()}
      {showSettings && (
        <SettingsModal
          apiKey={apiKey}
          savedTags={savedTags}
          onSaveTags={saveTags}
          onSave={saveApiKey}
          onClose={() => setShowSettings(false)}
        />
      )}
      {confirmDialog && (
        <ConfirmDialog {...confirmDialog} onCancel={() => setConfirmDialog(null)} />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 pointer-events-none">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" /> {toast}
        </div>
      )}
    </div>
  );
}
