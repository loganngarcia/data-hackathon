import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Monorepo tracing root omitted by default — can contribute to dev ENOENT races; set NEXT_OUTPUT_FILE_TRACING_ROOT=1 if deploy needs parent folder tracing.
  ...(process.env.NEXT_OUTPUT_FILE_TRACING_ROOT === "1"
    ? { outputFileTracingRoot: path.join(__dirname, "..") }
    : {}),
};

export default nextConfig;
