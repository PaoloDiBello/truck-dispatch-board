import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { AddressInput } from './AddressInput';
import {
  Plus, Trash2, X, Clock, MapPin, Euro, Package, Phone, Building2,
  Truck, Calendar, Edit2, AlertCircle, ArrowRight, Calculator,
  StickyNote, User, Navigation, ChevronDown, Check, CheckCircle2,
  Tag as TagIcon, Save, CalendarDays, Bell,
} from 'lucide-react';
import { TAG_COLORS, COLOR_CYCLE, TAG_CATEGORIES, TAG_CATEGORY_KEYS, REMINDER_OPTIONS, MAX_SPEED, DRIVING_BEFORE_BREAK, BREAK_DURATION, DAILY_MAX_DRIVING, DAILY_EXT_DRIVING } from '../constants';

const CAT_ICONS = { vehiculo: Truck, ruta: Package, dia: CalendarDays };
import { uid, formatDateFull, toISODate, daysBetween, calculateDrivingTime, formatDuration, addMinutesToDateTime, getRouteDistance } from '../utils';
import { SectionLabel, IconInput } from './primitives';

// ─── MAIN PANEL ───────────────────────────────────────────────────────────────

export function CellEditor({
  vehicleId, date, vehicleName, driverName,
  departing, spanning, dayNote,
  savedTags, apiKey,
  arrivingRoutes = [], onDismissNotif,
  onRouteCreate, onRouteUpdate, onRouteDelete,
  onDayNoteSave,
  onClearDay, onClearAll,
  onAddTag, onDeleteTag,
  onClose,
}) {
  const [activeTab, setActiveTab]       = useState('routes');
  const [editingRoute, setEditingRoute] = useState(null);
  const [noteForm, setNoteForm]         = useState({ notes: dayNote?.notes || '', tags: dayNote?.tags || [] });
  const [savingNote, setSavingNote]     = useState(false);
  const [localNewTags, setLocalNewTags] = useState([]);

  const allTags   = [...savedTags, ...localNewTags];
  const allActive = [
    ...departing.map(r => ({ ...r, _spanType: 'departure' })),
    ...spanning,
  ].sort((a, b) => ({ departure: 0, transit: 1, arrival: 2 }[a._spanType] - { departure: 0, transit: 1, arrival: 2 }[b._spanType]));

  const notesDirty = noteForm.notes !== (dayNote?.notes || '') ||
    JSON.stringify(noteForm.tags) !== JSON.stringify(dayNote?.tags || []);

  const handleSave = async () => {
    if (notesDirty) {
      setSavingNote(true);
      await onDayNoteSave(noteForm.notes, noteForm.tags);
      setSavingNote(false);
    }
    onClose();
  };

  const handleTagCreate = (label, newTag) => {
    setLocalNewTags(p => [...p, newTag]);
    onAddTag?.(newTag);
  };

  const handleTagDelete = (id) => {
    onDeleteTag?.(id);
    setLocalNewTags(p => p.filter(t => t.id !== id));
    setNoteForm(p => ({ ...p, tags: p.tags.filter(t => t !== id) }));
  };

  return (
    <div className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: 'min(94vh, 860px)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── HEADER ── */}
        <header className="flex-shrink-0 bg-gradient-to-r from-blue-600 to-blue-700">
          <div className="px-6 pt-4 pb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <Truck className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-bold text-white text-base leading-tight">{vehicleName || 'Sin matrícula'}</div>
                <div className="text-xs text-blue-200 flex items-center gap-1.5 mt-0.5">
                  {driverName && <><User className="w-3 h-3" /><span>{driverName}</span><span className="text-blue-300">·</span></>}
                  <Calendar className="w-3 h-3" />
                  <span>{formatDateFull(date)}</span>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition flex-shrink-0">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          <div className="flex px-6 gap-0">
            <TabBtn active={activeTab === 'routes'} onClick={() => setActiveTab('routes')}>
              <MapPin className="w-3.5 h-3.5" />
              Rutas
              {allActive.length > 0 && (
                <span className={`ml-1.5 px-1.5 py-px rounded-full text-[10px] font-bold leading-none ${activeTab === 'routes' ? 'bg-blue-600 text-white' : 'bg-white/20 text-white'}`}>
                  {allActive.length}
                </span>
              )}
            </TabBtn>
            <TabBtn active={activeTab === 'notes'} onClick={() => setActiveTab('notes')}>
              <StickyNote className="w-3.5 h-3.5" />
              Anotaciones
              {notesDirty && <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 inline-block flex-shrink-0" />}
            </TabBtn>
          </div>
        </header>

        {/* ── ARRIVING ALERTS ── */}
        {arrivingRoutes.length > 0 && (
          <div className="bg-emerald-50 border-b-2 border-emerald-200 px-5 py-3 space-y-2 flex-shrink-0">
            <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs uppercase tracking-wider">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {arrivingRoutes.length === 1 ? 'Llegada pendiente de confirmar' : `${arrivingRoutes.length} llegadas pendientes`}
            </div>
            {arrivingRoutes.map(n => (
              <div key={n.id} className="flex items-center justify-between gap-3 bg-white border border-emerald-200 rounded-xl px-3 py-2.5">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-800 truncate">{n.route}</div>
                  <div className="text-xs text-emerald-700 font-medium mt-0.5">Hora prevista: {n.time}</div>
                </div>
                <button type="button" onClick={() => onDismissNotif?.(n.id)}
                  className="flex-shrink-0 px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-bold transition">
                  Confirmar llegada
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── TAB CONTENT ── */}
        <div className="flex-1 overflow-y-auto">

          {/* ════ TAB: RUTAS ════ */}
          {activeTab === 'routes' && (
            <div className="px-6 py-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  {allActive.length === 0
                    ? 'Sin rutas activas este día'
                    : `${allActive.length} ruta${allActive.length !== 1 ? 's' : ''} activa${allActive.length !== 1 ? 's' : ''} este día`}
                </p>
                {editingRoute !== 'new' && (
                  <button type="button" onClick={() => setEditingRoute('new')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition shadow-sm">
                    <Plus className="w-3.5 h-3.5" /> Nueva ruta
                  </button>
                )}
              </div>

              {allActive.length === 0 && editingRoute !== 'new' && (
                <button type="button" onClick={() => setEditingRoute('new')}
                  className="w-full py-8 border-2 border-dashed border-slate-200 rounded-xl hover:border-blue-300 hover:bg-blue-50/40 transition group text-center">
                  <Truck className="w-7 h-7 text-slate-200 group-hover:text-blue-300 mx-auto mb-2 transition" />
                  <div className="text-sm font-semibold text-slate-400 group-hover:text-blue-600 transition">
                    Añadir primera ruta de este día
                  </div>
                  <div className="text-xs text-slate-300 group-hover:text-blue-400 mt-1 transition">
                    La fecha de salida se pre-rellena con el día seleccionado
                  </div>
                </button>
              )}

              {allActive.map(route =>
                editingRoute === route.id
                  ? <RouteForm key={route.id} route={route} date={date} apiKey={apiKey}
                      allTags={allTags} onTagCreate={handleTagCreate} onTagDelete={handleTagDelete}
                      onSave={async (data) => { await onRouteUpdate(route.id, data); setEditingRoute(null); }}
                      onCancel={() => setEditingRoute(null)} />
                  : <RouteCard key={route.id} route={route} savedTags={allTags}
                      onEdit={() => setEditingRoute(route.id)}
                      onDelete={() => onRouteDelete(route.id)} />
              )}

              {editingRoute === 'new' && (
                <RouteForm route={null} date={date} apiKey={apiKey}
                  allTags={allTags} onTagCreate={handleTagCreate} onTagDelete={handleTagDelete}
                  onSave={async (data) => { await onRouteCreate(data); setEditingRoute(null); }}
                  onCancel={() => setEditingRoute(null)} />
              )}
            </div>
          )}

          {/* ════ TAB: NOTAS DEL DÍA ════ */}
          {activeTab === 'notes' && (
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <TagIcon className="w-3 h-3" /> Etiquetas del día
                </label>
                <TagPicker
                  savedTags={allTags}
                  selectedIds={noteForm.tags}
                  onSelect={(id) => setNoteForm(p => ({
                    ...p,
                    tags: p.tags.includes(id) ? p.tags.filter(t => t !== id) : [...p.tags, id],
                  }))}
                  onCreateAndSelect={(label, newTag) => {
                    handleTagCreate(label, newTag);
                    setNoteForm(p => ({ ...p, tags: [...p.tags, newTag.id] }));
                  }}
                  onDeleteTag={handleTagDelete}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <StickyNote className="w-3 h-3" /> Notas
                </label>
                <textarea
                  value={noteForm.notes}
                  onChange={e => setNoteForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Observaciones, incidencias, instrucciones especiales para este día…"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition resize-none placeholder-slate-300"
                  rows={5}
                  autoFocus
                />
              </div>
            </div>
          )}
        </div>

        {/* ── FOOTER ── */}
        {notesDirty ? (
          <footer className="px-6 py-4 bg-white border-t-2 border-slate-100 flex items-center justify-end gap-3 flex-shrink-0 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 text-sm text-slate-500 hover:bg-slate-100 rounded-xl font-medium transition">
              Descartar
            </button>
            <button type="button" onClick={handleSave} disabled={savingNote}
              className="flex items-center gap-2 px-6 py-2.5 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold shadow-sm transition disabled:opacity-60">
              <Save className="w-4 h-4" />
              {savingNote ? 'Guardando…' : 'Guardar notas'}
            </button>
          </footer>
        ) : null}
      </div>
    </div>
  );
}

// ── Tab button ────────────────────────────────────────────────────────────────
function TabBtn({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold transition-all rounded-t-xl ${
        active ? 'bg-white text-blue-700' : 'text-blue-200 hover:text-white hover:bg-white/10'
      }`}>
      {children}
    </button>
  );
}

// ─── ROUTE CARD ───────────────────────────────────────────────────────────────
const SPAN_CFG = {
  departure: { label: 'Salida',  chipCls: 'bg-blue-100 text-blue-700',       dot: 'bg-blue-500'    },
  transit:   { label: 'En ruta', chipCls: 'bg-amber-100 text-amber-700',     dot: 'bg-amber-500'   },
  arrival:   { label: 'Llegada', chipCls: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
};

function RouteCard({ route, savedTags, onEdit, onDelete }) {
  const cfg    = SPAN_CFG[route._spanType] || SPAN_CFG.departure;
  const isMulti = route.departure_date && route.arrival_date && route.departure_date !== route.arrival_date;
  const tags   = (route.tags || []).map(id => savedTags.find(t => t.id === id)).filter(Boolean);
  const hasReminder = (() => {
    const rem = route.reminder;
    if (!rem) return false;
    if (Array.isArray(rem.items)) return rem.items.length > 0;
    return rem.departure?.enabled || rem.arrival?.enabled;
  })();

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-100">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`flex-shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full ${cfg.chipCls}`}>
            {cfg.label}
          </span>
          {route.title && <span className="text-xs font-semibold text-slate-600 truncate">{route.title}</span>}
          {isMulti && (
            <span className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">
              {daysBetween(route.departure_date, route.arrival_date) + 1} días
            </span>
          )}
          {hasReminder && <Bell className="w-3 h-3 text-amber-500 flex-shrink-0" title="Recordatorio activo" />}
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button onClick={onEdit} className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
            <Edit2 className="w-3 h-3" /> Editar
          </button>
          <button onClick={onDelete} className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
            <Trash2 className="w-3 h-3" /> Borrar
          </button>
        </div>
      </div>
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
          <span className="text-sm font-semibold text-slate-800 truncate">{route.origin || '—'}</span>
          <ArrowRight className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
          <span className="text-sm font-semibold text-slate-800 truncate">{route.destination || '—'}</span>
        </div>
        <div className="flex items-center gap-4 text-xs mb-2">
          <span className="flex items-center gap-1.5 text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            <span className="text-slate-400">Sal.</span>
            <span className="font-semibold text-slate-700">{route.departure_date}</span>
            {route.departure_time && <span className="font-semibold text-slate-700">{route.departure_time}</span>}
          </span>
          {route.arrival_date && (
            <span className="flex items-center gap-1.5 text-slate-500">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-slate-400">Ll.</span>
              <span className="font-semibold text-slate-700">{route.arrival_date}</span>
              {route.arrival_time && <span className="font-semibold text-slate-700">{route.arrival_time}</span>}
            </span>
          )}
        </div>
        {(route.distance_km != null || route.company?.name || tags.length > 0) && (
          <div className="flex items-center gap-2 flex-wrap">
            {route.distance_km != null && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100">
                {route.distance_km} km · {formatDuration(route.estimated_minutes)}
              </span>
            )}
            {route.company?.name && (
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <Building2 className="w-3 h-3 text-slate-400" />{route.company.name}
                {route.company.price && <span className="text-emerald-700 font-semibold">· {route.company.price} €</span>}
              </span>
            )}
            {tags.map(tag => {
              const c = TAG_COLORS[tag.color] || TAG_COLORS.slate;
              return <span key={tag.id} className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${c.bg} ${c.text}`}>{tag.label}</span>;
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ROUTE FORM ───────────────────────────────────────────────────────────────

function RouteForm({ route, date, apiKey, allTags, onTagCreate, onTagDelete, onSave, onCancel }) {
  const isNew = !route;
  const def = route ?? {
    title: '', origin: '', destination: '',
    departure_date: toISODate(date), departure_time: '',
    arrival_date:   toISODate(date), arrival_time: '',
    distance_km: null, estimated_minutes: null, source: null,
    company: {}, tags: [],
    reminder: { items: [] },
  };

  const { register, handleSubmit, watch, setValue, getValues, formState: { errors } } = useForm({ defaultValues: def });
  const [calculating, setCalculating] = useState(false);
  const [calcPreview, setCalcPreview] = useState(null);
  const [calcError, setCalcError]     = useState(null);
  const [saving, setSaving]           = useState(false);
  const [showCompany, setShowCompany]   = useState(!!(route?.company?.name || route?.company?.price));
  const [showLaw, setShowLaw]           = useState(false);
  const [reminderItems, setReminderItems] = useState(() => {
    const rem = route?.reminder;
    if (!rem) return [];
    if (Array.isArray(rem.items)) return rem.items;
    // backward compat
    const legacy = [];
    if (rem.departure?.enabled) legacy.push({ id: 'dep', type: 'departure', minutesBefore: rem.departure.minutesBefore ?? 15, label: '' });
    if (rem.arrival?.enabled)   legacy.push({ id: 'arr', type: 'arrival',   minutesBefore: rem.arrival.minutesBefore   ?? 0,  label: '' });
    return legacy;
  });

  const depDate    = watch('departure_date');
  const depTime    = watch('departure_time');
  const distKm     = watch('distance_km');
  const estMins    = watch('estimated_minutes');
  const src        = watch('source');
  const tags       = watch('tags') || [];
  const price      = watch('company.price');
  const totalKm    = Number(distKm) || 0;
  const pricePerKm = totalKm > 0 && price ? (parseFloat(price) / totalKm).toFixed(2) : null;
  const calcRoute = async () => {
    const o = getValues('origin'), d = getValues('destination');
    if (!o || !d) { setCalcError('Introduce origen y destino primero'); return; }
    setCalculating(true); setCalcError(null); setCalcPreview(null);
    const res = await getRouteDistance(o, d, apiKey);
    if (res) {
      const mins = calculateDrivingTime(res.distanceKm);
      setValue('distance_km', res.distanceKm);
      setValue('estimated_minutes', mins);
      setValue('source', res.source);
      const dDate = getValues('departure_date');
      const dTime = getValues('departure_time');
      const arr = addMinutesToDateTime(dDate, dTime, mins);
      // Auto-apply arrival if departure time is set
      if (arr) { setValue('arrival_date', arr.date); setValue('arrival_time', arr.time); }
      setCalcPreview({ distanceKm: res.distanceKm, estimatedMinutes: mins, source: res.source, depDate: dDate, depTime: dTime, arrDate: arr?.date || null, arrTime: arr?.time || null });
    } else {
      setCalcError('No se pudo localizar alguna ciudad');
    }
    setCalculating(false);
  };

  const onSubmit = async (d) => {
    setSaving(true);
    await onSave({
      title: (d.title || '').trim(),
      origin: d.origin, destination: d.destination,
      departure_date: d.departure_date, departure_time: d.departure_time,
      arrival_date: d.arrival_date, arrival_time: d.arrival_time,
      distance_km: d.distance_km, estimated_minutes: d.estimated_minutes, source: d.source,
      company: { ...d.company, pricePerKm },
      tags: d.tags || [],
      reminder: { items: reminderItems },
    });
    setSaving(false);
  };

  // Compliance analysis
  const compliance = distKm ? (() => {
    const km = Number(distKm);
    const pureMins    = Math.round((km / MAX_SPEED) * 60);
    const breaksCount = Math.floor(pureMins / DRIVING_BEFORE_BREAK);
    const breaksMins  = breaksCount * BREAK_DURATION;
    let status = 'ok';
    if (pureMins > DAILY_EXT_DRIVING) status = 'exceeded';
    else if (pureMins > DAILY_MAX_DRIVING) status = 'extended';
    return { km, pureMins, breaksCount, breaksMins, totalMins: pureMins + breaksMins, status };
  })() : null;

  return (
    <div className="rounded-xl border-2 border-blue-300 overflow-hidden">
      {showLaw && <LawInfoModal onClose={() => setShowLaw(false)} />}

      <div className="flex items-center justify-between px-4 py-2.5 bg-blue-600">
        <span className="text-sm font-bold text-white">{isNew ? '+ Nueva ruta' : 'Editar ruta'}</span>
        <button type="button" onClick={onCancel} className="text-blue-200 hover:text-white hover:bg-white/20 rounded-lg p-1 transition">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4 bg-white">
        {/* Service name */}
        <IconInput icon={<Edit2 className="w-3.5 h-3.5" />} {...register('title')} placeholder="Nombre del servicio (opcional)" />

        {/* Trayecto */}
        <div>
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Trayecto</label>
          <div className="flex items-center gap-2">
            <AddressInput className="flex-1" value={watch('origin')} onChange={v => setValue('origin', v)}
              placeholder="Origen" apiKey={apiKey} fullAddress icon={<MapPin className="w-3.5 h-3.5" />} />
            <ArrowRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
            <AddressInput className="flex-1" value={watch('destination')} onChange={v => setValue('destination', v)}
              placeholder="Destino" apiKey={apiKey} fullAddress icon={<Navigation className="w-3.5 h-3.5" />} />
          </div>
        </div>

        {/* Salida / Llegada */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-400 flex-shrink-0" />
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Salida</span>
            </div>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input type="date" {...register('departure_date')} className="w-full pl-8 pr-2 py-2 text-sm border border-slate-200 rounded-lg focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none transition" />
            </div>
            <div className="relative">
              <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input type="time" {...register('departure_time', {
                onChange: (e) => {
                  const mins = getValues('estimated_minutes'), dep = getValues('departure_date');
                  if (mins && dep) { const arr = addMinutesToDateTime(dep, e.target.value, mins); if (arr) { setValue('arrival_date', arr.date); setValue('arrival_time', arr.time); } }
                },
              })} className="w-full pl-8 pr-2 py-2 text-sm border border-slate-200 rounded-lg focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none transition" />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
              <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Llegada</span>
            </div>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input type="date"
                {...register('arrival_date', { validate: v => !depDate || v >= depDate || 'La llegada no puede ser antes de la salida' })}
                min={depDate}
                className="w-full pl-8 pr-2 py-2 text-sm border border-slate-200 rounded-lg focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
            </div>
            {errors.arrival_date && (
              <div className="flex items-center gap-1 text-xs text-red-600 px-1">
                <AlertCircle className="w-3 h-3" />{errors.arrival_date.message}
              </div>
            )}
            <div className="relative">
              <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input type="time" {...register('arrival_time')} className="w-full pl-8 pr-2 py-2 text-sm border border-slate-200 rounded-lg focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
            </div>
          </div>
        </div>

        {/* ── CALCULATE BUTTON ── */}
        <button type="button" onClick={calcRoute} disabled={calculating}
          className="w-full flex items-center justify-center gap-2 py-2.5 text-sm border-2 border-dashed border-blue-200 text-blue-600 hover:border-blue-400 hover:bg-blue-50 rounded-xl font-semibold transition disabled:opacity-40">
          <Calculator className="w-4 h-4" />
          {calculating ? 'Calculando…' : 'Calcular distancia y horario de llegada'}
        </button>

        {/* ── CALC PREVIEW CARD ── */}
        {calcPreview && (
          <CalcResultCard
            preview={calcPreview}
            onDismiss={() => setCalcPreview(null)}
          />
        )}

        {calcError && (
          <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{calcError}
          </div>
        )}

        {/* ── COMPLIANCE STRIP ── */}
        {compliance && (
          <ComplianceStrip compliance={compliance} onShowLaw={() => setShowLaw(true)} />
        )}

        {/* Etiquetas */}
        <div>
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 block flex items-center gap-1.5">
            <TagIcon className="w-3 h-3" /> Etiquetas de esta ruta
          </label>
          <InlineTagPicker
            allTags={allTags}
            selectedIds={tags}
            onToggle={(id) => setValue('tags', tags.includes(id) ? tags.filter(t => t !== id) : [...tags, id])}
            onTagCreate={(label, tag) => { onTagCreate(label, tag); setValue('tags', [...tags, tag.id]); }}
            onTagDelete={(id) => { onTagDelete(id); setValue('tags', tags.filter(t => t !== id)); }}
          />
        </div>

        {/* ── REMINDERS ── */}
        <RouteReminders
          items={reminderItems}
          depDate={depDate}
          depTime={depTime}
          arrDate={watch('arrival_date')}
          arrTime={watch('arrival_time')}
          onAdd={item => setReminderItems(p => [...p, item])}
          onRemove={id => setReminderItems(p => p.filter(i => i.id !== id))}
        />

        {/* Company */}
        <div>
          <button type="button" onClick={() => setShowCompany(p => !p)}
            className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 font-semibold transition w-full text-left">
            <Building2 className="w-3.5 h-3.5" />
            Datos de empresa
            <ChevronDown className={`w-3.5 h-3.5 ml-auto transition-transform ${showCompany ? 'rotate-180' : ''}`} />
          </button>
          {showCompany && (
            <div className="mt-3 border border-slate-200 rounded-xl p-3 space-y-2 bg-slate-50">
              <div className="grid grid-cols-2 gap-2">
                <IconInput icon={<Building2 className="w-3.5 h-3.5" />} placeholder="Empresa" className="bg-white" {...register('company.name')} />
                <IconInput icon={<Phone className="w-3.5 h-3.5" />} iconColor="text-slate-400" placeholder="+34 600 000 000" className="bg-white" {...register('company.contact')} />
                <IconInput icon={<Euro className="w-3.5 h-3.5" />} iconColor="text-emerald-500" placeholder="Precio (€)" type="number" step="0.01" className="bg-white" {...register('company.price')} />
                <IconInput icon={<Package className="w-3.5 h-3.5" />} iconColor="text-amber-500" placeholder="Mercancía" className="bg-white" {...register('company.cargo')} />
                <div className="col-span-2">
                  <IconInput icon={<StickyNote className="w-3.5 h-3.5" />} iconColor="text-slate-400" placeholder="Referencia, instrucciones…" className="bg-white" {...register('company.notes')} />
                </div>
              </div>
              {pricePerKm && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                  <Euro className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span className="text-xs text-slate-600">€/km:</span>
                  <span className="font-bold text-emerald-700">{pricePerKm} €/km</span>
                  <span className="text-xs text-slate-400 ml-auto">{totalKm} km</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Form actions */}
        <div className="flex gap-2 pt-2 border-t border-slate-100">
          <button type="button" onClick={onCancel}
            className="flex-1 py-2.5 text-sm text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-xl font-semibold transition">
            Cancelar
          </button>
          <button type="button" onClick={() => handleSubmit(onSubmit)()} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold transition disabled:opacity-60">
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Guardando…' : isNew ? 'Crear ruta' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}


// ─── CALC RESULT CARD ─────────────────────────────────────────────────────────
function CalcResultCard({ preview, onDismiss }) {
  const { distanceKm, estimatedMinutes, source, depDate, depTime, arrDate, arrTime } = preview;
  const pureMins    = Math.round((distanceKm / MAX_SPEED) * 60);
  const breaksCount = Math.floor(pureMins / DRIVING_BEFORE_BREAK);
  const breaksMins  = breaksCount * BREAK_DURATION;

  const fmtDT = (dateStr, timeStr) => {
    if (!dateStr || !timeStr) return null;
    const d = new Date(dateStr + 'T00:00:00');
    const days = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    return `${days[d.getDay()]} ${formatDateFull(d)} · ${timeStr}`;
  };

  return (
    <div className="rounded-xl bg-blue-50 border border-blue-200 overflow-hidden">
      <div className="px-4 py-2.5 bg-blue-600 flex items-center justify-between">
        <div className="flex items-center gap-2 text-white font-bold text-sm">
          <Calculator className="w-3.5 h-3.5" />
          Resultado
          {source === 'APROX' && <span className="px-1.5 py-0.5 rounded-full bg-white/20 text-[11px] font-bold">ESTIMADO</span>}
        </div>
        <button type="button" onClick={onDismiss} className="text-white/60 hover:text-white transition p-1">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="p-3 space-y-3">
        {/* Stats row */}
        <div className="flex items-center gap-3">
          <div className="text-center flex-shrink-0 bg-white rounded-xl px-3 py-2 border border-blue-200">
            <div className="text-2xl font-black text-blue-700 leading-none">{distanceKm}</div>
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">km</div>
          </div>
          <div className="flex-1 space-y-1 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Conducción <span className="text-slate-400">({distanceKm}÷{MAX_SPEED}×60)</span></span>
              <span className="font-semibold">{formatDuration(pureMins)}</span>
            </div>
            {breaksCount > 0 && (
              <div className="flex justify-between text-amber-700">
                <span>{breaksCount}× pausa reglamentaria (45 min c/u)</span>
                <span className="font-semibold">+{formatDuration(breaksMins)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-800 font-bold border-t border-blue-200 pt-1">
              <span>Total</span>
              <span>{formatDuration(estimatedMinutes)}</span>
            </div>
          </div>
        </div>

        {/* Timeline */}
        {depDate && depTime ? (
          <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
            <div className="flex items-stretch gap-3 px-3 py-2.5">
              <div className="flex flex-col items-center gap-0.5 pt-1">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-400 flex-shrink-0" />
                <div className="w-px flex-1 bg-slate-200 min-h-[18px]" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0" />
              </div>
              <div className="flex-1 space-y-2.5">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Salida</div>
                  <div className="text-sm font-semibold text-slate-800">{fmtDT(depDate, depTime)}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Llegada estimada</div>
                  {arrDate && arrTime
                    ? <div className="text-sm font-semibold text-slate-800">{fmtDT(arrDate, arrTime)}</div>
                    : <div className="text-xs text-slate-400 italic">—</div>
                  }
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            Introduce hora de salida para calcular la llegada estimada
          </div>
        )}

        {/* Applied confirmation / prompt */}
        {arrDate && arrTime ? (
          <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
            Llegada aplicada: {arrDate} · {arrTime}
          </div>
        ) : depDate && depTime ? null : (
          <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            Introduce hora de salida para calcular y aplicar la llegada
          </div>
        )}
      </div>
    </div>
  );
}

// ─── COMPLIANCE STRIP ─────────────────────────────────────────────────────────
function ComplianceStrip({ compliance, onShowLaw }) {
  const { pureMins, breaksCount, breaksMins, totalMins, status } = compliance;
  const cfg = {
    ok:       { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: 'Dentro del límite diario' },
    extended: { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   badge: 'bg-amber-100 text-amber-700',   icon: <AlertCircle  className="w-3.5 h-3.5" />, label: 'Jornada ampliada (>9h, máx. 2×/sem)' },
    exceeded: { bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-700',     badge: 'bg-red-100 text-red-700',       icon: <AlertCircle  className="w-3.5 h-3.5" />, label: 'Excede el límite ampliado (>10h)' },
  }[status];

  return (
    <div className={`rounded-xl border ${cfg.border} ${cfg.bg} px-3 py-2.5`}>
      <div className="flex items-center gap-2">
        <span className={cfg.text}>{cfg.icon}</span>
        <span className={`text-xs font-semibold ${cfg.text}`}>{cfg.label}</span>
        <button type="button" onClick={onShowLaw}
          className="ml-auto flex items-center gap-1 text-[11px] text-slate-400 hover:text-blue-600 transition font-medium">
          <AlertCircle className="w-3 h-3" /> CE 561/2006
        </button>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-2 text-[11px]">
        <div className="bg-white/70 rounded-lg px-2 py-1.5 text-center">
          <div className="font-black text-slate-700">{formatDuration(pureMins)}</div>
          <div className="text-slate-400">conducción</div>
        </div>
        <div className="bg-white/70 rounded-lg px-2 py-1.5 text-center">
          <div className={`font-black ${breaksCount > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
            {breaksCount > 0 ? `${breaksCount}× 45min` : '—'}
          </div>
          <div className="text-slate-400">pausas</div>
        </div>
        <div className="bg-white/70 rounded-lg px-2 py-1.5 text-center">
          <div className="font-black text-slate-700">{formatDuration(totalMins)}</div>
          <div className="text-slate-400">total viaje</div>
        </div>
        <div className="bg-white/70 rounded-lg px-2 py-1.5 text-center">
          <div className="font-black text-indigo-600">9h min</div>
          <div className="text-slate-400">descanso</div>
        </div>
      </div>
    </div>
  );
}

// ─── LAW INFO MODAL ───────────────────────────────────────────────────────────
function LawInfoModal({ onClose }) {
  const sections = [
    { icon: <AlertCircle className="w-4 h-4 text-red-500" />, title: 'Pausa obligatoria', items: [
      'Tras 4 h 30 min de conducción continua — pausa de 45 min',
      'Puede dividirse: 15 min + 30 min (en ese orden)',
      'No sustituible por el descanso diario',
    ]},
    { icon: <Truck className="w-4 h-4 text-blue-500" />, title: 'Conducción diaria', items: [
      'Estándar: máximo 9 h al día',
      'Ampliado: hasta 10 h — máximo 2 veces por semana',
      'Solo cuenta el tiempo real al volante',
    ]},
    { icon: <Clock className="w-4 h-4 text-indigo-500" />, title: 'Descanso diario', items: [
      'Minimo 11 h consecutivas entre jornadas',
      'Reducido: mínimo 9 h — permitido hasta 3 veces por semana (sin compensación)',
      'Esta app usa 9 h como valor por defecto para el cálculo de descanso',
    ]},
    { icon: <Calendar className="w-4 h-4 text-slate-500" />, title: 'Conducción semanal', items: [
      'Máximo 56 h en una semana (lunes 00:00 a domingo 24:00)',
      'Máximo 90 h en dos semanas consecutivas',
    ]},
    { icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />, title: 'Descanso semanal', items: [
      'Ordinario: mínimo 45 h consecutivas',
      'Reducido: mínimo 24 h — compensación en las 3 semanas siguientes',
    ]},
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col" style={{ maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
        <header className="px-6 py-4 bg-gradient-to-r from-slate-700 to-slate-800 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-white">Reglamento CE nº 561/2006</div>
              <div className="text-xs text-slate-300">Tiempos de conducción y descanso · UE 2020/1054</div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition"><X className="w-5 h-5 text-white" /></button>
        </header>
        <div className="overflow-y-auto p-5 space-y-3">
          {sections.map(({ icon, title, items }) => (
            <div key={title} className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2 font-bold text-slate-700 text-xs uppercase tracking-wider">
                {icon}{title}
              </div>
              <ul className="px-4 py-3 space-y-1.5">
                {items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 flex-shrink-0 mt-2" />{item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="text-xs text-slate-400 text-center pt-1">
            Fuente: eur-lex.europa.eu · Regl. (CE) 561/2006 y (UE) 2020/1054
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── INLINE TAG PICKER ────────────────────────────────────────────────────────
function InlineTagPicker({ allTags, selectedIds, onToggle, onTagCreate, onTagDelete }) {
  const [creating, setCreating] = useState(false);
  const [label, setLabel]       = useState('');
  const [color, setColor]       = useState('blue');
  const [newCat, setNewCat]     = useState('ruta');
  const ref = useRef(null);

  useEffect(() => { if (creating) ref.current?.focus(); }, [creating]);

  const create = () => {
    const l = label.trim(); if (!l) return;
    const tag = { id: uid(), label: l, color, category: newCat };
    onTagCreate(l, tag);
    setLabel(''); setColor('blue'); setCreating(false);
  };

  const rutaTags     = allTags.filter(t => (t.category || 'ruta') === 'ruta');
  const vehiculoTags = allTags.filter(t => (t.category || 'ruta') === 'vehiculo');

  const TagPill = ({ tag }) => {
    const c = TAG_COLORS[tag.color] || TAG_COLORS.slate;
    const active = selectedIds.includes(tag.id);
    return (
      <div className="group relative">
        <button type="button" onClick={() => onToggle(tag.id)}
          className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${active ? `${c.bg} ${c.text} border-transparent shadow-sm` : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
          {active && <Check className="w-3 h-3 inline mr-1 -mt-0.5" />}{tag.label}
        </button>
        <button type="button"
          onMouseDown={e => { e.stopPropagation(); e.preventDefault(); onTagDelete(tag.id); }}
          className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full items-center justify-center hidden group-hover:flex">
          <X className="w-2.5 h-2.5" />
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-2.5">
      {(vehiculoTags.length > 0 || rutaTags.length > 0) && (
        <div className="grid grid-cols-2 gap-3">
          {vehiculoTags.length > 0 && (
            <div>
              <div className="flex items-center gap-1 mb-1.5">
                <Truck className="w-3 h-3 text-slate-300" />
                <span className="text-[10px] text-slate-400 font-medium">{TAG_CATEGORIES.vehiculo.label}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">{vehiculoTags.map(tag => <TagPill key={tag.id} tag={tag} />)}</div>
            </div>
          )}
          {rutaTags.length > 0 && (
            <div>
              <div className="flex items-center gap-1 mb-1.5">
                <Package className="w-3 h-3 text-slate-300" />
                <span className="text-[10px] text-slate-400 font-medium">{TAG_CATEGORIES.ruta?.label || 'Ruta'}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">{rutaTags.map(tag => <TagPill key={tag.id} tag={tag} />)}</div>
            </div>
          )}
        </div>
      )}
      {creating ? (
        <div className="flex flex-wrap items-center gap-1.5 px-2.5 py-2 bg-slate-50 rounded-xl border border-slate-200">
          <input ref={ref} value={label} onChange={e => setLabel(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); create(); } if (e.key === 'Escape') setCreating(false); }}
            placeholder="Nombre" className="w-24 bg-transparent text-xs outline-none text-slate-700 placeholder-slate-400" />
          <div className="flex gap-0.5">
            {TAG_CATEGORY_KEYS.map(cat => { const I = CAT_ICONS[cat]; return (
              <button key={cat} type="button" title={TAG_CATEGORIES[cat].label} onClick={() => setNewCat(cat)}
                className={`p-1 rounded ${newCat === cat ? 'bg-blue-100 text-blue-600' : 'text-slate-300 hover:text-slate-500'}`}>
                <I className="w-3 h-3" />
              </button>
            ); })}
          </div>
          <div className="flex gap-0.5">
            {COLOR_CYCLE.map(col => (
              <button key={col} type="button" onClick={() => setColor(col)}
                className={`w-3.5 h-3.5 rounded-full ${TAG_COLORS[col].bg} ${color === col ? 'scale-125 ring-1 ring-offset-1 ring-slate-300' : 'opacity-50 hover:opacity-100'}`} />
            ))}
          </div>
          <button type="button" onClick={create} disabled={!label.trim()} className={`px-2 py-0.5 rounded text-[11px] font-bold text-white disabled:opacity-40 ${TAG_COLORS[color]?.bg || 'bg-blue-500'}`}>OK</button>
          <button type="button" onClick={() => setCreating(false)} className="text-slate-400 hover:text-slate-600"><X className="w-3 h-3" /></button>
        </div>
      ) : (
        <button type="button" onClick={() => setCreating(true)}
          className="px-2.5 py-1 rounded-full text-xs font-semibold border border-dashed border-slate-300 text-slate-400 hover:border-blue-400 hover:text-blue-500 transition flex items-center gap-1">
          <Plus className="w-3 h-3" /> Nueva etiqueta
        </button>
      )}
    </div>
  );
}

// ─── ROUTE REMINDERS ──────────────────────────────────────────────────────────

function computeTrigger(dateStr, timeStr, minutesBefore) {
  if (!dateStr || !timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date(dateStr + 'T00:00:00');
  d.setHours(h, m - minutesBefore, 0, 0);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function RouteReminders({ items, depDate, depTime, arrDate, arrTime, onAdd, onRemove }) {
  const [adding, setAdding]   = useState(false);
  const [type, setType]       = useState('departure');
  const [mins, setMins]       = useState(15);
  const [label, setLabel]     = useState('');

  const eDate  = type === 'departure' ? depDate  : arrDate;
  const eTime  = type === 'departure' ? depTime  : arrTime;
  const trigger = eDate && eTime ? computeTrigger(eDate, eTime, mins) : null;

  const doAdd = () => {
    if (!type) return;
    onAdd({ id: String(Date.now()), type, minutesBefore: mins, label: label.trim() });
    setLabel(''); setMins(15); setAdding(false);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          <Bell className="w-3 h-3" /> Recordatorios
        </label>
        {!adding && (
          <button type="button" onClick={() => setAdding(true)}
            className="flex items-center gap-1 text-[11px] text-amber-600 hover:text-amber-700 font-semibold transition">
            <Plus className="w-3 h-3" /> Añadir
          </button>
        )}
      </div>

      {/* Existing items */}
      <div className="space-y-1.5">
        {items.map(item => {
          const isDep = item.type === 'departure';
          const iDate = isDep ? depDate  : arrDate;
          const iTime = isDep ? depTime  : arrTime;
          const t     = iDate && iTime ? computeTrigger(iDate, iTime, item.minutesBefore) : null;
          return (
            <div key={item.id}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2 border text-xs group transition-colors
                ${isDep ? 'bg-blue-50/60 border-blue-100 hover:border-blue-200' : 'bg-emerald-50/60 border-emerald-100 hover:border-emerald-200'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${isDep ? 'bg-blue-100' : 'bg-emerald-100'}`}>
                {isDep
                  ? <ArrowRight className="w-3 h-3 text-blue-600" />
                  : <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <span className={`font-semibold ${isDep ? 'text-blue-800' : 'text-emerald-800'}`}>
                  {item.label || (isDep ? 'Salida' : 'Llegada')}
                </span>
                {t && (
                  <span className={`ml-2 ${isDep ? 'text-blue-500' : 'text-emerald-600'}`}>
                    {item.minutesBefore > 0
                      ? `a las ${t} · ${formatDuration(item.minutesBefore)} antes`
                      : `a las ${t}`}
                  </span>
                )}
                {!iTime && <span className="ml-2 text-slate-400 italic">Sin hora definida</span>}
              </div>
              <button type="button" onClick={() => onRemove(item.id)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-100 text-slate-300 hover:text-red-500 transition flex-shrink-0">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          );
        })}

        {items.length === 0 && !adding && (
          <button type="button" onClick={() => setAdding(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400 hover:border-amber-300 hover:text-amber-500 transition">
            <Bell className="w-3.5 h-3.5" /> Sin recordatorios · Pulsa para añadir
          </button>
        )}
      </div>

      {/* Add form */}
      {adding && (
        <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50/40 p-3 space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Referencia</div>
              <select value={type} onChange={e => setType(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-amber-400">
                <option value="departure">Salida{depTime ? ` (${depTime})` : ''}</option>
                <option value="arrival">Llegada{arrTime ? ` (${arrTime})` : ''}</option>
              </select>
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Cuándo</div>
              <select value={mins} onChange={e => setMins(Number(e.target.value))}
                className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-amber-400">
                {REMINDER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <input value={label} onChange={e => setLabel(e.target.value)}
            placeholder="Etiqueta (opcional) · ej: Llamar al cliente"
            className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:border-amber-400" />
          {trigger && (
            <div className="flex items-center gap-2 text-[11px] text-slate-600 bg-white rounded-lg px-2.5 py-1.5 border border-slate-100">
              <Bell className="w-3 h-3 text-amber-500 flex-shrink-0" />
              Aviso a las <span className="font-bold text-slate-800 ml-1">{trigger}</span>
              {mins > 0 && <span className="text-slate-400 ml-1">· {formatDuration(mins)} antes de las {eTime}</span>}
            </div>
          )}
          <div className="flex gap-2 pt-0.5">
            <button type="button" onClick={() => { setAdding(false); setLabel(''); }}
              className="flex-1 py-1.5 text-xs text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 font-semibold transition">
              Cancelar
            </button>
            <button type="button" onClick={doAdd}
              className="flex-1 py-1.5 text-xs bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold transition">
              Añadir recordatorio
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DAY-LEVEL TAG PICKER ─────────────────────────────────────────────────────
function TagPicker({ savedTags, selectedIds, onSelect, onCreateAndSelect, onDeleteTag }) {
  const [creating, setCreating] = useState(false);
  const [label, setLabel]       = useState('');
  const [color, setColor]       = useState('blue');
  const [newCat, setNewCat]     = useState('dia');
  const ref = useRef(null);

  useEffect(() => { if (creating) ref.current?.focus(); }, [creating]);

  const create = () => {
    const l = label.trim(); if (!l) return;
    const tag = { id: uid(), label: l, color, category: newCat };
    onCreateAndSelect(l, tag);
    setLabel(''); setColor('blue'); setCreating(false);
  };

  const diaTags = savedTags.filter(t => (t.category || 'ruta') === 'dia');

  const TagPill = ({ tag }) => {
    const c = TAG_COLORS[tag.color] || TAG_COLORS.slate;
    const active = selectedIds.includes(tag.id);
    return (
      <div className="group relative">
        <button type="button" onClick={() => onSelect(tag.id)}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${active ? `${c.bg} ${c.text} border-transparent shadow-sm` : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
          {active && <Check className="w-3 h-3 inline mr-1 -mt-0.5" />}{tag.label}
        </button>
        {onDeleteTag && (
          <button type="button"
            onMouseDown={e => { e.stopPropagation(); e.preventDefault(); onDeleteTag(tag.id); }}
            className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full items-center justify-center hidden group-hover:flex">
            <X className="w-2.5 h-2.5" />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {diaTags.length > 0
        ? <div className="flex flex-wrap gap-1.5">{diaTags.map(tag => <TagPill key={tag.id} tag={tag} />)}</div>
        : !creating && <p className="text-xs text-slate-400 italic">No hay etiquetas de día. Crea una con el botón de abajo o en Ajustes.</p>
      }
      {creating ? (
        <div className="flex flex-wrap items-center gap-1.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
          <input ref={ref} value={label} onChange={e => setLabel(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); create(); } if (e.key === 'Escape') setCreating(false); }}
            placeholder="Nombre de la etiqueta"
            className="w-32 bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none min-w-0" />
          <div className="flex gap-0.5">
            {TAG_CATEGORY_KEYS.map(cat => { const I = CAT_ICONS[cat]; return (
              <button key={cat} type="button" title={TAG_CATEGORIES[cat].label} onClick={() => setNewCat(cat)}
                className={`p-1 rounded ${newCat === cat ? 'bg-blue-100 text-blue-600' : 'text-slate-300 hover:text-slate-500'}`}>
                <I className="w-3.5 h-3.5" />
              </button>
            ); })}
          </div>
          <div className="flex gap-1">
            {COLOR_CYCLE.map(col => (
              <button key={col} type="button" onClick={() => setColor(col)}
                className={`w-4 h-4 rounded-full ${TAG_COLORS[col].bg} ${color === col ? 'scale-125 ring-2 ring-offset-1 ring-slate-300' : 'opacity-50 hover:opacity-100'}`} />
            ))}
          </div>
          <button type="button" onClick={create} disabled={!label.trim()} className={`px-2.5 py-1 rounded-lg text-xs font-bold text-white disabled:opacity-40 ${TAG_COLORS[color]?.bg || 'bg-blue-500'}`}>Añadir</button>
          <button type="button" onClick={() => setCreating(false)} className="text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>
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
