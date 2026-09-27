import { type Plugin, defineConfig } from 'vite';
import { createStateHandler } from './server/stateStore.ts';

// host: true → 0.0.0.0 으로 열어서 같은 네트워크(또는 Tailscale)의 폰에서도 바로 접속한다.
// allowedHosts → IP 주소 접속은 기본 허용. 호스트 이름은 mDNS(*.local)·Tailscale(*.ts.net)만 추가로 연다.
// base: './' → dist/ 를 어느 경로에 두고 정적 서빙해도(python -m http.server 등) 동작한다.
//   (정적 서버에는 /api/state 가 없으므로 그때는 기기별 저장으로만 동작한다)
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
  plugins: [stateApi()],
  server: { host: true, port: 5173, allowedHosts },
  preview: { host: true, port: 4173, allowedHosts },
  build: { target: 'es2022' },
});
