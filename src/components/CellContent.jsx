import { Clock, StickyNote, Truck, CheckCircle2, ArrowRight } from 'lucide-react';
import { TAG_COLORS } from '../constants';

export function CellContent({ departing, spanning, dayNote, savedTags }) {
  const dayTags = (dayNote?.tags || []).map(id => savedTags?.find(t => t.id === id)).filter(Boolean);

  return (
    <div className="flex flex-col gap-1.5 h-full">
      {/* Day-level tags */}
      {dayTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {dayTags.map(tag => {
            const c = TAG_COLORS[tag.color] || TAG_COLORS.slate;
            return <span key={tag.id} className={`px-1.5 py-0.5 rounded text-[10px] font-bold leading-tight ${c.bg} ${c.text}`}>{tag.label}</span>;
          })}
        </div>
      )}

      {/* Spanning routes (transit / arrival) */}
      {spanning.map((r, i) => (
        r._spanType === 'transit'
          ? <TransitRow key={`s${i}`} route={r} savedTags={savedTags} />
          : <ArrivalRow key={`a${i}`} route={r} savedTags={savedTags} />
      ))}

      {/* Departing routes */}
      {departing.map((r, i) => (
        <DepartureRow key={`d${i}`} route={r} savedTags={savedTags} />
      ))}

      {/* Day note snippet */}
      {dayNote?.notes && (
        <div className="flex items-start gap-1 mt-auto pt-1 border-t border-slate-100">
          <StickyNote className="w-2.5 h-2.5 text-slate-300 flex-shrink-0 mt-px" />
          <span className="text-[10px] text-slate-400 italic line-clamp-1 leading-tight">{dayNote.notes}</span>
        </div>
      )}
    </div>
  );
}

// ── Tag pills for routes ──────────────────────────────────────────────────────
function RouteTags({ route, savedTags }) {
  const tags = (route.tags || []).map(id => savedTags?.find(t => t.id === id)).filter(Boolean);
  if (!tags.length) return null;
  return (
    <div className="flex flex-wrap gap-0.5 mt-0.5">
      {tags.map(tag => {
        const c = TAG_COLORS[tag.color] || TAG_COLORS.slate;
        return <span key={tag.id} className={`px-1 py-px rounded text-[9px] font-bold leading-tight ${c.bg} ${c.text}`}>{tag.label}</span>;
      })}
    </div>
  );
}

// ── Departure row ─────────────────────────────────────────────────────────────
function DepartureRow({ route, savedTags }) {
  const isMulti = route.departure_date && route.arrival_date && route.departure_date !== route.arrival_date;
  return (
    <div className="flex items-start gap-1.5 min-w-0">
      <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${isMulti ? 'bg-indigo-500' : 'bg-blue-500'}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 min-w-0">
          <span className={`text-[10px] font-bold px-1 py-px rounded flex-shrink-0 ${isMulti ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700'}`}>
            {isMulti ? 'Sal.' : 'Hoy'}
          </span>
          {route.origin || route.destination ? (
            <>
              <span className="text-[11px] font-semibold text-slate-700 truncate">{route.origin || '?'}</span>
              <ArrowRight className="w-2.5 h-2.5 text-slate-300 flex-shrink-0" />
              <span className="text-[11px] font-semibold text-slate-700 truncate">{route.destination || '?'}</span>
            </>
          ) : (
            <span className="text-[11px] italic text-slate-400 truncate">Sin ubicación</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-500">
          {route.departure_time && (
            <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5 text-slate-400" />{route.departure_time}</span>
          )}
          {route.distance_km != null && <span className="font-semibold">{route.distance_km} km</span>}
          {isMulti && route.arrival_date && <span className="text-indigo-600 font-semibold">→ {route.arrival_date}</span>}
        </div>
        <RouteTags route={route} savedTags={savedTags} />
      </div>
    </div>
  );
}

// ── Transit row ───────────────────────────────────────────────────────────────
function TransitRow({ route, savedTags }) {
  return (
    <div className="flex items-start gap-1.5 min-w-0">
      <Truck className="w-2.5 h-2.5 text-amber-500 flex-shrink-0 mt-1" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-[10px] font-bold px-1 py-px rounded bg-amber-100 text-amber-700 flex-shrink-0">En ruta</span>
          {route.origin || route.destination ? (
            <>
              <span className="text-[11px] font-semibold text-slate-600 truncate">{route.origin || '?'}</span>
              <ArrowRight className="w-2.5 h-2.5 text-slate-300 flex-shrink-0" />
              <span className="text-[11px] font-semibold text-slate-600 truncate">{route.destination || '?'}</span>
            </>
          ) : (
            <span className="text-[11px] italic text-slate-400 truncate">Sin ubicación</span>
          )}
        </div>
        {route.arrival_date && (
          <div className="text-[10px] text-amber-600 font-medium mt-0.5">
            ll. {route.arrival_date}{route.arrival_time && ` ${route.arrival_time}`}
          </div>
        )}
        <RouteTags route={route} savedTags={savedTags} />
      </div>
    </div>
  );
}

// ── Arrival row ───────────────────────────────────────────────────────────────
function ArrivalRow({ route, savedTags }) {
  return (
    <div className="flex items-start gap-1.5 min-w-0">
      <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-[10px] font-bold px-1 py-px rounded bg-emerald-100 text-emerald-700 flex-shrink-0">Llegada</span>
          {route.origin || route.destination ? (
            <>
              <span className="text-[11px] font-semibold text-slate-700 truncate">{route.origin || '?'}</span>
              <ArrowRight className="w-2.5 h-2.5 text-slate-300 flex-shrink-0" />
              <span className="text-[11px] font-semibold text-slate-700 truncate">{route.destination || '?'}</span>
            </>
          ) : (
            <span className="text-[11px] italic text-slate-400 truncate">Sin ubicación</span>
          )}
        </div>
        {route.arrival_time && (
          <div className="flex items-center gap-0.5 text-[10px] text-emerald-700 font-semibold mt-0.5">
            <Clock className="w-2.5 h-2.5" />{route.arrival_time}
          </div>
        )}
        <RouteTags route={route} savedTags={savedTags} />
      </div>
    </div>
  );
}
