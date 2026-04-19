import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Settings, X, Key, Plus, Trash2, Check, Truck, Package, CalendarDays } from 'lucide-react';
import { TAG_COLORS, COLOR_CYCLE, TAG_CATEGORIES, TAG_CATEGORY_KEYS } from '../constants';
import { uid } from '../utils';
import { inputCls } from './primitives';

const CAT_ICONS = { vehiculo: Truck, ruta: Package, dia: CalendarDays };

export function SettingsModal({ apiKey, savedTags, onSaveTags, onSave, onClose }) {
  const { register, handleSubmit } = useForm({ defaultValues: { apiKey } });
  const [tab, setTab] = useState('tags');

  return (
    <div className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col" style={{ maxHeight: '90vh', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        <header className="px-6 py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
              <Settings className="w-5 h-5 text-slate-600" />
            </div>
            <div className="font-bold text-slate-900">Ajustes</div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><X className="w-5 h-5" /></button>
        </header>

        <div className="flex border-b border-slate-200 px-6 flex-shrink-0">
          {[['tags', 'Etiquetas'], ['api', 'API']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors -mb-px ${tab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'api' && (
          <form onSubmit={handleSubmit(d => onSave(d.apiKey))} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <div>
                <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                  <Key className="w-4 h-4 text-slate-400" /> OpenRouteService API Key
                </label>
                <input {...register('apiKey')} placeholder="Pega tu API key aquí" className={inputCls} />
                <p className="text-xs text-slate-400 mt-2">
                  Opcional. Sin API key el cálculo de distancias es aproximado (Haversine × 1.3).
                  Con key se usa OpenRouteService con rutas reales para camiones HGV.
                </p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end flex-shrink-0">
              <button type="submit" className="px-5 py-2.5 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold shadow-sm transition">
                Guardar ajustes
              </button>
            </div>
          </form>
        )}

        {tab === 'tags' && (
          <TagManager savedTags={savedTags} onSaveTags={onSaveTags} />
        )}
      </div>
    </div>
  );
}

function TagManager({ savedTags, onSaveTags }) {
  const [tags, setTags]         = useState(savedTags);
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState('blue');
  const [newCategory, setNewCategory] = useState('ruta');
  const [editingId, setEditingId] = useState(null);
  const [editLabel, setEditLabel] = useState('');

  const byCategory = (cat) => tags.filter(t => (t.category || 'ruta') === cat);

  const add = () => {
    const label = newLabel.trim();
    if (!label) return;
    setTags(p => [...p, { id: uid(), label, color: newColor, category: newCategory, position: p.length }]);
    setNewLabel('');
  };

  const remove    = (id) => setTags(p => p.filter(t => t.id !== id));
  const startEdit = (tag) => { setEditingId(tag.id); setEditLabel(tag.label); };
  const saveEdit  = (id) => {
    const label = editLabel.trim();
    if (label) setTags(p => p.map(t => t.id === id ? { ...t, label } : t));
    setEditingId(null);
  };
  const setColor    = (id, col) => setTags(p => p.map(t => t.id === id ? { ...t, color: col } : t));
  const setCategory = (id, cat) => setTags(p => p.map(t => t.id === id ? { ...t, category: cat } : t));

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
        <p className="text-xs text-slate-400 leading-relaxed">
          Organiza las etiquetas en categorías para encontrarlas más fácilmente al añadir rutas o anotaciones de día.
        </p>

        {TAG_CATEGORY_KEYS.map(cat => {
          const cfg  = TAG_CATEGORIES[cat];
          const Icon = CAT_ICONS[cat];
          const list = byCategory(cat);
          return (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">{cfg.label}</span>
                <span className="text-[10px] text-slate-400">— {cfg.hint}</span>
                {list.length > 0 && <span className="ml-auto text-[10px] text-slate-400">{list.length}</span>}
              </div>
              <div className="space-y-1.5">
                {list.length === 0 && (
                  <p className="text-xs text-slate-300 italic pl-1">Sin etiquetas en esta categoría</p>
                )}
                {list.map(tag => {
                  const c = TAG_COLORS[tag.color] || TAG_COLORS.slate;
                  return (
                    <div key={tag.id} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${c.bg}`} />
                      {editingId === tag.id ? (
                        <input autoFocus value={editLabel}
                          onChange={e => setEditLabel(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveEdit(tag.id); if (e.key === 'Escape') setEditingId(null); }}
                          onBlur={() => saveEdit(tag.id)}
                          className="flex-1 text-sm bg-white border border-blue-300 rounded-lg px-2 py-1 outline-none" />
                      ) : (
                        <span className="flex-1 text-sm font-medium text-slate-700 cursor-pointer" onDoubleClick={() => startEdit(tag)}>
                          {tag.label}
                        </span>
                      )}

                      {/* Category switcher */}
                      <div className="flex items-center gap-0.5">
                        {TAG_CATEGORY_KEYS.map(c2 => {
                          const I2 = CAT_ICONS[c2];
                          return (
                            <button key={c2} type="button" title={TAG_CATEGORIES[c2].label}
                              onClick={() => setCategory(tag.id, c2)}
                              className={`p-1 rounded transition ${(tag.category || 'ruta') === c2 ? 'bg-blue-100 text-blue-600' : 'text-slate-300 hover:text-slate-500'}`}>
                              <I2 className="w-3 h-3" />
                            </button>
                          );
                        })}
                      </div>

                      {/* Color swatches */}
                      <div className="flex items-center gap-0.5">
                        {COLOR_CYCLE.map(col => (
                          <button key={col} type="button" onClick={() => setColor(tag.id, col)}
                            className={`w-3.5 h-3.5 rounded-full ${TAG_COLORS[col].bg} transition-transform ${tag.color === col ? 'scale-125 ring-2 ring-offset-1 ring-slate-300' : 'opacity-40 hover:opacity-100'}`} />
                        ))}
                      </div>

                      <button onClick={() => remove(tag.id)} className="p-1 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition flex-shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add new tag */}
      <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex-shrink-0 space-y-2">
        {/* Category selector */}
        <div className="flex gap-1">
          {TAG_CATEGORY_KEYS.map(cat => {
            const Icon = CAT_ICONS[cat];
            return (
              <button key={cat} type="button" onClick={() => setNewCategory(cat)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${newCategory === cat ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
                <Icon className="w-3 h-3" />{TAG_CATEGORIES[cat].label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && add()}
            placeholder={`Nueva etiqueta de ${TAG_CATEGORIES[newCategory].label.toLowerCase()}…`}
            className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:border-blue-400 focus:outline-none bg-white" />
          <div className="flex items-center gap-0.5">
            {COLOR_CYCLE.map(col => (
              <button key={col} type="button" onClick={() => setNewColor(col)}
                className={`w-4 h-4 rounded-full flex-shrink-0 ${TAG_COLORS[col].bg} transition-transform ${newColor === col ? 'scale-125 ring-2 ring-offset-1 ring-slate-300' : 'opacity-40 hover:opacity-100'}`} />
            ))}
          </div>
          <button onClick={add} disabled={!newLabel.trim()} className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition flex-shrink-0">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="px-6 py-4 border-t border-slate-100 flex justify-end flex-shrink-0">
        <button onClick={() => onSaveTags(tags)} className="px-5 py-2.5 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold shadow-sm transition flex items-center gap-2">
          <Check className="w-4 h-4" /> Guardar etiquetas
        </button>
      </div>
    </div>
  );
}
