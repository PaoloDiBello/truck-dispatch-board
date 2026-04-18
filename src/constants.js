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

export const DEFAULT_TAGS = [
  { id: 'ups',     label: 'UPS',     color: 'amber',   position: 0 },
  { id: 'dsv',     label: 'DSV',     color: 'red',     position: 1 },
  { id: 'extra',   label: 'Extra',   color: 'purple',  position: 2 },
  { id: 'fiesta',  label: 'Fiesta',  color: 'emerald', position: 3 },
  { id: 'urgente', label: 'Urgente', color: 'orange',  position: 4 },
];

export const DEFAULT_VEHICLES = [
  { id: 'v1', plate: '9055MTB',  driver: 'Paquetero', position: 0 },
  { id: 'v2', plate: 'R0578BDJ', driver: '',          position: 1 },
  { id: 'v3', plate: '7228LMT',  driver: '',          position: 2 },
];
