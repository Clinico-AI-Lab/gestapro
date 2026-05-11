import { useMemo } from "react";
import ReactECharts from "echarts-for-react";

interface WeekRow {
  week: number;
  per_project: Record<string, number>;
  total: number;
}
interface Props {
  rows: WeekRow[];
  height?: number;
}

const PALETTE = ["#58a6ff", "#3fb950", "#d29922", "#a371f7", "#db61a2", "#ff8800"];

export default function WeeklyStack({ rows, height = 240 }: Props) {
  const option = useMemo(() => {
    if (!rows || rows.length === 0) return null;
    const slugs = Array.from(
      new Set(rows.flatMap((r) => Object.keys(r.per_project))),
    );
    const xAxis = rows.map((r) => new Date(r.week * 1000).toISOString().slice(5, 10));
    const series = slugs.map((slug, i) => ({
      name: slug,
      type: "bar",
      stack: "total",
      itemStyle: { color: PALETTE[i % PALETTE.length] },
      data: rows.map((r) => r.per_project[slug] ?? 0),
    }));
    return {
      backgroundColor: "transparent",
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      legend: { textStyle: { color: "#8b949e", fontSize: 11 }, bottom: 0 },
      grid: { left: 32, right: 16, top: 16, bottom: 48 },
      xAxis: {
        type: "category",
        data: xAxis,
        axisLabel: { color: "#8b949e", fontSize: 10 },
        axisLine: { lineStyle: { color: "#30363d" } },
      },
      yAxis: {
        type: "value",
        axisLabel: { color: "#8b949e", fontSize: 10 },
        splitLine: { lineStyle: { color: "#21262d" } },
      },
      series,
    };
  }, [rows]);
  if (!option) return <div className="empty-state tiny">No weekly activity yet.</div>;
  return <ReactECharts option={option} style={{ height, width: "100%" }} />;
}
