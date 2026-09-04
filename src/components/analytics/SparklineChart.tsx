interface Series {
  data: number[];
  color: string;
  label?: string;
}

interface SparklineChartProps {
  series: Series[];
  height?: number;
  maxOverride?: number;
  fill?: boolean;
}

export default function SparklineChart({ series, height = 64, maxOverride, fill = false }: SparklineChartProps) {
  const width = 280;
  const allValues = series.flatMap((s) => s.data);
  const max = maxOverride ?? Math.max(1, ...allValues);
  const min = Math.min(0, ...allValues);
  const range = max - min || 1;

  const pathFor = (data: number[]) => {
    if (data.length < 2) return "";
    const step = width / (data.length - 1);
    return data
      .map((v, i) => {
        const x = i * step;
        const y = height - ((v - min) / range) * height;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  };

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full overflow-visible" preserveAspectRatio="none">
      <line x1={0} y1={height} x2={width} y2={height} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
      {series.map((s, idx) => (
        <g key={idx}>
          {fill && (
            <path
              d={`${pathFor(s.data)} L${width},${height} L0,${height} Z`}
              fill={s.color}
              opacity={0.12}
              stroke="none"
            />
          )}
          <path d={pathFor(s.data)} fill="none" stroke={s.color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
        </g>
      ))}
    </svg>
  );
}
