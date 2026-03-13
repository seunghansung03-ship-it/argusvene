import { cn } from "@/lib/utils";

interface BrandMarkProps {
  className?: string;
}

export function BrandMark({ className }: BrandMarkProps) {
  return (
    <img
      src="/argusvene-mark.svg"
      alt="ArgusVene"
      className={cn("h-9 w-9 rounded-2xl", className)}
    />
  );
}
