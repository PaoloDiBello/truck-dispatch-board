import { useState, useMemo } from 'react';
import { X, Bell, BellOff, Clock, Calendar, Truck, ChevronDown, ChevronRight, Plus, Trash2, ArrowRight, CheckCircle2 } from 'lucide-react';
import { REMINDER_OPTIONS } from '../constants';
import { formatDuration, toISODate } from '../utils';
import { uid } from '../utils';

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function triggerTime(dateStr, timeStr, minutesBefore) {
  if (!dateStr || !timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date(dateStr + 'T00:00:00');
  d.setHours(h, m - minutesBefore, 0, 0);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${days[d.getDay()]} ${dd}/${mm}`;
}

function getReminderItems(reminder) {
  if (!reminder) return [];
  if (Array.isArray(reminder.items)) return reminder.items;
  // backward compat: old {departure, arrival} format
  const items = [];
  if (reminder.departure?.enabled) items.push({ id: 'dep', type: 'departure', minutesBefore: reminder.departure.minutesBefore ?? 15, label: '' });
  if (reminder.arrival?.enabled)   items.push({ id: 'arr', type: 'arrival',   minutesBefore: reminder.arrival.minutesBefore   ?? 0,  label: '' });
  return items;
}

const today = toISODate(new Date());

// ─── MAIN PANEL ───────────────────────────────────────────────────────────────

export function RemindersPanel({ routes, vehicles, onRouteUpdate, onClose }) {
  const [filter, setFilter]       = useState('upcoming');
  const [expandedId, setExpandedId] = useState(null);
  const [saving, setSaving]       = useState(null);

  const displayRoutes = useMemo(() => {
    const list = routes
      .filter(r => r.departure_date)
      .filter(r => filter === 'all' || r.departure_date >= today);
    list.sort((a, b) => {
      if (a.departure_date !== b.departure_date) return a.departure_date < b.departure_date ? -1 : 1;
      return (a.departure_time || '') < (b.departure_time || '') ? -1 : 1;
    });
    return list;
  }, [routes, filter]);

  const grouped = useMemo(() => {
    const map = new Map();
    displayRoutes.forEach(r => {
      const key = r.departure_date || 'Sin fecha';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    });
    return [...map.entries()];
  }, [displayRoutes]);

  const getVehicle = id => vehicles.find(v => v.id === id);

  const saveItems = async (route, items) => {
    setSaving(route.id);
    await onRouteUpdate(route.id, { reminder: { items } });
    setSaving(null);
  };

  const addItem = async (route, item) => {
    const items = [...getReminderItems(route.reminder), item];
    await saveItems(route, items);
    // update local route ref so UI reflects change immediately
    route.reminder = { items };
  };

  const removeItem = async (route, itemId) => {
    const items = getReminderItems(route.reminder).filter(i => i.id !== itemId);
    await saveItems(route, items);
    route.reminder = { items };
  };

  const totalActive = routes.reduce((n, r) => n + getReminderItems(r.reminder).length, 0);

  return (
    <div className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden"
        style={{ maxHeight: 'min(94vh, 780px)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex-shrink-0 bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                <Bell className="w-4.5 h-4.5 text-white" />
              </div>
              <div>
                <div className="font-bold text-white text-sm">Recordatorios</div>
                <div className="text-xs text-amber-100 mt-0.5">
                  {totalActive} recordatorio{totalActive !== 1 ? 's' : ''} configurado{totalActive !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition">
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
          <div className="flex gap-2 mt-3">
            {[['upcoming', 'Próximas'], ['all', 'Todas']].map(([val, label]) => (
              <button key={val} type="button" onClick={() => setFilter(val)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${filter === val ? 'bg-white text-amber-700' : 'text-amber-100 hover:bg-white/20'}`}>
                {label}
              </button>
            ))}
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {grouped.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
              <BellOff className="w-9 h-9 text-slate-200" />
              <div className="font-semibold text-slate-500">Sin rutas {filter === 'upcoming' ? 'próximas' : ''}</div>
              {filter === 'upcoming' && (
                <button type="button" onClick={() => setFilter('all')} className="text-xs text-blue-500 hover:underline">
                  Ver todas las rutas
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {grouped.map(([dateKey, dateRoutes]) => (
                <div key={dateKey}>
                  {/* Date header */}
                  <div className="px-5 py-2 bg-slate-50 flex items-center gap-2 sticky top-0 z-10 border-b border-slate-100">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {dateKey === 'Sin fecha' ? 'Sin fecha' : fmtDate(dateKey)}
                    </span>
                    {dateKey === today && (
                      <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px] font-bold">HOY</span>
                    )}
                  </div>
                  {dateRoutes.map(route => (
                    <RouteRow
                      key={route.id}
                      route={route}
                      vehicle={getVehicle(route.vehicle_id)}
                      expanded={expandedId === route.id}
                      saving={saving === route.id}
                      onToggle={() => setExpandedId(p => p === route.id ? null : route.id)}
                      onAdd={item => addItem(route, item)}
                      onRemove={id => removeItem(route, id)}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ROUTE ROW ────────────────────────────────────────────────────────────────

function RouteRow({ route, vehicle, expanded, saving, onToggle, onAdd, onRemove }) {
  const items = getReminderItems(route.reminder);
  const [adding, setAdding] = useState(false);
  const [newType, setNewType]     = useState('departure');
  const [newMins, setNewMins]     = useState(15);
  const [newLabel, setNewLabel]   = useState('');
  const [addSaving, setAddSaving] = useState(false);

  const handleAdd = async () => {
    setAddSaving(true);
    await onAdd({ id: uid(), type: newType, minutesBefore: newMins, label: newLabel.trim() });
    setAdding(false);
    setNewLabel('');
    setNewMins(15);
    setAddSaving(false);
  };

  const eventDate = newType === 'departure' ? route.departure_date : route.arrival_date;
  const eventTime = newType === 'departure' ? route.departure_time : route.arrival_time;
  const previewTrigger = eventDate && eventTime ? triggerTime(eventDate, eventTime, newMins) : null;

  return (
    <div className={`border-b border-slate-100 transition-colors ${expanded ? 'bg-slate-50/70' : 'hover:bg-slate-50/40'}`}>
      {/* Row header */}
      <button type="button" onClick={onToggle}
        className="w-full flex items-center gap-3 px-5 py-3.5 text-left">
        <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
          <Truck className="w-4 h-4 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-slate-800 truncate" title={`${route.origin || '—'} → ${route.destination || '—'}${route.title ? ` · ${route.title}` : ''}`}>
            {route.origin || '—'} <span className="text-slate-300 font-normal">→</span> {route.destination || '—'}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 truncate">
            <span className="font-mono font-semibold text-slate-600" title={vehicle?.plate || ''}>{vehicle?.plate || '—'}</span>
            {vehicle?.driver && <span className="truncate" title={vehicle.driver}>{vehicle.driver}</span>}
            {route.departure_time && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{route.departure_time}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {items.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[11px] font-bold">
              {items.length}
            </span>
          )}
          {saving
            ? <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            : expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />
          }
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-5 pb-4 space-y-3">
          {/* Existing items */}
          {items.length === 0 && !adding && (
            <div className="text-xs text-slate-400 py-1">Sin recordatorios para esta ruta.</div>
          )}
          {items.map(item => {
            const eDate = item.type === 'departure' ? route.departure_date : route.arrival_date;
            const eTime = item.type === 'departure' ? route.departure_time : route.arrival_time;
            const t = eDate && eTime ? triggerTime(eDate, eTime, item.minutesBefore) : null;
            const isDep = item.type === 'departure';
            return (
              <div key={item.id} className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 border text-xs ${isDep ? 'bg-blue-50 border-blue-200' : 'bg-emerald-50 border-emerald-200'}`}>
                {isDep
                  ? <ArrowRight className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                  : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                }
                <div className="flex-1 min-w-0">
                  <div className={`font-semibold truncate ${isDep ? 'text-blue-800' : 'text-emerald-800'}`} title={item.label || (isDep ? 'Salida' : 'Llegada')}>
                    {item.label || (isDep ? 'Salida' : 'Llegada')}
                  </div>
                  <div className={`text-[11px] mt-0.5 ${isDep ? 'text-blue-500' : 'text-emerald-600'}`}>
                    {t
                      ? item.minutesBefore > 0
                        ? `a las ${t} · ${formatDuration(item.minutesBefore)} antes de ${isDep ? 'la salida' : 'la llegada'} (${eTime})`
                        : `a las ${t} · en el momento de la ${isDep ? 'salida' : 'llegada'}`
                      : eTime ? `a las ${triggerTime(null, eTime, item.minutesBefore) || eTime}` : 'Sin hora definida'
                    }
                  </div>
                </div>
                <button type="button" onClick={() => onRemove(item.id)}
                  className="p-1 rounded-lg hover:bg-red-100 text-slate-400 hover:text-red-600 transition flex-shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}

          {/* Add form */}
          {adding ? (
            <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Referencia</div>
                  <select value={newType} onChange={e => setNewType(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-400">
                    <option value="departure">Salida {route.departure_time ? `(${route.departure_time})` : ''}</option>
                    <option value="arrival">Llegada {route.arrival_time ? `(${route.arrival_time})` : ''}</option>
                  </select>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Cuándo</div>
                  <select value={newMins} onChange={e => setNewMins(Number(e.target.value))}
                    className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-400">
                    {REMINDER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Etiqueta (opcional)</div>
                <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
                  placeholder="Ej: Llamar al cliente"
                  className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-400" />
              </div>
              {previewTrigger && (
                <div className="text-[11px] text-slate-500 bg-slate-50 rounded-lg px-2.5 py-1.5 border border-slate-100">
                  Aviso a las <span className="font-bold text-slate-700">{previewTrigger}</span>
                  {newMins > 0 && <span className="text-slate-400"> · {formatDuration(newMins)} antes de las {eventTime}</span>}
                </div>
              )}
              <div className="flex gap-2">
                <button type="button" onClick={() => setAdding(false)}
                  className="flex-1 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 font-semibold transition">
                  Cancelar
                </button>
                <button type="button" onClick={handleAdd} disabled={addSaving}
                  className="flex-1 py-1.5 text-xs bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-bold transition disabled:opacity-60">
                  {addSaving ? 'Guardando…' : 'Añadir'}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-700 font-semibold py-1 transition">
              <Plus className="w-3.5 h-3.5" /> Añadir recordatorio
            </button>
          )}
        </div>
      )}
    </div>
  );
}
