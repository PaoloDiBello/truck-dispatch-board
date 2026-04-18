export const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition';

export function Field({ label, children }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block">{label}</label>
      {children}
    </div>
  );
}

export function IconInput({ icon, iconColor = 'text-slate-400', className = '', ...props }) {
  return (
    <div className="relative flex items-center">
      <span className={`absolute left-3 flex-shrink-0 pointer-events-none ${iconColor}`}>{icon}</span>
      <input
        className={`w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition ${className}`}
        {...props}
      />
    </div>
  );
}

export function SectionLabel({ icon, label, note }) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
      <span className="text-slate-400">{icon}</span>
      {label}
      {note && <span className="font-normal normal-case text-slate-400 ml-1">· {note}</span>}
    </div>
  );
}
