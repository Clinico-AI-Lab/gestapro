import { useEffect, useRef } from "react";
import CalHeatmapLib from "cal-heatmap";
import "cal-heatmap/cal-heatmap.css";

interface Week {
  week: number;
  total: number;
  days: number[];
}

interface Props { weeks: Week[]; }

export default function CalHeatmap({ weeks }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const calRef = useRef<unknown>(null);

  useEffect(() => {
    if (!ref.current) return;

    // Build daily series from the weekly data we already have
    const data: Array<{ date: string; value: number }> = [];
    for (const w of weeks) {
      for (let d = 0; d < 7; d++) {
        const ts = (w.week + d * 86400) * 1000;
        data.push({ date: new Date(ts).toISOString().slice(0, 10), value: w.days[d] ?? 0 });
      }
    }

    if (data.length === 0) {
      ref.current.innerHTML = '<div class="empty-state">No activity data yet (GitHub computes stats lazily — should populate on the next 6h refresh).</div>';
      return;
    }

    const start = weeks[0]?.week ? new Date(weeks[0].week * 1000) : new Date();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cal: any = new (CalHeatmapLib as any)();
    calRef.current = cal;
    cal.paint({
      itemSelector: ref.current,
      data: { source: data, x: "date", y: "value" },
      date: { start, locale: { weekStart: 0 } },
      range: 12,
      domain: { type: "month", gutter: 4, label: { text: "MMM", textAlign: "start", position: "top" } },
      subDomain: { type: "ghDay", radius: 2, width: 11, height: 11, gutter: 2 },
      scale: {
        color: {
          type: "threshold",
          range: ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"],
          domain: [1, 3, 6, 10],
        },
      },
    });

    return () => {
      // cal-heatmap v4 has no destroy; clear DOM
      if (ref.current) ref.current.innerHTML = "";
    };
  }, [weeks]);

  return <div ref={ref} className="cal-heatmap-container" />;
}
