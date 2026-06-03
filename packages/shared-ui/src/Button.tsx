import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ className = "", children, ...props }: ButtonProps) {
  return (
    <button
      className={`rounded border border-[#2f353f] bg-[#1a202a] px-3 py-2 text-sm text-slate-100 transition hover:border-accent hover:bg-[#27334b] ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
