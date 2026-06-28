import { icons, type LucideProps } from "lucide-react";

interface IconProps extends LucideProps {
  name: string;
}

/** Render a lucide-react icon by its string name, with a safe fallback. */
export function Icon({ name, ...props }: IconProps) {
  const LucideIcon = icons[name as keyof typeof icons] ?? icons.Wrench;
  return <LucideIcon {...props} />;
}
