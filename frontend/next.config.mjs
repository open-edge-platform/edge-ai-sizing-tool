import { withPayload } from '@payloadcms/next/withPayload'
import webpack from 'webpack'

const isStandalone = process.env.STANDALONE_BUILD === 'true';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: isStandalone ? 'standalone' : undefined,
  serverExternalPackages: ['openvino-node'],
  // Your Next.js config here
  webpack: (config, { isServer }) => {
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^osx-temperature-sensor$/,
      }),
    )
    if (!isServer) {
      config.externals = [
        ...config.externals,
        { 'openvino-node': 'commonjs openvino-node' },
      ]
    }
    return config
  },
}

export default withPayload(nextConfig)
