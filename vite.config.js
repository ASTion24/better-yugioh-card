import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import dts from 'vite-plugin-dts';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import {
  DeckSourceError,
  fetchDeckSource,
} from './server/deck-source-proxy.js';

const projectRoot = import.meta.dirname;
const packageManifest = JSON.parse(
  fs.readFileSync(
    path.resolve(projectRoot, 'packages/package.json'),
    'utf8',
  ),
);
const packageExternalSet = new Set([
  ...Object.keys(packageManifest.dependencies ?? {}),
  ...Object.keys(packageManifest.peerDependencies ?? {}),
]);

const external = id => Array.from(packageExternalSet).some(name => id === name || id.startsWith(`${name}/`));

const preserveModulesOutput = {
  preserveModules: true,
  preserveModulesRoot: 'packages',
  entryFileNames: '[name].js',
};

const buildLib = {
  outDir: 'dist',
  lib: {
    entry: path.resolve(projectRoot, 'packages/index.js'),
    formats: ['es'],
  },
  rolldownOptions: {
    treeshake: false,
    external,
    output: preserveModulesOutput,
  },
};

const buildWebsite = {
  outDir: 'docs',
  emptyOutDir: true,
  rolldownOptions: {
    preserveEntrySignatures: 'strict',
    input: {
      home: path.resolve(projectRoot, 'index.html'),
      editor: path.resolve(projectRoot, 'editor/index.html'),
      print: path.resolve(projectRoot, 'print/index.html'),
      recognize: path.resolve(projectRoot, 'recognize/index.html'),
      library: path.resolve(projectRoot, 'library/index.html'),
      batch: path.resolve(projectRoot, 'batch/index.html'),
      playtest: path.resolve(projectRoot, 'playtest/index.html'),
    },
    output: {
      codeSplitting: {
        groups: [{
          name: 'yugioh-renderer',
          test: id => id.includes(`${path.sep}packages${path.sep}`) ||
            id.includes('yugioh-card@file+packages'),
          priority: 100,
        }],
      },
    },
  },
};

const buildConfigMap = {
  lib: buildLib,
  website: buildWebsite,
};

const deckSourceProxy = () => ({
  name: 'deck-source-proxy',
  configureServer(server) {
    server.middlewares.use('/api/deck-source', async (request, response) => {
      try {
        const requestUrl = new URL(request.url, 'http://localhost');
        const body = await fetchDeckSource(
          requestUrl.searchParams.get('url') || '',
        );
        response.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'private, max-age=300',
        });
        response.end(body);
      } catch (error) {
        response.writeHead(error instanceof DeckSourceError
          ? error.status
          : 502);
        response.end(error instanceof Error ? error.message : String(error));
      }
    });
  },
});

export default defineConfig(({ mode }) => {
  const buildTarget = mode === 'lib' ? 'lib' : 'website';
  const isLib = buildTarget === 'lib';

  return {
    base: './',
    publicDir: false,
    plugins: [
      vue(),
      ...(!isLib ? [deckSourceProxy()] : []),
      ...(isLib ? [viteStaticCopy({
        targets: [
          { src: 'packages/package.json', dest: '.', rename: { stripBase: 1 } },
          { src: ['LICENSE', 'README.md', 'README.en.md'], dest: '.' },
        ],
      }), dts({
        tsconfigPath: path.resolve(projectRoot, 'tsconfig.dts.json'),
        include: ['packages/**/*.js'],
        outDir: 'dist',
        entryRoot: 'packages',
        copyDtsFiles: false,
        insertTypesEntry: false,
        skipDiagnostics: false,
      })] : []),
    ],
    resolve: {
      alias: {
        '@': path.resolve(projectRoot, 'src'),
      },
    },
    build: buildConfigMap[buildTarget],
  };
});
