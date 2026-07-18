import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoGlyph({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary text-primary-foreground shadow-sm",
        className,
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 36 36" className="size-full" fill="none">
        <path
          d="M10 10h11c4.4 0 7 2.7 7 6.8s-2.6 6.8-7 6.8h-7"
          stroke="currentColor"
          strokeWidth="3.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M10 27V17h10.5c2.2 0 3.7 1.2 3.7 3.1s-1.5 3.1-3.7 3.1H14"
          stroke="currentColor"
          strokeWidth="3.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function BrandMark({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="Paydae home"
      className={cn(
        "inline-flex min-h-10 items-center gap-2 rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      )}
    >
      <LogoGlyph />
      <span className="text-xl font-semibold tracking-[-0.04em]">paydae</span>
    </Link>
  );
}
