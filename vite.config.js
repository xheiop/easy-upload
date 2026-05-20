import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import monkey, { cdn } from 'vite-plugin-monkey';
import svgr from 'vite-plugin-svgr';
import { yamlToJSON } from './scripts/helper.js';
import chokidar from 'chokidar';
import path from 'path';

const cmd = process.argv.slice(2)[0];
const isDev = cmd === 'dev';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      include: ['src/**/*.{ts,tsx}'],
    },
    clearMocks: true,
    mockReset: true,
  },
  plugins: [
    {
      name: 'watch-yaml',
      buildStart() {
        yamlToJSON();
        if (!isDev) return;
        chokidar
          .watch(['src/config/*.yaml', 'src/i18n/*.yaml'], {
            awaitWriteFinish: {
              stabilityThreshold: 200,
              pollInterval: 100,
            },
            ignoreInitial: true,
          })
          .on('all', (eventName, path) => {
            console.log(`${path}:${eventName}`);
            yamlToJSON();
          });
      },
    },
    preact(),
    svgr({
      svgrOptions: {
        exportType: 'default',
        ref: true,
        svgo: false,
        titleProp: true,
      },
      include: '**/*.svg',
    }),
    monkey({
      entry: 'src/index.tsx',
      userscript: {
        name: {
          '': 'EasyUpload PT一键转种',
          en: 'EasyUpload - Trackers Transfer Tool',
        },
        description: {
          '': '一键转种，支持PT站点之间的种子转移。',
          en: 'Transfer torrents between trackers with one click.',
        },
        namespace: 'https://github.com/techmovie/easy-upload',
        match: [
          'http*://*/torrents.php?id=*',
          'http*://*/torrents.php?torrentid=*',
          'http*://*/details.php?id=*',
          'https://totheglory.im/t/*',
          'https://ptpimg.me/*',
          'http*://*/torrents/*',
          'http*://*/torrents?*',
          'http*://*/upload*',
          'https://*/offers.php*',
          'https://broadcity.in/browse.php?imdb=*',
          'https://*/torrent/*',
          'https://piratethenet.org/browse.php?*',
          'https://teamhd.org/details/id*',
          'https://hd-space.org/index.php?page=upload',
          'https://hd-space.org/index.php?page=torrent-details&id=*',
          'https://speedapp.io/browse/*',
          'https://*.m-team.cc/detail/*',
          'https://www.yemapt.org/*',
          'https://www1.yemapt.org/*',
        ],
        exclude: [
          'https://*/torrent/peers*',
          'https://*/torrent/leechers*',
          'https://*/torrent/history*',
        ],
        downloadURL:
          'https://github.com/techmovie/easy-upload/raw/master/dist/easy-upload.user.js',
        updateURL:
          'https://github.com/techmovie/easy-upload/raw/master/dist/easy-upload.user.js',
        license: 'MIT',
      },
      build: {
        externalGlobals: {
          preact: cdn.jsdelivr('preact', 'dist/preact.min.js'),
          jquery: cdn.jsdelivr('jQuery', 'dist/jquery.min.js'),
        },
      },
      server: {
        mountGmApi: true,
      },
    }),
  ],
  build: {
    minifyCss: true,
    target: 'chrome58',
    outDir: './dist',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      path: 'path-browserify',
    },
  },
});
