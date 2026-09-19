import { AnimatePresence, motion } from 'framer-motion';

interface ConfirmResetModalProps {
  open: boolean;
  symbol: string;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Confirm-диалог сброса paper-состояния (scale 0.96→1, opacity 0→1, 180ms). */
export default function ConfirmResetModal({ open, symbol, onCancel, onConfirm }: ConfirmResetModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="reset-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
          onClick={onCancel}
        >
          <motion.div
            key="reset-dialog"
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            role="alertdialog"
            aria-modal="true"
            aria-label={`Сбросить paper-состояние ${symbol}`}
            className="w-full max-w-sm rounded-2xl border border-subtle bg-cardbg p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 text-[15px] font-semibold text-primary2">
              Сбросить paper-состояние {symbol}?
            </h3>
            <p className="mb-4 text-[13px] leading-snug text-muted2">
              Эквити вернётся к 1 000 USDT, открытые ноги и ждущие перехватчики будут сняты,
              журнал будет очищен.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="cursor-pointer rounded-lg border border-subtle px-3.5 py-2 text-[13px] font-medium text-muted2 transition-colors hover:text-primary2"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="cursor-pointer rounded-lg bg-down px-3.5 py-2 text-[13px] font-semibold text-[#0B0E14] transition-opacity hover:opacity-90"
              >
                Сбросить
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
