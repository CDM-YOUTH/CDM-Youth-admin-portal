type Slice = { label: string; value: number; color: string };

/** Lightweight SVG donut — no chart lib needed for Phase 1. */
export function Donut({
  data,
  size = 96,
  display = "percent",
}: {
  data: Slice[];
  size?: number;
  display?: "count" | "percent";
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const radius = size / 2;
  const stroke = size * 0.18;
  const r = radius - stroke / 2;
  const circ = 2 * Math.PI * r;

  let offset = 0;
  return (
    <div className="flex items-center gap-3">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        <circle
          cx={radius}
          cy={radius}
          r={r}
          fill="none"
          stroke="var(--color-bg-4)"
          strokeWidth={stroke}
        />
        {data.map((d, i) => {
          const len = (d.value / total) * circ;
          const dash = `${len} ${circ - len}`;
          const dashoffset = -offset;
          offset += len;
          return (
            <circle
              key={i}
              cx={radius}
              cy={radius}
              r={r}
              fill="none"
              stroke={d.color}
              strokeWidth={stroke}
              strokeDasharray={dash}
              strokeDashoffset={dashoffset}
              transform={`rotate(-90 ${radius} ${radius})`}
              strokeLinecap="butt"
            />
          );
        })}
      </svg>
      <div className="flex flex-1 flex-col gap-1.5">
        {data.map((d, i) => {
          const pct = Math.round((d.value / total) * 100);
          const primary = display === "percent" ? `${pct}%` : d.value.toLocaleString();
          const secondary = display === "percent" ? d.value.toLocaleString() : `${pct}%`;
          return (
            <div key={i} className="flex items-center gap-1.5">
              <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: d.color }} />
              <span className="flex-1 text-[10px] text-text-2">{d.label}</span>
              <span className="text-[10px] font-bold text-text-1">{primary}</span>
              <span className="text-[9px] font-semibold text-text-4">{secondary}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
