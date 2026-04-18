import { MapPin, ArrowRight, Clock, StickyNote, Truck, CheckCircle2 } from 'lucide-react';
import { TAG_COLORS } from '../constants';
import { daysBetween } from '../utils';

export function CellContent({ cell, spanning, savedTags }) {
  const routes = cell.routes || [];
  const tags   = cell.tags   || [];

  return (
    <div className="space-y-1.5">
      {cell.title && (
        <div className="px-2 py-1 bg-blue-600 rounded-md">
          <div className="font-bold text-xs text-white truncate leading-tight">{cell.title}</div>
        </div>
      )}

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map((tagId, i) => {
            const tag = savedTags?.find(t => t.id === tagId);
            if (!tag) return null;
            const c = TAG_COLORS[tag.color] || TAG_COLORS.slate;
            return <span key={i} className={`px-1.5 py-0.5 rounded-md text-[11px] font-bold ${c.bg} ${c.text}`}>{tag.label}</span>;
          })}
        </div>
      )}

      {spanning.map((r, i) => (
        r._spanType === 'transit'
          ? <TransitStrip key={`t${i}`} route={r} />
          : <ArrivalStrip key={`a${i}`} route={r} />
      ))}

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

function TransitStrip({ route }) {
  return (
    <div className="rounded-lg bg-amber-50 border border-amber-200 px-2 py-1.5 overflow-hidden">
      <div className="flex items-center gap-1 mb-1">
        <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">En ruta</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-amber-800 font-semibold truncate flex-shrink min-w-0">{route.origin}</span>
        <div className="flex-1 flex items-center gap-0.5 mx-1 min-w-0">
          <div className="flex-1 h-px bg-amber-300" />
          <Truck className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
          <div className="flex-1 h-px bg-amber-300" style={{ borderTop: '1px dashed #fcd34d', height: 0 }} />
        </div>
        <span className="text-[10px] text-amber-800 font-semibold truncate flex-shrink min-w-0">{route.destination}</span>
      </div>
    </div>
  );
}

function ArrivalStrip({ route }) {
  return (
    <div className="rounded-lg bg-emerald-50 border-l-[3px] border-l-emerald-500 border border-emerald-200 px-2 py-1.5">
      <div className="flex items-center gap-1 font-bold text-xs text-emerald-700">
        <CheckCircle2 className="w-3 h-3 flex-shrink-0" /> Llegada
        {route.arrivalTime && (
          <span className="ml-auto font-bold text-emerald-800 flex items-center gap-0.5">
            <Clock className="w-3 h-3" />{route.arrivalTime}
          </span>
        )}
      </div>
      <div className="text-xs text-slate-600 mt-0.5 truncate font-medium">
        {route.origin} → {route.destination}
      </div>
    </div>
  );
}
