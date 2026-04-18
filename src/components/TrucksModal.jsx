import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { Plus, Trash2, Truck, X, Edit2, User, GripVertical } from 'lucide-react';
import { inputCls } from './primitives';

export function TrucksModal({ vehicles, onAdd, onUpdate, onDelete, onReorder, onClose }) {
  const { register, handleSubmit, reset } = useForm({ defaultValues: { plate: '', driver: '' } });
  const [dragList, setDragList] = useState(vehicles);
  const dragIdx = useRef(null);
  const dragOver = useRef(null);
  const [dragging, setDragging] = useState(false);

  // Keep dragList in sync when vehicles prop changes (add/delete)
  const syncedList = vehicles; // use vehicles as source of truth unless mid-drag

  const submit = (data) => { if (!data.plate.trim()) return; onAdd(data); reset(); };

  const handleDragStart = (i) => { dragIdx.current = i; setDragging(true); };
  const handleDragEnter = (i) => { dragOver.current = i; };
  const handleDragEnd   = () => {
    setDragging(false);
    if (dragIdx.current === null || dragOver.current === null || dragIdx.current === dragOver.current) {
      dragIdx.current = null; dragOver.current = null; return;
    }
    const reordered = [...vehicles];
    const [moved] = reordered.splice(dragIdx.current, 1);
    reordered.splice(dragOver.current, 0, moved);
    dragIdx.current = null; dragOver.current = null;
    onReorder(reordered);
  };

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-md bg-white h-full flex flex-col shadow-2xl">
        <header className="px-6 py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
              <Truck className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="font-bold text-slate-900">Gestionar flota</div>
              <div className="text-xs text-slate-500">{vehicles.length} camión{vehicles.length !== 1 ? 'es' : ''} · arrastra para reordenar</div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><X className="w-5 h-5" /></button>
        </header>

        <div className="flex-1 overflow-y-auto py-3 px-4 space-y-1.5">
          {vehicles.length === 0 && (
            <div className="py-12 text-center text-slate-400 text-sm">Añade tu primer camión abajo.</div>
          )}
          {vehicles.map((v, idx) => (
            <TruckRow
              key={v.id}
              vehicle={v}
              index={idx + 1}
              onUpdate={(d) => onUpdate(v.id, d)}
              onDelete={() => onDelete(v.id)}
              onDragStart={() => handleDragStart(idx)}
              onDragEnter={() => handleDragEnter(idx)}
              onDragEnd={handleDragEnd}
              isDragging={dragging && dragIdx.current === idx}
              isOver={dragging && dragOver.current === idx && dragIdx.current !== idx}
            />
          ))}
        </div>

        <div className="border-t border-slate-200 px-4 py-4 bg-slate-50 flex-shrink-0">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Añadir camión</div>
          <form onSubmit={handleSubmit(submit)} className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Matrícula *</label>
                <input {...register('plate')} placeholder="1234ABC" className={`${inputCls} font-mono`} />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Conductor</label>
                <input {...register('driver')} placeholder="Nombre" className={inputCls} />
              </div>
            </div>
            <button type="submit" className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-bold transition shadow-sm">
              <Plus className="w-4 h-4" /> Añadir camión
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function TruckRow({ vehicle, index, onUpdate, onDelete, onDragStart, onDragEnter, onDragEnd, isDragging, isOver }) {
  const [editing, setEditing] = useState(false);
  const { register, handleSubmit, reset } = useForm({ defaultValues: { plate: vehicle.plate, driver: vehicle.driver } });
  const save   = (d) => { onUpdate(d); setEditing(false); };
  const cancel = () => { reset(); setEditing(false); };

  if (editing) return (
    <form onSubmit={handleSubmit(save)} className="bg-blue-50 border-2 border-blue-200 rounded-xl p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-blue-600 font-semibold mb-1 block">Matrícula</label>
          <input {...register('plate')} autoFocus onKeyDown={e => e.key === 'Escape' && cancel()} className={`${inputCls} font-mono`} />
        </div>
        <div>
          <label className="text-xs text-blue-600 font-semibold mb-1 block">Conductor</label>
          <input {...register('driver')} onKeyDown={e => e.key === 'Escape' && cancel()} className={inputCls} />
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" className="flex-1 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold">Guardar</button>
        <button type="button" onClick={cancel} className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-600">Cancelar</button>
      </div>
    </form>
  );

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragEnd={onDragEnd}
      onDragOver={e => e.preventDefault()}
      className={`bg-white border rounded-xl px-3 py-3 flex items-center gap-3 group hover:border-slate-300 transition-all select-none
        ${isDragging ? 'opacity-40 scale-[0.98]' : ''}
        ${isOver ? 'border-blue-400 border-2 shadow-md shadow-blue-100' : 'border-slate-200'}
      `}
    >
      <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 transition-colors flex-shrink-0 touch-none" title="Arrastrar para reordenar">
        <GripVertical className="w-4 h-4" />
      </div>
      <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 flex-shrink-0">{index}</div>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm text-slate-800 font-mono">
          {vehicle.plate || <span className="font-sans font-normal italic text-slate-400">Sin matrícula</span>}
        </div>
        <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
          {vehicle.driver ? <><User className="w-3 h-3 text-slate-400" />{vehicle.driver}</> : <span className="italic text-slate-400">Sin conductor</span>}
        </div>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => setEditing(true)} className="p-1.5 hover:bg-blue-50 rounded-lg text-slate-400 hover:text-blue-600 transition"><Edit2 className="w-3.5 h-3.5" /></button>
        <button onClick={onDelete} className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  );
}
