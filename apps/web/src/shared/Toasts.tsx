import { useStore } from '@store/useStore';

export function Toasts() {
  const { toasts, dismissToast } = useStore();
  if (toasts.length === 0) return null;
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 w-80">
      {toasts.map((t) => (
        <div key={t.id} className="bg-white shadow-soft-xl rounded-md border p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">{t.title}</p>
              {t.description && <p className="text-xs text-gray-600 mt-0.5">{t.description}</p>}
            </div>
            <button className="btn-outline btn-sm" onClick={() => dismissToast(t.id)}>Dismiss</button>
          </div>
        </div>
      ))}
    </div>
  );
}


