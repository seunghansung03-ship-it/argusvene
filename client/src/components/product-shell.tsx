import type { ReactNode } from "react";
import { Link } from "wouter";
import { Settings, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand-mark";

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
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-5 py-3 md:px-6">
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
              <button type="button" className="flex items-center gap-3 text-left">
                <BrandMark className="h-8 w-8 rounded-xl" />
                <div className="text-sm font-semibold text-slate-900">ArgusVene</div>
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

      <div className="mx-auto max-w-[1200px] px-5 py-6 md:px-6">
        <header className="mb-5">
          <h1 className="text-2xl font-semibold tracking-[-0.03em] text-slate-950">{title}</h1>
          {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
        </header>
        {children}
      </div>
    </div>
  );
}
