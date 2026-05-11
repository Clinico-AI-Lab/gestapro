import { defineConfig } from "astro/config";
import react from "@astrojs/react";

export default defineConfig({
  site: "https://clinicoailab.github.io",
  base: "/gestapro",
  trailingSlash: "ignore",
  integrations: [react()],
  build: {
    assets: "_astro",
  },
  vite: {
    ssr: {
      noExternal: ["echarts", "echarts-for-react", "cal-heatmap"],
    },
  },
});
