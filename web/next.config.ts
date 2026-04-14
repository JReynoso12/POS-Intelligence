import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Avoid picking a parent folder when multiple lockfiles exist on the machine
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
