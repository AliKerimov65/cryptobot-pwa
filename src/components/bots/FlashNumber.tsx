import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface FlashNumberProps {
  value: number;
  format: (n: number) => string;
  className?: string;
}

interface Flash {
  dir: 'up' | 'down';
  seq: number;
}

/**
 * Тикающее число с флэш-подсветкой: при изменении значения фон вспыхивает
 * зелёным (рост) или красным (падение) на 350ms. Сравнение с предыдущим
 * значением — паттерн «adjust state during render», сброс — по таймеру.
 */
export default function FlashNumber({ value, format, className }: FlashNumberProps) {
  const [prev, setPrev] = useState(value);
  const [flash, setFlash] = useState<Flash | null>(null);

  if (value !== prev) {
    if (Number.isFinite(value) && Number.isFinite(prev)) {
      setFlash({ dir: value > prev ? 'up' : 'down', seq: (flash?.seq ?? 0) + 1 });
    }
    setPrev(value);
  }

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 360);
    return () => clearTimeout(t);
  }, [flash]);

  return (
    <span
      key={flash?.seq ?? 0}
      className={cn(
        'rounded px-1 font-mono transition-colors',
        flash?.dir === 'up' && 'flash-up',
        flash?.dir === 'down' && 'flash-down',
        className,
      )}
    >
      {format(value)}
    </span>
  );
}
