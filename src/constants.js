export const MAX_SPEED = 90;
export const DRIVING_BEFORE_BREAK = 4 * 60;
export const BREAK_DURATION = 45;
export const DAYS_ES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export const TAG_COLORS = {
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

export const COLOR_CYCLE = ['amber','red','purple','emerald','orange','blue','pink','cyan','slate','indigo'];

// Tag categories
export const TAG_CATEGORIES = {
  vehiculo: { label: 'Vehículo',  hint: 'Estado del camión',          icon: '🚛' },
  ruta:     { label: 'Ruta',      hint: 'Tipo o estado del servicio',  icon: '📦' },
  dia:      { label: 'Día',       hint: 'Contexto del día',            icon: '📅' },
};
export const TAG_CATEGORY_KEYS = ['vehiculo', 'ruta', 'dia'];

export const DEFAULT_TAGS = [
  { id: 'ups',        label: 'UPS',            color: 'amber',   position: 0,  category: 'ruta'     },
  { id: 'dsv',        label: 'DSV',            color: 'red',     position: 1,  category: 'ruta'     },
  { id: 'extra',      label: 'Extra',          color: 'purple',  position: 2,  category: 'dia'      },
  { id: 'urgente',    label: 'Urgente',        color: 'orange',  position: 3,  category: 'dia'      },
  { id: 'retraso',    label: 'Retraso',        color: 'red',     position: 4,  category: 'ruta'     },
  { id: 'mantenim',   label: 'Mantenimiento',  color: 'amber',   position: 5,  category: 'vehiculo' },
  { id: 'averia',     label: 'Avería',         color: 'red',     position: 6,  category: 'vehiculo' },
  { id: 'revision',   label: 'ITV/Revisión',   color: 'indigo',  position: 7,  category: 'vehiculo' },
  { id: 'festivo',    label: 'Festivo',        color: 'emerald', position: 8,  category: 'dia'      },
  { id: 'lluvia',     label: 'Mal tiempo',     color: 'cyan',    position: 9,  category: 'dia'      },
  { id: 'trafico',    label: 'Tráfico denso',  color: 'slate',   position: 10, category: 'dia'      },
];

export const DEFAULT_VEHICLES = [
  { id: 'v1', plate: '9055MTB',  driver: 'Paquetero', position: 0 },
  { id: 'v2', plate: 'R0578BDJ', driver: '',          position: 1 },
  { id: 'v3', plate: '7228LMT',  driver: '',          position: 2 },
];
