const defaultDevOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://0.0.0.0:3000",
  "http://[::1]:3000",
];

const envDevOrigins = process.env.ALLOWED_DEV_ORIGINS
  ? process.env.ALLOWED_DEV_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean)
  : [];

const devRedirects =
  process.env.NODE_ENV !== "production"
    ? [
        {
          source: "/:path*",
          has: [
            {
              type: "host",
              value: "127.0.0.1:3000",
            },
          ],
          destination: "http://localhost:3000/:path*",
          permanent: false,
        },
      ]
    : [];

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei'],
  allowedDevOrigins: Array.from(new Set([...defaultDevOrigins, ...envDevOrigins])),
  serverExternalPackages: ["better-sqlite3"],
  async redirects() {
    return devRedirects;
  },
};

export default nextConfig;
