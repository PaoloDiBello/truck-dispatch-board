import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Settings, X, Clock, Truck, Calendar, AlertCircle, CheckCircle2,
  ChevronLeft, ChevronRight, Bell, User, Search, Gauge, MapPin,
} from 'lucide-react';
import { CellEditor } from './components/CellEditor';
import { CellContent } from './components/CellContent';
import { TrucksModal } from './components/TrucksModal';
import { SettingsModal } from './components/SettingsModal';
import { ConfirmDialog } from './components/ConfirmDialog';
import { DAYS_ES, DEFAULT_TAGS, DEFAULT_VEHICLES } from './constants';
import { uid, formatDateFull, getWeekDates, toISODate, isSameDay } from './utils';
import {
  fetchVehicles, insertVehicle, updateVehicle as dbUpdateVehicle, deleteVehicle as dbDeleteVehicle,
  fetchCells, upsertCell, deleteCellsForVehicle,
  fetchTags, insertTag, deleteTag as dbDeleteTag,
  fetchSetting, upsertSetting,
} from './lib/db';

export default function App() {
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
  const [dbError, setDbError]             = useState(null);

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
        const [vs, cs, tgs, key, sat] = await Promise.all([
          fetchVehicles(),
          fetchCells(),
          fetchTags(),
          fetchSetting('apiKey'),
          fetchSetting('includeSaturday'),
        ]);
        setVehicles(vs.length ? vs : DEFAULT_VEHICLES.map(v => ({ ...v })));
        setCells(cs);
        setSavedTags(tgs.length ? tgs : DEFAULT_TAGS);
        setApiKey(key || import.meta.env.VITE_ORS_KEY || '');
        if (sat) setSat(sat === 'true');
        // Seed default vehicles if none exist
        if (!vs.length) {
          await Promise.all(DEFAULT_VEHICLES.map(v => insertVehicle(v)));
        }
        // Seed default tags if none exist
        if (!tgs.length) {
          await Promise.all(DEFAULT_TAGS.map(t => insertTag(t)));
        }
      } catch (err) {
        console.error('Supabase load error:', err);
        setDbError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── ARRIVAL NOTIFICATIONS ───────────────────────────────────────────────────
  useEffect(() => {
    const tick = setInterval(() => {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
      const today = toISODate(now);
      Object.entries(cells).forEach(([key, cell]) => {
        cell.routes?.forEach(r => {
          if (r.arrivalDate === today && r.arrivalTime <= currentTime && !r._notified && r.origin && r.destination) {
            const vehicle = vehicles.find(v => v.id === key.split('_')[0]);
            const notifData = { vehicle: vehicle?.plate || 'Camión', driver: vehicle?.driver || '', route: `${r.origin} → ${r.destination}`, time: r.arrivalTime };
            setNotification(notifData);
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(`Llegada estimada · ${notifData.vehicle}`, {
                body: `${notifData.route}\nHora prevista: ${notifData.time}${notifData.driver ? ` · ${notifData.driver}` : ''}`,
                icon: '/favicon.ico',
              });
            }
            setCells(prev => ({
              ...prev,
              [key]: { ...prev[key], routes: prev[key].routes.map(rt => rt === r ? { ...rt, _notified: true } : rt) },
            }));
          }
        });
      });
    }, 30000);
    return () => clearInterval(tick);
  }, [cells, vehicles]);

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
    const assignedKeys = Object.keys(cells).filter(k => k.startsWith(id + '_') &&
      (cells[k].routes?.length || cells[k].notes || cells[k].tags?.length));
    const recordCount = assignedKeys.length;
    const routeCount  = assignedKeys.reduce((s, k) => s + (cells[k].routes?.length || 0), 0);
    const detail = recordCount > 0
      ? `Este camión tiene ${recordCount} día${recordCount !== 1 ? 's' : ''} con datos (${routeCount} ruta${routeCount !== 1 ? 's' : ''}). Todo se eliminará.`
      : 'Este camión no tiene datos asignados.';

    setConfirmDialog({
      title: 'Eliminar camión',
      message: `¿Eliminar "${v?.plate || 'este camión'}"?\n\n${detail}`,
      confirmLabel: 'Sí, eliminar',
      danger: true,
      onConfirm: async () => {
        await dbDeleteVehicle(id); // cascades cells via FK
        setVehicles(p => p.filter(x => x.id !== id));
        setCells(p => {
          const nc = { ...p };
          Object.keys(nc).filter(k => k.startsWith(id + '_')).forEach(k => delete nc[k]);
          return nc;
        });
        setConfirmDialog(null);
        showToast('Camión eliminado');
      },
    });
  };

  // ── CELLS ───────────────────────────────────────────────────────────────────
  const getCell = useCallback((vehicleId, date) =>
    cells[`${vehicleId}_${toISODate(date)}`] || { title: '', routes: [], notes: '', tags: [], company: {} },
  [cells]);

  const saveCell = async (vehicleId, date, data) => {
    const dateStr = toISODate(date);
    await upsertCell(vehicleId, dateStr, data);
    setCells(prev => ({ ...prev, [`${vehicleId}_${dateStr}`]: data }));
    showToast('Guardado');
  };

  const clearAllCells = async (vehicleId, plate) => {
    const daysWithData = Object.keys(cells).filter(k => k.startsWith(vehicleId + '_')).length;
    setConfirmDialog({
      title: 'Borrar todo',
      message: `¿Eliminar TODOS los datos de ${plate} de todas las semanas?${daysWithData > 0 ? ` (${daysWithData} día${daysWithData !== 1 ? 's' : ''} con datos)` : ''} Esta acción no se puede deshacer.`,
      confirmLabel: 'Sí, borrar todo',
      danger: true,
      onConfirm: async () => {
        await deleteCellsForVehicle(vehicleId);
        setCells(prev => {
          const nc = { ...prev };
          Object.keys(nc).filter(k => k.startsWith(vehicleId + '_')).forEach(k => delete nc[k]);
          return nc;
        });
        setEditingCell(null);
        setConfirmDialog(null);
        showToast('Datos borrados');
      },
    });
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

  // ── TAGS ────────────────────────────────────────────────────────────────────
  const addTag = async (newTag) => {
    await insertTag({ ...newTag, position: savedTags.length });
    setSavedTags(p => [...p, newTag]);
  };

  const removeTag = async (id) => {
    await dbDeleteTag(id);
    setSavedTags(p => p.filter(t => t.id !== id));
  };

  const saveTags = async (tags) => {
    // Delete all then re-insert with new positions
    await Promise.all(savedTags.map(t => dbDeleteTag(t.id)));
    await Promise.all(tags.map((t, i) => insertTag({ ...t, position: i })));
    setSavedTags(tags);
    showToast('Etiquetas guardadas');
  };

  // ── SETTINGS ────────────────────────────────────────────────────────────────
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

  // ── RENDER ──────────────────────────────────────────────────────────────────
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
        <p className="text-sm text-slate-500">No se pudo conectar con la base de datos. Comprueba que el schema de Supabase esté creado.</p>
        <code className="block text-xs bg-red-50 text-red-700 p-3 rounded-lg text-left break-all">{dbError}</code>
        <button onClick={() => window.location.reload()} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition">
          Reintentar
        </button>
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

      {/* GRID */}
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
            {filteredVehicles.map(v => (
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
                  const hasContent = cell.routes?.length || cell.tags?.length || cell.notes || spanning.length || cell.title;
                  return (
                    <td key={di}
                      onClick={() => setEditingCell({ vehicleId: v.id, date: d, data: cell })}
                      className={`border-b border-r border-slate-200 p-2 align-top cursor-pointer transition-colors relative group/cell ${isToday ? 'bg-blue-50/40 hover:bg-blue-50/70' : 'bg-white hover:bg-slate-50'}`}
                      style={{ height: '120px' }}>
                      {hasContent
                        ? <CellContent cell={cell} spanning={spanning} date={d} savedTags={savedTags} />
                        : <div className="h-full flex items-center justify-center">
                            <span className="text-xs text-slate-300 group-hover/cell:text-slate-400 flex items-center gap-1 transition-colors">
                              <Plus className="w-3 h-3" /> Añadir
                            </span>
                          </div>
                      }
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

      {/* FOOTER */}
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

      {/* MODALS */}
      {showTrucks && (
        <TrucksModal vehicles={vehicles} onAdd={addVehicle} onUpdate={updateVehicle} onDelete={deleteVehicle} onReorder={reorderVehicles} onClose={() => setShowTrucks(false)} />
      )}
      {editingCell && (
        <CellEditor
          vehicleId={editingCell.vehicleId} date={editingCell.date} data={editingCell.data}
          apiKey={apiKey}
          savedTags={savedTags}
          onSave={async (data) => { await saveCell(editingCell.vehicleId, editingCell.date, data); setEditingCell(null); }}
          onClear={() => {
            const plate = vehicles.find(v => v.id === editingCell.vehicleId)?.plate || 'este camión';
            clearAllCells(editingCell.vehicleId, plate);
          }}
          onAddTag={addTag}
          onDeleteTag={removeTag}
          onCancel={() => setEditingCell(null)}
          vehicleName={vehicles.find(v => v.id === editingCell.vehicleId)?.plate || ''}
          driverName={vehicles.find(v => v.id === editingCell.vehicleId)?.driver || ''}
        />
      )}
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
