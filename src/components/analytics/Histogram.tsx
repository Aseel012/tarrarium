interface HistogramProps {
  values: number[];
  min: number;
  max: number;
  bins?: number;
  color?: string;
  height?: number;
}

/** Simple SVG bar histogram — buckets `values` into `bins` equal ranges. */
export default function Histogram({ values, min, max, bins = 12, color = "#5eead4", height = 64 }: HistogramProps) {
  const width = 280;
  const counts = new Array(bins).fill(0);
  const range = max - min || 1;

  values.forEach((v) => {
    const bucket = Math.min(bins - 1, Math.max(0, Math.floor(((v - min) / range) * bins)));
    counts[bucket]++;
  });

  
  const maxCount = Math.max(1, ...counts);
  const barWidth = width / bins;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none">
      {counts.map((c, i) => {
        const barHeight = (c / maxCount) * (height - 2);
        return (
          <rect
            key={i}
            x={i * barWidth + 1}
            y={height - barHeight}
            width={Math.max(0, barWidth - 2)}
            height={barHeight}
            fill={color}
            opacity={0.75}
            rx={1}
          />
        );
      })}
    </svg>
  );
}
