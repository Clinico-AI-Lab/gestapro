import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { hierarchy, treemap, type HierarchyRectangularNode } from "d3-hierarchy";

interface ChurnNode {
  name: string;
  path?: string;
  churn: number;
  adds: number;
  dels: number;
  commits: number;
  last_touched?: string;
  children?: ChurnNode[];
}

interface Props { tree: ChurnNode; }

export default function ChurnTreemap({ tree }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    el.innerHTML = "";

    if (!tree.children || tree.children.length === 0) {
      el.innerHTML = '<div class="empty-state">No file-churn data yet.</div>';
      return;
    }

    const width = el.clientWidth || 800;
    const height = 380;

    const root = hierarchy<ChurnNode>(tree)
      .sum((d) => (d.children && d.children.length > 0 ? 0 : d.churn))
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    treemap<ChurnNode>().size([width, height]).padding(1).round(true)(root);

    const leaves = root.leaves() as HierarchyRectangularNode<ChurnNode>[];

    const maxChurn = d3.max(leaves, (d) => d.data.churn) ?? 1;
    const color = d3.scaleSequential([0, maxChurn], d3.interpolateBlues);

    const svg = d3
      .select(el)
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("width", "100%")
      .attr("height", height)
      .attr("font-family", "ui-monospace, monospace")
      .attr("font-size", 10);

    const tip = d3
      .select(el)
      .append("div")
      .style("position", "absolute")
      .style("pointer-events", "none")
      .style("background", "var(--bg-elev)")
      .style("border", "1px solid var(--border)")
      .style("border-radius", "6px")
      .style("padding", "0.4rem 0.6rem")
      .style("font-size", "0.78rem")
      .style("color", "var(--fg)")
      .style("opacity", "0")
      .style("transition", "opacity 0.1s")
      .style("z-index", "10");
    el.style.position = "relative";

    const cell = svg
      .selectAll<SVGGElement, HierarchyRectangularNode<ChurnNode>>("g")
      .data(leaves)
      .enter()
      .append("g")
      .attr("transform", (d) => `translate(${d.x0},${d.y0})`);

    cell
      .append("rect")
      .attr("width", (d) => d.x1 - d.x0)
      .attr("height", (d) => d.y1 - d.y0)
      .attr("fill", (d) => color(d.data.churn))
      .attr("stroke", "var(--bg)")
      .attr("stroke-width", 1)
      .on("mousemove", (event, d) => {
        const rect = el.getBoundingClientRect();
        tip
          .style("opacity", "1")
          .style("left", `${event.clientX - rect.left + 10}px`)
          .style("top", `${event.clientY - rect.top + 10}px`)
          .html(
            `<div><strong>${d.data.path ?? d.data.name}</strong></div>` +
              `<div>churn: ${d.data.churn} (+${d.data.adds}/-${d.data.dels})</div>` +
              `<div>commits: ${d.data.commits}</div>`,
          );
      })
      .on("mouseleave", () => tip.style("opacity", "0"));

    cell
      .append("text")
      .attr("x", 4)
      .attr("y", 12)
      .attr("fill", "var(--fg)")
      .attr("pointer-events", "none")
      .style("font-size", "10px")
      .text((d) => {
        const w = d.x1 - d.x0;
        if (w < 40) return "";
        const name = d.data.name;
        return name.length * 6 > w ? name.slice(0, Math.floor(w / 6)) + "…" : name;
      });

    return () => {
      el.innerHTML = "";
    };
  }, [tree]);

  return <div ref={ref} style={{ width: "100%" }} />;
}
