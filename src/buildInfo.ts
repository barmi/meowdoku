export interface BuildInfo {
  version: string;
  revision: string;
}

const version = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';
const revision = typeof __BUILD_REVISION__ === 'string' ? __BUILD_REVISION__ : 'dev';

/** package.json 버전과 빌드 시점의 Git 커밋을 화면에서 함께 확인한다 (#17). */
export const BUILD_INFO: Readonly<BuildInfo> = Object.freeze({ version, revision });

export function buildLabel(info: BuildInfo = BUILD_INFO): string {
  return `버전 ${info.version} · 빌드 ${info.revision}`;
}
