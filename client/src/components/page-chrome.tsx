import type { ReactNode } from "react";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface PageChromeProps {
  eyebrow?: string;
  title: string;
  description?: string;
  badge?: string;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
  children: ReactNode;
  fluid?: boolean;
}

export function PageChrome({
  eyebrow,
  title,
  description,
  badge,
  backHref,
  backLabel = "Back",
  actions,
  children,
  fluid = false,
}: PageChromeProps) {
  const shellClassName = fluid ? "px-5 py-5 md:px-7" : "mx-auto max-w-7xl px-5 py-5 md:px-7";

  return (
    <div className="min-h-screen overflow-hidden bg-[linear-gradient(180deg,#efe8dc_0%,#f8f4ed_40%,#edf2f6_100%)] text-[#15212b]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-10rem] top-[-12rem] h-[24rem] w-[24rem] rounded-full bg-[#f08b5b]/12 blur-3xl" />
        <div className="absolute right-[-8rem] top-[4rem] h-[18rem] w-[18rem] rounded-full bg-[#84a8c2]/16 blur-3xl" />
      </div>

      <div className={`relative ${shellClassName}`}>
        <div className="rounded-[30px] border border-black/10 bg-white/72 p-5 shadow-[0_32px_120px_rgba(18,24,34,0.08)] backdrop-blur md:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-4">
              {backHref ? (
                <Link href={backHref}>
                  <Button variant="ghost" size="sm" className="h-9 rounded-full px-3 text-[#55626d] hover:bg-black/5 hover:text-[#15212b]">
                    <ArrowLeft className="mr-1.5 h-4 w-4" />
                    {backLabel}
                  </Button>
                </Link>
              ) : null}

              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  {eyebrow ? (
                    <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7d6d5c]">
                      {eyebrow}
                    </span>
                  ) : null}
                  {badge ? (
                    <Badge className="rounded-full border border-black/10 bg-[#15212b] px-3 py-1 text-white">
                      {badge}
                    </Badge>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[#15212b] md:text-[2.8rem]">{title}</h1>
                  {description ? (
                    <p className="max-w-3xl text-sm leading-6 text-[#625748] md:text-[15px]">
                      {description}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
          </div>
        </div>

        <div className="pt-5 md:pt-6">{children}</div>
      </div>
    </div>
  );
}
