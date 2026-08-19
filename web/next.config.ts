import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pins the workspace root to this app, not the parent repo (which has
  // its own package-lock.json for the Remotion/API project) — silences
  // Next's "inferred workspace root" warning.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
