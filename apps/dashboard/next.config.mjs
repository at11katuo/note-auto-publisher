/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@note/db', '@note/logger', '@note/shared'],
};

export default nextConfig;
