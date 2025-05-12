/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Add alias for react-native
    config.resolve.alias = {
      ...config.resolve.alias,
      'react-native': require.resolve('./src/mocks/react-native'),
    };
    return config;
  },
};

module.exports = nextConfig; 