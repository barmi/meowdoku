import { defineConfig } from 'vite';

// host: true → 0.0.0.0 으로 열어서 같은 네트워크(또는 Tailscale)의 폰에서도 바로 접속한다.
// allowedHosts → IP 주소 접속은 기본 허용. 호스트 이름은 mDNS(*.local)·Tailscale(*.ts.net)만 추가로 연다.
// base: './' → dist/ 를 어느 경로에 두고 정적 서빙해도(python -m http.server 등) 동작한다.
const allowedHosts = ['.local', '.ts.net'];

export default defineConfig({
  base: './',
  server: { host: true, port: 5173, allowedHosts },
  preview: { host: true, port: 4173, allowedHosts },
  build: { target: 'es2022' },
});
