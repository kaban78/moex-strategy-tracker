'use client';

interface Slice {
  label: string;
  value: number;
  color: string;
}

interface Props {
  slices: Slice[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
}

export function Donut({
  slices,
  size = 220,
  thickness = 32,
  centerLabel,
  centerValue,
}: Props) {
  const total = slices.reduce((s, sl) => s + sl.value, 0);
  if (total <= 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-muted-foreground"
        style={{ width: size, height: size }}
      >
        нет данных
      </div>
    );
  }

  const radius = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;
  const arcs = slices.map((sl, i) => {
    const fraction = sl.value / total;
    const dash = fraction * circumference;
    const arc = (
      <circle
        key={i}
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        stroke={sl.color}
        strokeWidth={thickness}
        strokeDasharray={`${dash} ${circumference}`}
        strokeDashoffset={-offset}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
    );
    offset += dash;
    return arc;
  });

  return (
    <svg width={size} height={size} role="img">
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        stroke="var(--border)"
        strokeWidth={thickness}
        opacity={0.3}
      />
      {arcs}
      {centerValue && (
        <>
          <text
            x={cx}
            y={cy - 4}
            textAnchor="middle"
            className="fill-foreground"
            style={{ fontSize: 20, fontWeight: 600 }}
          >
            {centerValue}
          </text>
          {centerLabel && (
            <text
              x={cx}
              y={cy + 16}
              textAnchor="middle"
              className="fill-muted-foreground"
              style={{ fontSize: 11 }}
            >
              {centerLabel}
            </text>
          )}
        </>
      )}
    </svg>
  );
}
