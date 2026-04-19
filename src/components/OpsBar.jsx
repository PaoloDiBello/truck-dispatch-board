import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Truck, ArrowRight, Clock, CalendarCheck } from 'lucide-react';
import { toISODate } from '../utils';

function getToday() { return toISODate(new Date()); }
function getTomorrow() { const d = new Date(); d.setDate(d.getDate() + 1); return toISODate(d); }
function getNow() {
  const n = new Date();
  return `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`;
}

export function OpsBar({ routes, vehicles, onCellOpen }) {
  const today    = getToday();
  const tomorrow = getTomorrow();
  const now      = getNow();

  const events = useMemo(() => {
    const out = [];
    routes.forEach(r => {
      const v = vehicles.find(x => x.id === r.vehicle_id);

      if (r.arrival_date === today) {
        const overdue = r.arrival_time && r.arrival_time <= now;
        out.push({ id: r.id + '_arr', r, v, kind: overdue ? 'overdue' : 'arriving_today', time: r.arrival_time, dateStr: r.arrival_date });
      } else if (r.arrival_date === tomorrow) {
        out.push({ id: r.id + '_arr', r, v, kind: 'arriving_tomorrow', time: r.arrival_time, dateStr: r.arrival_date });
      }

      if (r.departure_date === today) {
        out.push({ id: r.id + '_dep', r, v, kind: 'departing', time: r.departure_time, dateStr: r.departure_date });
      }
    });

    // Sort: overdue first, then by time
    const order = { overdue: 0, arriving_today: 1, departing: 2, arriving_tomorrow: 3 };
    out.sort((a, b) => {
      const ko = order[a.kind] - order[b.kind];
      if (ko !== 0) return ko;
      return (a.time || '99:99').localeCompare(b.time || '99:99');
    });
    return out;
  }, [routes, vehicles, today, tomorrow, now]);

  if (events.length === 0) return (
    <div className="bg-white border-b border-slate-100 px-5 py-2.5 flex items-center gap-3">
      <CalendarCheck className="w-4 h-4 text-slate-300 flex-shrink-0" />
      <div>
        <span className="text-xs font-semibold text-slate-400">Sin operaciones hoy ni mañana</span>
        <span className="text-xs text-slate-300 ml-2">— Añade rutas con fecha de salida/llegada y aparecerán aquí automáticamente</span>
      </div>
    </div>
  );

  return (
    <div className="bg-white border-b border-slate-200 flex items-stretch overflow-hidden" style={{ minHeight: 48 }}>
      {/* Label */}
      <div className="flex-shrink-0 flex items-center px-4 border-r border-slate-100 bg-slate-50">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Operaciones</span>
      </div>

      {/* Scrollable event cards */}
      <div className="flex items-center gap-2 px-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {events.map(ev => <EventCard key={ev.id} ev={ev} onCellOpen={onCellOpen} />)}
      </div>
    </div>
  );
}

const KIND_CFG = {
  overdue:          { bg: 'bg-red-50',     border: 'border-red-300',    badge: 'bg-red-500 text-white',           icon: AlertTriangle,  label: 'Vencida',  dot: 'bg-red-500'     },
  arriving_today:   { bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-600 text-white',      icon: CheckCircle2,   label: 'Llega hoy', dot: 'bg-emerald-500' },
  departing:        { bg: 'bg-indigo-50',  border: 'border-indigo-200',  badge: 'bg-indigo-600 text-white',       icon: ArrowRight,     label: 'Sale hoy',  dot: 'bg-indigo-500'  },
  arriving_tomorrow:{ bg: 'bg-amber-50',   border: 'border-amber-200',   badge: 'bg-amber-500 text-white',        icon: Truck,          label: 'Llega mañana', dot: 'bg-amber-500' },
};

function EventCard({ ev, onCellOpen }) {
  const cfg   = KIND_CFG[ev.kind];
  const Icon  = cfg.icon;
  const plate = ev.v?.plate || '—';
  const driver = ev.v?.driver;

  return (
    <button
      type="button"
      onClick={() => onCellOpen(ev.r.vehicle_id, ev.dateStr)}
      className={`flex-shrink-0 flex items-center gap-2.5 px-3 py-2 my-1.5 rounded-xl border ${cfg.bg} ${cfg.border} hover:shadow-md hover:brightness-95 transition-all cursor-pointer text-left`}
    >
      {/* Badge */}
      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 ${cfg.badge}`}>
        <Icon className="w-2.5 h-2.5" />
        {cfg.label}
      </span>

      {/* Truck + route */}
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-slate-800 whitespace-nowrap">{plate}</span>
          {driver && <span className="text-[10px] text-slate-400 whitespace-nowrap hidden sm:block">{driver}</span>}
        </div>
        <div className="flex items-center gap-0.5 text-[10px] text-slate-500 whitespace-nowrap">
          {ev.r.origin || ev.r.destination ? (
            <>
              <span>{ev.r.origin || '?'}</span>
              <ArrowRight className="w-2 h-2 text-slate-300 flex-shrink-0" />
              <span>{ev.r.destination || '?'}</span>
            </>
          ) : (
            <span className="italic text-slate-400">Sin ubicación definida</span>
          )}
        </div>
      </div>

      {/* Time */}
      {ev.time && (
        <span className="flex items-center gap-0.5 text-[11px] font-bold text-slate-600 flex-shrink-0 ml-1">
          <Clock className="w-3 h-3 text-slate-400" />
          {ev.time}
        </span>
      )}
    </button>
  );
}
