import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // 🚫 No bloquea el build aunque haya errores de tipo
    ignoreBuildErrors: true,
  },
  eslint: {
    // 🚫 No bloquea el build aunque haya errores de lint
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
