export default function Logo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      {/* SVG clock mark */}
      <div className="w-8 h-8 rounded-lg bg-brand/20 border border-brand/30 
                      flex items-center justify-center shrink-0 glow-brand">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="9" cy="9" r="7.5" stroke="#7C3AED" strokeWidth="1.5"/>
          <path d="M9 5v4l2.5 2.5" stroke="#7C3AED" strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="9" cy="9" r="1" fill="#7C3AED"/>
        </svg>
      </div>
      {!collapsed && (
        <span className="text-lg font-bold text-text-primary tracking-tight">
          Life<span className="text-brand">Chrono</span>
        </span>
      )}
    </div>
  );
}