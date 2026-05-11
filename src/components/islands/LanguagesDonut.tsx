import { useMemo } from "react";
import ReactECharts from "echarts-for-react";

interface Props {
  languages: Record<string, number>;
  height?: number;
}

const LANG_COLORS: Record<string, string> = {
  Python: "#3572A5",
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Shell: "#89e051",
  Rust: "#dea584",
  Go: "#00ADD8",
  HTML: "#e34c26",
  CSS: "#563d7c",
  Astro: "#ff5d01",
  Markdown: "#083fa1",
  Dockerfile: "#384d54",
  YAML: "#cb171e",
};

export default function LanguagesDonut({ languages, height = 220 }: Props) {
  const option = useMemo(() => {
    const entries = Object.entries(languages).filter(([, v]) => v > 0);
    if (entries.length === 0) return null;
    return {
      backgroundColor: "transparent",
      tooltip: { trigger: "item", formatter: "{b}: {c} bytes ({d}%)" },
      legend: { show: true, bottom: 0, textStyle: { color: "#8b949e", fontSize: 11 } },
      series: [
        {
          type: "pie",
          radius: ["48%", "72%"],
          center: ["50%", "44%"],
          avoidLabelOverlap: true,
          itemStyle: { borderColor: "#0d1117", borderWidth: 2 },
          label: { show: false },
          labelLine: { show: false },
          data: entries
            .sort((a, b) => b[1] - a[1])
            .map(([name, value]) => ({
              name,
              value,
              itemStyle: { color: LANG_COLORS[name] ?? "#8b949e" },
            })),
        },
      ],
    };
  }, [languages]);

  if (!option) return <div className="empty-state tiny">No language data.</div>;
  return <ReactECharts option={option} style={{ height, width: "100%" }} />;
}
