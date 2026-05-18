import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig = {
  experimental: {
    externalDir: true,
  },
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
