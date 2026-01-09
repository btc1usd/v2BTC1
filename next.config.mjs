/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use standard output for Netlify compatibility
  experimental: {
    instrumentationHook: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config, { isServer }) => {
    // Prevent Next.js from trying to bundle these optional deps
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "pino-pretty": false,
      "sonic-boom": false,
      "thread-stream": false,
      "@react-native-async-storage/async-storage": false,
      "node-fetch": false,
      fs: false,
      net: false,
      tls: false,
    };

    // Polyfill indexedDB for SSR
    if (isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        "idb-keyval": false,
      };
    }

    // Ignore missing optional dependencies
    config.externals = config.externals || [];
    if (!isServer) {
      config.externals.push({
        "node-fetch": "node-fetch",
      });
    }

    return config;
  },
};

export default nextConfig;
