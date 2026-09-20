import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Mots Croises - Puzzles gratuits quotidiens',
    short_name: 'Mots Croises',
    description: 'Jouez aux mots croises gratuits en francais. Un nouveau puzzle chaque jour !',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8f7f1',
    theme_color: '#16a6c9',
    orientation: 'portrait-primary',
    lang: 'fr',
    categories: ['games', 'puzzle', 'entertainment'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
