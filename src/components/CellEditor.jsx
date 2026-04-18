import { useState, useEffect, useRef } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { AddressInput } from './AddressInput';
import {
  Plus, Trash2, X, Clock, MapPin, Euro, Package, Phone, Building2,
  Truck, Calendar, Edit2, AlertCircle, ArrowRight, Calculator,
  StickyNote, Tag as TagIcon, User, Navigation, ChevronDown, Check, CheckCircle2,
} from 'lucide-react';
import { TAG_COLORS, COLOR_CYCLE } from '../constants';
import { uid, formatDateFull, toISODate, daysBetween, calculateDrivingTime, formatDuration, addMinutesToDateTime, getRouteDistance } from '../utils';
import { SectionLabel, IconInput } from './primitives';

export function CellEditor({ date, data, apiKey, savedTags, arrivingRoutes = [], onDismissNotif, onSave, onClear, onCancel, onAddTag, onDeleteTag, vehicleName, driverName }) {
  const defaultRoute = () => ({
    origin: '', destination: '',
    departureDate: toISODate(date), departureTime: '',
    arrivalDate: toISODate(date), arrivalTime: '',
    distanceKm: null, estimatedMinutes: null, source: null,
  });

  const { register, handleSubmit, control, watch, setValue, getValues, formState: { errors } } = useForm({
    defaultValues: {
      title:   data.title   || '',
      routes:  data.routes?.length ? data.routes : [defaultRoute()],
      notes:   data.notes   || '',
      tags:    data.tags    || [],
      company: data.company || {},
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'routes' });
  const [calculating, setCalculating]   = useState(-1);
  const [routeErrors, setRouteErrors]   = useState({});
  const [localNewTags, setLocalNewTags] = useState([]);
  const [showCompany, setShowCompany]   = useState(
    !!(data.company?.name || data.company?.contact || data.company?.price || data.company?.cargo || data.company?.notes)
  );
  const allTags = [...savedTags, ...localNewTags];

  const tags         = watch('tags');
  const routes       = watch('routes');
  const companyPrice = watch('company.price');
  const totalKm      = routes.reduce((s, r) => s + (Number(r.distanceKm) || 0), 0);
  const pricePerKm   = totalKm > 0 && companyPrice ? (parseFloat(companyPrice) / totalKm).toFixed(2) : null;

  const toggleTag = (tagId) => {
    const curr = getValues('tags');
    setValue('tags', curr.includes(tagId) ? curr.filter(t => t !== tagId) : [...curr, tagId]);
  };

  const calcRoute = async (idx) => {
    const r = getValues(`routes.${idx}`);
    if (!r.origin || !r.destination) {
      setRouteErrors(p => ({ ...p, [idx]: 'Introduce origen y destino' }));
      return;
    }
    setCalculating(idx);
    setRouteErrors(p => ({ ...p, [idx]: null }));
    const result = await getRouteDistance(r.origin, r.destination, apiKey);
    if (result) {
      const mins = calculateDrivingTime(result.distanceKm);
      setValue(`routes.${idx}.distanceKm`, result.distanceKm);
      setValue(`routes.${idx}.estimatedMinutes`, mins);
      setValue(`routes.${idx}.source`, result.source);
      const arr = addMinutesToDateTime(getValues(`routes.${idx}.departureDate`), getValues(`routes.${idx}.departureTime`), mins);
      if (arr) { setValue(`routes.${idx}.arrivalDate`, arr.date); setValue(`routes.${idx}.arrivalTime`, arr.time); }
    } else {
      setRouteErrors(p => ({ ...p, [idx]: 'No se pudo localizar alguna ciudad' }));
    }
    setCalculating(-1);
  };

  const onSubmit = (d) => {
    onSave({
      title:   (d.title || '').trim(),
      routes:  d.routes.filter(r => r.origin || r.destination),
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
        onClick={e => e.stopPropagation()}
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
              <button type="button" onClick={onClear}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-red-500 text-white rounded-xl text-xs font-semibold transition mr-1"
                title="Borrar todos los datos de este camión">
                <Trash2 className="w-3.5 h-3.5" /> Borrar
              </button>
            )}
            <button onClick={onCancel} className="p-2 hover:bg-white/20 rounded-xl transition">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </header>

        {/* Arriving routes alert */}
        {arrivingRoutes.length > 0 && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-3 space-y-2">
            <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs uppercase tracking-wider">
              <CheckCircle2 className="w-3.5 h-3.5" /> {arrivingRoutes.length === 1 ? 'Llegada pendiente de confirmar' : `${arrivingRoutes.length} llegadas pendientes`}
            </div>
            {arrivingRoutes.map(n => (
              <div key={n.id} className="flex items-center justify-between gap-2 bg-white border border-emerald-200 rounded-xl px-3 py-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-800 truncate">{n.route}</div>
                  <div className="text-xs text-emerald-700 font-medium">Hora prevista: {n.time}</div>
                </div>
                <button type="button" onClick={() => onDismissNotif?.(n.id)}
                  className="flex-shrink-0 px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-bold transition">
                  Confirmar
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">

            {/* Title + Tags */}
            <section className="space-y-3">
              <IconInput
                icon={<Edit2 className="w-3.5 h-3.5" />}
                iconColor="text-slate-400"
                {...register('title')}
                placeholder="Nombre del servicio"
                className="text-base font-semibold placeholder-slate-300"
              />
              <TagPicker
                savedTags={allTags}
                selectedIds={tags}
                onSelect={toggleTag}
                onCreateAndSelect={(label, newTag) => {
                  setLocalNewTags(p => [...p, newTag]);
                  onAddTag?.(newTag);
                  setValue('tags', [...getValues('tags'), newTag.id]);
                }}
                onDeleteTag={(id) => {
                  onDeleteTag?.(id);
                  setLocalNewTags(p => p.filter(t => t.id !== id));
                  setValue('tags', getValues('tags').filter(t => t !== id));
                }}
              />
            </section>

            {/* Routes */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <SectionLabel icon={<MapPin className="w-3.5 h-3.5" />} label="Rutas" note="máx. 3" />
                {fields.length < 3 && (
                  <button type="button" onClick={() => append(defaultRoute())}
                    className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-semibold">
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
                        {/* Origin → Destination */}
                        <div className="flex items-center gap-2">
                          <AddressInput
                            className="flex-1"
                            value={r.origin || ''}
                            onChange={(val) => setValue(`routes.${i}.origin`, val)}
                            placeholder="Origen"
                            apiKey={apiKey}
                            fullAddress
                            icon={<MapPin className="w-3.5 h-3.5" />}
                          />
                          <ArrowRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                          <AddressInput
                            className="flex-1"
                            value={r.destination || ''}
                            onChange={(val) => setValue(`routes.${i}.destination`, val)}
                            placeholder="Destino"
                            apiKey={apiKey}
                            fullAddress
                            icon={<Navigation className="w-3.5 h-3.5" />}
                          />
                        </div>

                        {/* Salida / Llegada columns */}
                        <div className="grid grid-cols-2 gap-3">
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
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5 px-1">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Llegada</span>
                            </div>
                            <div className="relative">
                              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                              <input type="date"
                              {...register(`routes.${i}.arrivalDate`, {
                                validate: v => !r.departureDate || v >= r.departureDate || 'La llegada no puede ser antes de la salida',
                              })}
                              min={r.departureDate}
                              className="w-full pl-8 pr-2 py-2 text-sm border border-slate-200 rounded-lg focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
                            </div>
                            {errors.routes?.[i]?.arrivalDate && (
                              <div className="flex items-center gap-1 text-xs text-red-600">
                                <AlertCircle className="w-3 h-3 flex-shrink-0" />{errors.routes[i].arrivalDate.message}
                              </div>
                            )}
                            <div className="relative">
                              <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                              <input type="time" {...register(`routes.${i}.arrivalTime`)} className="w-full pl-8 pr-2 py-2 text-sm border border-slate-200 rounded-lg focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
                            </div>
                          </div>
                        </div>

                        {/* Calculate */}
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-3">
                            <button type="button" onClick={() => calcRoute(i)} disabled={calculating === i}
                              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-40 font-medium transition">
                              <Calculator className="w-3.5 h-3.5" />
                              {calculating === i ? 'Calculando…' : 'Calcular ruta'}
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
                          <p className="text-[11px] text-slate-400 leading-tight">
                            Calcula distancia y estima la hora de llegada · máx. 90 km/h · pausa 45 min cada 4 h
                          </p>
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

            {/* Company — collapsible */}
            <section>
              <button type="button" onClick={() => setShowCompany(p => !p)}
                className="flex items-center gap-2 w-full text-left">
                <SectionLabel icon={<Building2 className="w-3.5 h-3.5" />} label="Datos de empresa" />
                <ChevronDown className={`w-4 h-4 text-slate-400 ml-auto transition-transform ${showCompany ? 'rotate-180' : ''}`} />
              </button>
              {showCompany && <CompanyFields register={register} pricePerKm={pricePerKm} totalKm={totalKm} />}
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
                <textarea {...register('notes')} placeholder="Notas, observaciones, incidencias…"
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition resize-none" rows={3} />
              </div>
            </section>
          </div>
        </div>

        {/* Footer */}
        <footer className="px-6 py-4 bg-white border-t-2 border-slate-100 flex justify-end gap-2 flex-shrink-0 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
          <button type="button" onClick={onCancel} className="px-5 py-2.5 text-sm text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition">
            Cancelar
          </button>
          <button type="button" onClick={() => handleSubmit(onSubmit)()}
            className="px-6 py-2.5 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold shadow-sm transition">
            Guardar cambios
          </button>
        </footer>
      </div>
    </div>
  );
}

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

function TagPicker({ savedTags, selectedIds, onSelect, onCreateAndSelect, onDeleteTag }) {
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
      {savedTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {savedTags.map(tag => {
            const c = TAG_COLORS[tag.color] || TAG_COLORS.slate;
            const active = selectedIds.includes(tag.id);
            return (
              <div key={tag.id} className="group relative">
                <button type="button" onClick={() => onSelect(tag.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${active ? `${c.bg} ${c.text} border-transparent shadow-sm` : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'}`}>
                  {active && <Check className="w-3 h-3 inline mr-1 -mt-0.5" />}{tag.label}
                </button>
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
      {creating ? (
        <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-200">
          <input ref={inputRef} value={newLabel} onChange={e => setNewLabel(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCreate(); } if (e.key === 'Escape') setCreating(false); }}
            placeholder="Nombre de la etiqueta"
            className="flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none min-w-0" />
          <div className="flex items-center gap-1">
            {COLOR_CYCLE.map(col => (
              <button key={col} type="button" onClick={() => setNewColor(col)}
                className={`w-4 h-4 rounded-full flex-shrink-0 ${TAG_COLORS[col].bg} transition-transform ${newColor === col ? 'scale-125 ring-2 ring-offset-1 ring-slate-300' : 'hover:scale-110 opacity-60 hover:opacity-100'}`} />
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
