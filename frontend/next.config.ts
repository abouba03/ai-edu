import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Exclude admin routes from static generation
  output: "standalone",
};

export default nextConfig;
