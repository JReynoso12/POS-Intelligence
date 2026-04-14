import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Avoid picking a parent folder when multiple lockfiles exist on the machine
  outputFileTracingRoot: path.join(__dirname),

  experimental: {
    /** Smaller client bundles for chart/date usage */
    optimizePackageImports: ["recharts", "date-fns"],
  },

  // Dev-only: webpack’s PackFileCacheStrategy logs “Serializing big strings …” when
  // a module’s cached payload is large (common with chart/auth libs). Harmless; this
  // quiets infra logs so real errors stay visible.
  webpack: (config, { dev }) => {
    if (dev) {
      config.infrastructureLogging = {
        ...config.infrastructureLogging,
        level: "error",
      };
    }
    return config;
  },
};

export default nextConfig;
