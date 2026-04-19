import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Truck, CheckCircle2, Clock, ArrowRight, AlertTriangle, CalendarClock } from 'lucide-react';
import { toISODate } from '../utils';

function getToday() { return toISODate(new Date()); }
function getTomorrow() {
  const d = new Date(); d.setDate(d.getDate() + 1); return toISODate(d);
}
function getCurrentTime() {
  const n = new Date();
  return `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`;
}

export function LogisticsPanel({ routes, vehicles, onCellOpen }) {
  const [open, setOpen] = useState(true);
  const today = getToday();
  const tomorrow = getTomorrow();
  const now = getCurrentTime();

  const { overdue, arrivingToday, arrivingTomorrow, departingToday } = useMemo(() => {
    const overdue = [];
    const arrivingToday = [];
    const arrivingTomorrow = [];
    const departingToday = [];

    routes.forEach(r => {
      const v = vehicles.find(x => x.id === r.vehicle_id);
      const item = { route: r, vehicle: v };

      if (r.arrival_date === today) {
        if (r.arrival_time && r.arrival_time <= now) overdue.push(item);
        else arrivingToday.push(item);
      } else if (r.arrival_date === tomorrow) {
        arrivingTomorrow.push(item);
      }

      if (r.departure_date === today) {
        departingToday.push(item);
      }
    });

    const byTime = (a, b) => (a.route.arrival_time || '').localeCompare(b.route.arrival_time || '');
    overdue.sort(byTime);
    arrivingToday.sort(byTime);
    arrivingTomorrow.sort((a, b) => (a.route.arrival_time || '').localeCompare(b.route.arrival_time || ''));
    departingToday.sort((a, b) => (a.route.departure_time || '').localeCompare(b.route.departure_time || ''));

    return { overdue, arrivingToday, arrivingTomorrow, departingToday };
  }, [routes, vehicles, today, tomorrow, now]);

  const total = overdue.length + arrivingToday.length + arrivingTomorrow.length + departingToday.length;
  if (total === 0 && !open) return null;

  return (
    <div className="bg-white border-b border-slate-200 shadow-sm">
      {/* Panel header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-2 hover:bg-slate-50 transition text-left"
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <CalendarClock className="w-4 h-4 text-blue-500" />
          Panel de operaciones
          {overdue.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-md bg-red-100 text-red-700 text-[11px] font-bold">{overdue.length} vencido{overdue.length > 1 ? 's' : ''}</span>
          )}
          {total > 0 && overdue.length === 0 && (
            <span className="px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-700 text-[11px] font-bold">{total} evento{total > 1 ? 's' : ''}</span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {open && (
        <div className="px-5 pb-3 grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Overdue arrivals */}
          <Section
            icon={<AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
            title="Llegadas vencidas"
            color="red"
            items={overdue}
            type="arrival"
            onCellOpen={onCellOpen}
            emptyText="Ninguna"
          />

          {/* Arriving today */}
          <Section
            icon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
            title="Llegadas hoy"
            color="emerald"
            items={arrivingToday}
            type="arrival"
            onCellOpen={onCellOpen}
            emptyText="Ninguna prevista"
          />

          {/* Arriving tomorrow */}
          <Section
            icon={<Truck className="w-3.5 h-3.5 text-amber-500" />}
            title="Llegadas mañana"
            color="amber"
            items={arrivingTomorrow}
            type="arrival"
            onCellOpen={onCellOpen}
            emptyText="Ninguna prevista"
          />

          {/* Departing today */}
          <Section
            icon={<ArrowRight className="w-3.5 h-3.5 text-indigo-500" />}
            title="Salidas hoy"
            color="indigo"
            items={departingToday}
            type="departure"
            onCellOpen={onCellOpen}
            emptyText="Ninguna prevista"
          />
        </div>
      )}
    </div>
  );
}

const COLOR = {
  red:     { header: 'text-red-600',     badge: 'bg-red-50 border-red-100',     dot: 'bg-red-400',     pill: 'bg-red-100 text-red-700' },
  emerald: { header: 'text-emerald-600', badge: 'bg-emerald-50 border-emerald-100', dot: 'bg-emerald-400', pill: 'bg-emerald-100 text-emerald-700' },
  amber:   { header: 'text-amber-600',   badge: 'bg-amber-50 border-amber-100',  dot: 'bg-amber-400',   pill: 'bg-amber-100 text-amber-700' },
  indigo:  { header: 'text-indigo-600',  badge: 'bg-indigo-50 border-indigo-100', dot: 'bg-indigo-400', pill: 'bg-indigo-100 text-indigo-700' },
};

function Section({ icon, title, color, items, type, onCellOpen, emptyText }) {
  const c = COLOR[color];
  return (
    <div className={`rounded-xl border ${c.badge} p-3 flex flex-col gap-2`}>
      <div className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${c.header}`}>
        {icon}{title}
        {items.length > 0 && <span className={`ml-auto px-1.5 py-0.5 rounded-full text-[10px] font-bold ${c.pill}`}>{items.length}</span>}
      </div>
      {items.length === 0
        ? <p className="text-[11px] text-slate-400 italic">{emptyText}</p>
        : <div className="flex flex-col gap-1.5">
            {items.map(({ route: r, vehicle: v }) => (
              <button
                key={r.id}
                onClick={() => onCellOpen && onCellOpen(r.vehicle_id, type === 'arrival' ? r.arrival_date : r.departure_date)}
                className="text-left group rounded-lg hover:bg-white hover:shadow-sm transition p-1.5 -mx-1.5"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
                  <span className="text-[11px] font-bold text-slate-700 truncate group-hover:text-slate-900">
                    {v?.plate || '—'}
                  </span>
                  {v?.driver && <span className="text-[10px] text-slate-400 truncate hidden lg:block">{v.driver}</span>}
                  <span className={`ml-auto text-[10px] font-semibold flex-shrink-0 ${c.header}`}>
                    {type === 'arrival' ? r.arrival_time || '—' : r.departure_time || '—'}
                  </span>
                </div>
                <div className="flex items-center gap-0.5 mt-0.5 pl-3 text-[10px] text-slate-500 truncate">
                  <span className="truncate">{r.origin}</span>
                  <ArrowRight className="w-2 h-2 flex-shrink-0 text-slate-300" />
                  <span className="truncate">{r.destination}</span>
                </div>
              </button>
            ))}
          </div>
      }
    </div>
  );
}
