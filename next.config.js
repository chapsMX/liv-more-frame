/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Esto evitará el doble renderizado en desarrollo
  images: {
    domains: ['tan-leading-pelican-169.mypinata.cloud'],
  },
}

module.exports = nextConfig 