import type { ReactNode } from "react";
import { Link } from "wouter";
import { Settings, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProductShellProps {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function ProductShell({
  title,
  description,
  backHref,
  backLabel = "Back",
  actions,
  children,
}: ProductShellProps) {
  return (
    <div className="min-h-screen bg-[#f4f5f7] text-slate-950">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-5 py-3 md:px-7">
          <div className="flex items-center gap-3">
            {backHref ? (
              <Link href={backHref}>
                <Button variant="ghost" size="sm" className="rounded-full px-3">
                  <ArrowLeft className="h-4 w-4" />
                  {backLabel}
                </Button>
              </Link>
            ) : null}
            <Link href="/">
              <button type="button" className="text-left">
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">ArgusVene</div>
                <div className="text-sm font-semibold text-slate-900">Live meeting operating system</div>
              </button>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/org/settings">
              <Button variant="outline" size="sm" className="rounded-full">
                <Settings className="h-4 w-4" />
                Organization
              </Button>
            </Link>
            {actions}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1500px] px-5 py-6 md:px-7">
        <header className="mb-6">
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-slate-950">{title}</h1>
          {description ? <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">{description}</p> : null}
        </header>
        {children}
      </div>
    </div>
  );
}
