import { AlertCircle } from 'lucide-react';

export function ConfirmDialog({ title, message, confirmLabel = 'Confirmar', danger, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className={`px-6 pt-6 pb-4 ${danger ? 'border-t-4 border-red-500' : 'border-t-4 border-blue-500'}`}>
          <div className="flex items-start gap-3">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${danger ? 'bg-red-100' : 'bg-blue-100'}`}>
              <AlertCircle className={`w-5 h-5 ${danger ? 'text-red-600' : 'text-blue-600'}`} />
            </div>
            <div>
              <div className="font-bold text-slate-900">{title}</div>
              <div className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{message}</div>
            </div>
          </div>
        </div>
        <div className="px-6 pb-5 flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition">
            Cancelar
          </button>
          <button onClick={onConfirm} className={`px-4 py-2 text-sm text-white rounded-xl font-bold transition ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
