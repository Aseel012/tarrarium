import type { PropsWithChildren, ReactNode } from "react";

interface PanelProps {
  title?: string;
  action?: ReactNode;
  dense?: boolean;
  className?: string;
}

/** Frosted-glass panel used throughout the dashboard for visual consistency. */
export function Panel({ title, action, dense, className = "", children }: PropsWithChildren<PanelProps>) {
  return (
    <div
      className={`rounded-2xl border border-edge bg-panel shadow-glass backdrop-blur-md ${
        dense ? "p-3" : "p-4"
      } ${className}`}
    >
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between">
          {title && <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

interface ButtonProps {
  onClick: () => void;
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  active?: boolean;
  title?: string;
  className?: string;
  disabled?: boolean;
}

export function Button({
  onClick,
  children,
  variant = "secondary",
  active,
  title,
  className = "",
  disabled,
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-150 select-none disabled:opacity-40 disabled:cursor-not-allowed";
  const variants: Record<string, string> = {
    primary: "bg-signal text-slate-950 hover:brightness-110 active:brightness-95 font-semibold",
    secondary: "bg-white/[0.06] text-slate-200 hover:bg-white/[0.11] border border-white/[0.06]",
    danger: "bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 border border-rose-500/20",
    ghost: "bg-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]",
  };
  const activeStyle = active ? "ring-1 ring-signal text-signal" : "";

  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${activeStyle} ${className}`}
    >
      {children}
    </button>
  );
}
