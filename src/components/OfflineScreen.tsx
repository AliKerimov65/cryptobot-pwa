interface OfflineScreenProps {
  onRetry?: () => void;
}

/** Честный полноэкранный офлайн: глиф + «Нет сети — живая лента остановлена». */
export default function OfflineScreen({ onRetry }: OfflineScreenProps) {
  return (
    <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-4 py-12 text-center">
      <img src="/offline-glyph.svg" alt="Разорванное соединение" width={160} height={160} />
      <div>
        <p className="text-[16px] font-semibold text-primary2">Нет сети</p>
        <p className="mt-1 text-[13px] text-muted2">
          Живая лента остановлена — показаны данные из кэша оболочки
        </p>
      </div>
      <button
        type="button"
        onClick={onRetry ?? (() => window.location.reload())}
        className="cursor-pointer rounded-lg border border-subtle bg-cardbg px-4 py-2 text-[13px] font-medium text-primary2 transition-colors hover:bg-cardhover"
      >
        Повторить подключение
      </button>
    </div>
  );
}
