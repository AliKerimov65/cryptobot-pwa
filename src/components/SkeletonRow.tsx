import { cn } from '@/lib/utils';

interface SkeletonRowProps {
  lines?: number;
  className?: string;
}

/** Скелетон-строки с шиммером (1.4s linear infinite). */
export default function SkeletonRow({ lines = 3, className }: SkeletonRowProps) {
  return (
    <div className={cn('space-y-2.5', className)} aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className="skeleton-shimmer h-3.5 rounded-md"
          style={{ width: `${88 - i * 14}%` }}
        />
      ))}
    </div>
  );
}
