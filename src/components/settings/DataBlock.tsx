import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, Trash2, Upload } from 'lucide-react';
import { useEngine } from '@/engine/EngineContext';
import Panel from '@/components/Panel';
import { cn } from '@/lib/utils';

interface ExportFile {
  app: string;
  v: number;
  exportedAt: string;
  data: Record<string, string>;
}

/** Секция «Данные»: экспорт/импорт localStorage, полный сброс с confirm-модалом. */
export default function DataBlock() {
  const eng = useEngine();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  };

  const exportJson = () => {
    const data: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) data[key] = localStorage.getItem(key) ?? '';
    }
    const payload: ExportFile = {
      app: 'cryptobot-pwa-mirror',
      v: 1,
      exportedAt: new Date().toISOString(),
      data,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const day = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `cryptobot-export-${day}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Экспорт сохранён в файл');
  };

  const importJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as Partial<ExportFile>;
        if (!parsed || typeof parsed !== 'object' || !parsed.data || typeof parsed.data !== 'object') {
          showToast('Файл не похож на экспорт зеркала');
          return;
        }
        for (const [key, value] of Object.entries(parsed.data)) {
          if (typeof value === 'string') localStorage.setItem(key, value);
        }
        showToast('Импортировано · перезагрузка…');
        setTimeout(() => window.location.reload(), 900);
      } catch {
        showToast('Не удалось прочитать JSON');
      }
    };
    reader.readAsText(file);
  };

  const fullReset = () => {
    eng.actions.clearData();
    setConfirmOpen(false);
    navigate('/');
  };

  const btnBase =
    'flex w-full cursor-pointer items-center gap-3 rounded-xl border border-subtle bg-cardbg px-3 py-2.5 text-left transition-colors hover:border-brand/50';

  return (
    <Panel
      title="Данные"
      actions={
        <AnimatePresence>
          {toast && (
            <motion.span
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-full border border-up/40 bg-up/10 px-2 py-0.5 text-[10px] font-semibold text-up"
            >
              {toast}
            </motion.span>
          )}
        </AnimatePresence>
      }
    >
      <div className="space-y-2">
        <motion.button type="button" whileTap={{ scale: 0.98 }} onClick={exportJson} className={btnBase}>
          <Download size={16} strokeWidth={1.75} className="shrink-0 text-brand" />
          <span className="min-w-0">
            <span className="block text-[13px] font-medium text-primary2">Экспорт состояния (JSON)</span>
            <span className="block text-[11px] text-faint">
              Настройки + paper-состояние + журнал — одним файлом
            </span>
          </span>
        </motion.button>

        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          onClick={() => fileRef.current?.click()}
          className={btnBase}
        >
          <Upload size={16} strokeWidth={1.75} className="shrink-0 text-brand" />
          <span className="min-w-0">
            <span className="block text-[13px] font-medium text-primary2">Импорт состояния</span>
            <span className="block text-[11px] text-faint">
              Восстановление из файла экспорта; приложение перезагрузится
            </span>
          </span>
        </motion.button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importJson(f);
            e.target.value = '';
          }}
        />

        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          onClick={() => setConfirmOpen(true)}
          className={cn(btnBase, 'border-down/30 hover:border-down/60')}
        >
          <Trash2 size={16} strokeWidth={1.75} className="shrink-0 text-down" />
          <span className="min-w-0">
            <span className="block text-[13px] font-medium text-down">Полный сброс</span>
            <span className="block text-[11px] text-faint">
              Настройки, paper-состояние и журнал удаляются безвозвратно
            </span>
          </span>
        </motion.button>
      </div>

      {/* Confirm-модал полного сброса */}
      <AnimatePresence>
        {confirmOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
            onClick={() => setConfirmOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border border-subtle bg-cardbg p-4"
              role="alertdialog"
              aria-label="Подтверждение полного сброса"
            >
              <p className="text-[15px] font-semibold text-primary2">Полный сброс</p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted2">
                Удалить настройки, paper-состояние и журнал? Действие необратимо.
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmOpen(false)}
                  className="cursor-pointer rounded-lg border border-subtle bg-cardbg px-3 py-1.5 text-[12px] font-semibold text-muted2 transition-colors hover:text-primary2"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={fullReset}
                  className="cursor-pointer rounded-lg bg-down px-3 py-1.5 text-[12px] font-semibold text-[#0B0E14] transition-opacity hover:opacity-90"
                >
                  Сбросить всё
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Panel>
  );
}
