export default function Logo({
  tone = "brand",
  className = "",
}: {
  tone?: "brand" | "white";
  className?: string;
}) {
  const mark = tone === "white" ? "#ffffff" : "var(--brand-600)";
  const glyph = tone === "white" ? "var(--brand-600)" : "#ffffff";
  const word = tone === "white" ? "text-white" : "text-brand-600";

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg viewBox="0 0 40 44" className="size-8" aria-hidden="true">
        <path d="M20 1.2 37.3 11.2v20L20 41.2 2.7 31.2v-20z" fill={mark} />
        <path
          d="M14.5 15.5h2.9v13h-2.9zm8.1 0h2.9v13h-2.9zm-8.1 4.8h11v2.9h-11z"
          fill={glyph}
        />
      </svg>
      <span className={`text-lg font-bold tracking-[0.14em] ${word}`}>HELPDESK</span>
    </div>
  );
}
