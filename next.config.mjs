/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Updated: moved from experimental.serverComponentsExternalPackages to serverExternalPackages
  serverExternalPackages: ['pdf-parse', 'mammoth'],
  
  // Security headers
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.NODE_ENV === 'production' ? 'https://your-domain.com' : '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
        ],
      },
    ]
  },
  
  // Redirects for better UX
  async redirects() {
    return [
      {
        source: '/dashboard',
        destination: '/dashboard/projects',
        permanent: true,
      },
    ]
  },
  
  // Simplified webpack configuration
  webpack: (config, { isServer }) => {
    // Handle server-side externals for document processing libraries
    if (isServer) {
      config.externals = config.externals || []
      config.externals.push('pdf-parse', 'mammoth')
    }

    return config
  },
}

export default nextConfig
