import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'StateBid',
    short_name: 'StateBid',
    description: 'Claim one of 50 US states with a permanent verified advertising bid.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f3f1eb',
    theme_color: '#ff9a3d',
    icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
