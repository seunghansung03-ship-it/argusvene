import { Brain, Cpu, TrendingUp, Palette, Bot } from "lucide-react";

const avatarMap: Record<string, typeof Brain> = {
  strategy: Brain,
  tech: Cpu,
  finance: TrendingUp,
  design: Palette,
};

interface AgentAvatarProps {
  avatar?: string | null;
  color?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  name?: string;
}

export function AgentAvatar({ avatar, color, size = "md", name }: AgentAvatarProps) {
  const Icon = avatarMap[avatar || ""] || Bot;
  const sizeClasses = {
    xs: "w-5 h-5",
    sm: "w-7 h-7",
    md: "w-9 h-9",
    lg: "w-12 h-12",
  };
  const iconSizes = {
    xs: "w-2.5 h-2.5",
    sm: "w-3.5 h-3.5",
    md: "w-4 h-4",
    lg: "w-6 h-6",
  };

  return (
    <div
      className={`${sizeClasses[size]} rounded-md flex items-center justify-center flex-shrink-0`}
      style={{ backgroundColor: `${color || "#3B82F6"}20`, color: color || "#3B82F6" }}
      data-testid={`avatar-agent-${name?.toLowerCase()}`}
    >
      <Icon className={iconSizes[size]} />
    </div>
  );
}
