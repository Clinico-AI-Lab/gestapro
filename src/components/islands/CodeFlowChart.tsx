import { useMemo } from "react";
import ReactECharts from "echarts-for-react";

interface FlowWeek {
  week: number;
  adds: number;
  dels: number;
}
interface Props {
  weeks: FlowWeek[];
  height?: number;
}

export default function CodeFlowChart({ weeks, height = 240 }: Props) {
  const option = useMemo(() => {
    if (!weeks || weeks.length === 0) return null;
    const hasData = weeks.some((w) => (w.adds ?? 0) > 0 || (w.dels ?? 0) > 0);
    if (!hasData) return null;

    const xAxis = weeks.map((w) => new Date(w.week * 1000).toISOString().slice(5, 10));
    const adds = weeks.map((w) => w.adds ?? 0);
    const dels = weeks.map((w) => w.dels ?? 0);

    return {
      backgroundColor: "transparent",
      tooltip: { trigger: "axis", axisPointer: { type: "line" } },
      legend: { textStyle: { color: "#8b949e", fontSize: 11 }, bottom: 0 },
      grid: { left: 40, right: 16, top: 16, bottom: 48 },
      xAxis: {
        type: "category",
        data: xAxis,
        boundaryGap: false,
        axisLabel: { color: "#8b949e", fontSize: 10 },
        axisLine: { lineStyle: { color: "#30363d" } },
      },
      yAxis: {
        type: "value",
        axisLabel: { color: "#8b949e", fontSize: 10 },
        splitLine: { lineStyle: { color: "#21262d" } },
      },
      series: [
        {
          name: "Lines added",
          type: "line",
          stack: "flow",
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 1, color: "#3fb950" },
          itemStyle: { color: "#3fb950" },
          areaStyle: { color: "rgba(63, 185, 80, 0.35)" },
          data: adds,
        },
        {
          name: "Lines removed",
          type: "line",
          stack: "flow",
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 1, color: "#f85149" },
          itemStyle: { color: "#f85149" },
          areaStyle: { color: "rgba(248, 81, 73, 0.30)" },
          data: dels,
        },
      ],
    };
  }, [weeks]);

  if (!option) return <div className="empty-state tiny">No code-flow data yet.</div>;
  return <ReactECharts option={option} style={{ height, width: "100%" }} />;
}
