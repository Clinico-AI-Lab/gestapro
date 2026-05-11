declare module "cal-heatmap" {
  const CalHeatmap: new () => {
    paint(options: Record<string, unknown>): void;
  };
  export default CalHeatmap;
}
declare module "cal-heatmap/cal-heatmap.css";
