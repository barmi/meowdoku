import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { type Plugin, defineConfig } from 'vite';
import { createStateHandler } from './server/stateStore.ts';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };
type StorageMode = 'server' | 'browser';

function selectedStorageMode(): StorageMode {
  const mode = process.env.MEOWDOKU_STORAGE_MODE ?? 'server';
  if (mode === 'server' || mode === 'browser') return mode;
  throw new Error(`MEOWDOKU_STORAGE_MODE must be "server" or "browser" (received: ${mode})`);
}

const storageMode = selectedStorageMode();

function buildRevision(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return 'dev';
  }
}

// host: true → 0.0.0.0 으로 열어서 같은 네트워크(또는 Tailscale)의 폰에서도 바로 접속한다.
// allowedHosts → IP 주소 접속은 기본 허용. 호스트 이름은 mDNS(*.local)·Tailscale(*.ts.net)만 추가로 연다.
// base: './' → dist/ 를 어느 경로에 두고 정적 서빙해도(python -m http.server 등) 동작한다.
//   browser 모드는 GitHub Pages처럼 /api/state가 없는 정적 배포 전용이다 (#16).
const allowedHosts = ['.local', '.ts.net'];

/** dev(npm run dev)·preview(npm run serve) 서버 모두에 게임 상태 저장 API 를 붙인다 (#6) */
function stateApi(): Plugin {
  const handler = createStateHandler();
  return {
    name: 'meowdoku-state-api',
    configureServer: (server) => void server.middlewares.use(handler),
    configurePreviewServer: (server) => void server.middlewares.use(handler),
  };
}

export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_REVISION__: JSON.stringify(buildRevision()),
    __STORAGE_MODE__: JSON.stringify(storageMode),
    __SAVE_STORAGE_KEY__: JSON.stringify(
      storageMode === 'server' ? 'meowdoku.save.v1' : 'meowdoku.browser.save.v1',
    ),
  },
  resolve: {
    // Pages 산출물에는 서버 동기화 클라이언트 자체가 들어가지 않도록 구현 모듈을 교체한다.
    alias: {
      '@sync-client': fileURLToPath(
        new URL(storageMode === 'server' ? './src/game/sync.ts' : './src/game/syncBrowser.ts', import.meta.url),
      ),
    },
  },
  // browser 빌드에는 저장 API 플러그인을 붙이지 않는다. 클라이언트도 서버 호출을 비활성화한다.
  plugins: storageMode === 'server' ? [stateApi()] : [],
  server: { host: true, port: 5173, allowedHosts },
  preview: { host: true, port: 4173, allowedHosts },
  build: { target: 'es2022' },
});
