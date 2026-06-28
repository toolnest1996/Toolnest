import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({
  size = 40,
  showText = true,
  className,
  href = "/",
}: {
  size?: number;
  showText?: boolean;
  className?: string;
  href?: string;
}) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2.5 group", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt="ToolNest"
        width={size}
        height={size}
        className="rounded-xl transition-transform group-hover:scale-105"
      />
      {showText && (
        <span className="font-display text-lg font-extrabold tracking-tight">
          Tool<span className="text-gradient">Nest</span>
        </span>
      )}
    </Link>
  );
}
