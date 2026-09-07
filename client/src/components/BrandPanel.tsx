import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { cn } from "cn";

import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  useCarousel,
} from "@/components/ui/carousel";

const ROWS = [
  { subject: "Cannot log in", who: "ada@example.edu", cat: "Technical", tone: "amber" },
  { subject: "Refund for duplicate charge", who: "liam@example.edu", cat: "Refund", tone: "blue" },
  { subject: "Course materials locked", who: "noor@example.edu", cat: "Technical", tone: "amber" },
  { subject: "Change my email address", who: "sam@example.edu", cat: "General", tone: "green" },
  { subject: "Certificate not issued", who: "mia@example.edu", cat: "General", tone: "green" },
  { subject: "Double billed in March", who: "raj@example.edu", cat: "Refund", tone: "blue" },
];

const TONES: Record<string, string> = {
  amber: "bg-amber-400/15 text-amber-300",
  blue: "bg-sky-400/15 text-sky-300",
  green: "bg-emerald-400/15 text-emerald-300",
};

const SLIDES = [
  {
    lead: "Did you know support teams spend hours triaging tickets by hand?",
    emphasis: "Ours are classified and answered the moment they arrive.",
  },
  {
    lead: "Every inbound email is read, categorised, and routed on arrival.",
    emphasis: "Billing, technical, and general sort themselves out.",
  },
  {
    lead: "Routine questions are answered before an agent opens the queue.",
    emphasis: "The tickets that need a human arrive with context attached.",
  },
];

function MockDashboard() {
  return (
    <div className="relative">
      <div className="overflow-hidden rounded-xl bg-panel shadow-2xl ring-1 ring-white/10">
        <div className="flex items-center justify-between border-b border-white/8 px-4 py-2.5">
          <div className="flex items-center gap-3 text-[11px] font-medium text-white/70">
            <span className="text-white">Tickets</span>
            <span>Knowledge base</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="rounded bg-brand-600 px-2 py-0.5 text-[10px] font-medium text-white">
              New
            </span>
            <span className="size-4 rounded-full bg-white/15" />
          </div>
        </div>

        <div className="px-4 pt-3 pb-4">
          <p className="text-[11px] font-semibold text-white">Inbound queue</p>
          <p className="mb-2.5 text-[9px] text-white/40">Classified automatically on arrival</p>

          <table className="w-full border-collapse">
            <thead>
              <tr className="text-[8px] uppercase tracking-wide text-white/35">
                <th className="pb-1.5 text-left font-medium">Subject</th>
                <th className="pb-1.5 text-left font-medium">Requester</th>
                <th className="pb-1.5 text-left font-medium">Category</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.subject} className="border-t border-white/6">
                  <td className="py-[7px] pr-2 text-[9px] text-white/85">{r.subject}</td>
                  <td className="py-[7px] pr-2 text-[9px] text-white/40">{r.who}</td>
                  <td className="py-[7px]">
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[8px] font-medium",
                        TONES[r.tone],
                      )}
                    >
                      {r.cat}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating card, mirroring the reference's overlaid panel. */}
      <div className="absolute -right-3 -bottom-7 w-[58%] rounded-xl bg-white p-3 shadow-xl ring-1 ring-black/5">
        <div className="flex items-center gap-1.5">
          <Sparkles className="size-3 text-brand-600" />
          <p className="text-[10px] font-semibold text-foreground">AI classification</p>
        </div>
        <p className="mt-1 text-[9px] leading-snug text-muted-foreground">
          “Refund for duplicate charge” routed to Billing.
        </p>
        <div className="mt-2 flex items-center justify-between">
          <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[8px] font-semibold text-brand-700">
            Refund request
          </span>
          <span className="text-[8px] font-medium text-muted-foreground">96%</span>
        </div>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-brand-50">
          <div className="h-full w-[96%] rounded-full bg-brand-600" />
        </div>
      </div>
    </div>
  );
}

function Hex({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 40 44" className={className} aria-hidden="true">
      <path d="M20 1.2 37.3 11.2v20L20 41.2 2.7 31.2v-20z" fill="currentColor" />
    </svg>
  );
}

/* Arrows and dots live inside <Carousel> so they can read embla's state. */
function CarouselControls() {
  const { api, scrollPrev, scrollNext } = useCarousel();
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (!api) return;

    const onSelect = () => setSelected(api.selectedScrollSnap());
    onSelect();
    // `reInit` fires when the panel goes from `hidden` to visible at lg and
    // embla re-measures, which would otherwise leave the dots out of sync.
    api.on("reInit", onSelect);
    api.on("select", onSelect);

    return () => {
      api.off("reInit", onSelect);
      api.off("select", onSelect);
    };
  }, [api]);

  const control =
    "size-10 rounded-full border border-white/40 text-white/80 hover:bg-white/10 hover:text-white";

  return (
    <div className="mt-8 flex items-center justify-center gap-3">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={scrollPrev}
        aria-label="Previous slide"
        className={control}
      >
        <ArrowLeft className="size-4" />
      </Button>

      <div className="flex items-center gap-1.5">
        {SLIDES.map((slide, i) => (
          <span
            key={slide.lead}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === selected ? "w-5 bg-white" : "w-1.5 bg-white/40",
            )}
          />
        ))}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={scrollNext}
        aria-label="Next slide"
        className={control}
      >
        <ArrowRight className="size-4" />
      </Button>
    </div>
  );
}

export default function BrandPanel() {
  return (
    <div className="relative hidden overflow-hidden rounded-2xl bg-brand-600 px-10 py-11 lg:flex lg:flex-col">
      <Hex className="pointer-events-none absolute -top-14 -right-10 size-36 rotate-12 text-white/[0.035]" />
      <Hex className="pointer-events-none absolute -bottom-14 -left-10 size-44 text-white/[0.035]" />
      <Hex className="pointer-events-none absolute right-10 bottom-32 size-16 -rotate-6 text-white/[0.03]" />

      <div className="relative">
        <Logo tone="white" />
      </div>

      <div className="relative mt-11 mb-14">
        <MockDashboard />
      </div>

      <Carousel
        opts={{ loop: true }}
        className="relative mt-auto text-center"
        aria-label="Why teams use Helpdesk"
      >
        <CarouselContent>
          {SLIDES.map((slide) => (
            <CarouselItem key={slide.lead}>
              <p className="text-[22px] leading-snug text-white/95">{slide.lead}</p>
              <p className="mt-3 text-[22px] font-bold text-white">{slide.emphasis}</p>
            </CarouselItem>
          ))}
        </CarouselContent>

        <CarouselControls />
      </Carousel>
    </div>
  );
}
