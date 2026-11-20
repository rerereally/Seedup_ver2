// How each coding agent connects to the Seedup MCP endpoint. Formats checked against each tool's docs on 2026-11-19:
// Codex (developers.openai.com/codex/mcp), Antigravity (antigravity.google/docs/mcp), Cursor, VS Code, Gemini CLI,
// Windsurf. Apps without a header field (Claude and ChatGPT connectors) take the key URL, where the token is the path.

export type McpClientId = 'claude-code' | 'claude' | 'codex' | 'cursor' | 'vscode' | 'antigravity' | 'gemini' | 'windsurf' | 'chatgpt';

export type McpClient = {
  id: McpClientId;
  name: string;
  /** One-click install link, when the app has one. */
  link?: string;
  /** What to paste and where. */
  snippet: string;
  where: string;
  steps: string[];
  /** The snippet is the key URL itself, so it must be treated like a password. */
  keyUrl?: boolean;
};

const json = (value: unknown) => JSON.stringify(value, null, 2);
// btoa takes Latin-1 only and the placeholder token is not, so the JSON is encoded as UTF-8 bytes first.
const base64 = (text: string) => btoa(String.fromCharCode(...new TextEncoder().encode(text)));

export function mcpClients(siteUrl: string, token: string): McpClient[] {
  const endpoint = `${siteUrl.replace(/\/+$/, '')}/api/mcp`;
  const headers = { Authorization: `Bearer ${token}` };
  const keyUrl = `${endpoint}/${token}`;
  return [
    {
      id: 'claude-code',
      name: 'Claude Code',
      snippet: `claude mcp add --transport http seedup ${endpoint} --header "Authorization: Bearer ${token}"`,
      where: '터미널',
      steps: ['명령을 복사해 터미널에서 실행합니다.', 'Claude Code에서 /mcp를 입력하면 seedup이 연결됨으로 보입니다.'],
    },
    {
      id: 'claude',
      name: 'Claude 앱',
      snippet: keyUrl,
      where: 'Claude 데스크톱·웹 → 설정 → 커넥터',
      steps: ['설정 → 커넥터에서 "맞춤 커넥터 추가"를 누릅니다.', '이름은 Seedup, URL에 아래 주소를 붙여 넣고 추가합니다. 인증 설정은 비워 둡니다.', '대화창의 도구 메뉴에서 Seedup을 켭니다.'],
      keyUrl: true,
    },
    {
      id: 'codex',
      name: 'Codex',
      snippet: `[mcp_servers.seedup]\nurl = "${endpoint}"\ntool_timeout_sec = 180\nhttp_headers = { Authorization = "Bearer ${token}" }`,
      where: '~/.codex/config.toml',
      steps: [
        '~/.codex/config.toml 파일 끝에 붙여 넣습니다. Codex CLI, IDE 확장, 앱이 이 파일을 같이 씁니다.',
        'tool_timeout_sec는 검증·PRD 호출이 최대 약 2분 30초 걸려도 Codex가 기본값(60초)에서 끊지 않게 합니다.',
        'Codex를 다시 열고 /mcp로 seedup을 확인합니다.',
      ],
    },
    {
      id: 'cursor',
      name: 'Cursor',
      link: `cursor://anysphere.cursor-deeplink/mcp/install?name=seedup&config=${encodeURIComponent(base64(JSON.stringify({ url: endpoint, headers })))}`,
      snippet: json({ mcpServers: { seedup: { url: endpoint, headers } } }),
      where: '~/.cursor/mcp.json',
      steps: ['"Cursor에서 열기"를 누르고 Cursor 창에서 설치를 누릅니다.', '버튼이 안 되면 아래 설정을 ~/.cursor/mcp.json에 붙여 넣습니다.'],
    },
    {
      id: 'vscode',
      name: 'VS Code',
      link: `vscode:mcp/install?${encodeURIComponent(JSON.stringify({ name: 'seedup', type: 'http', url: endpoint, headers }))}`,
      snippet: json({ servers: { seedup: { type: 'http', url: endpoint, headers } } }),
      where: '.vscode/mcp.json',
      steps: ['"VS Code에서 열기"를 누르고 설치를 누릅니다. Copilot 에이전트 모드에서 씁니다.', '버튼이 안 되면 아래 설정을 프로젝트의 .vscode/mcp.json에 붙여 넣습니다.'],
    },
    {
      id: 'antigravity',
      name: 'Antigravity',
      snippet: json({ mcpServers: { seedup: { serverUrl: endpoint, headers } } }),
      where: '~/.gemini/config/mcp_config.json',
      steps: ['에이전트 패널 위 … → MCP Servers → Manage MCP Servers → View raw config를 엽니다.', 'mcpServers 안에 seedup 항목을 붙여 넣고 저장한 뒤 새로고침합니다.'],
    },
    {
      id: 'gemini',
      name: 'Gemini CLI',
      snippet: json({ mcpServers: { seedup: { httpUrl: endpoint, headers } } }),
      where: '~/.gemini/settings.json',
      steps: ['~/.gemini/settings.json의 mcpServers 안에 붙여 넣습니다.', 'Gemini CLI에서 /mcp로 seedup을 확인합니다.'],
    },
    {
      id: 'windsurf',
      name: 'Windsurf',
      snippet: json({ mcpServers: { seedup: { serverUrl: endpoint, headers } } }),
      where: '~/.codeium/windsurf/mcp_config.json',
      steps: ['Cascade 패널의 MCP 설정에서 View raw config를 엽니다.', 'mcpServers 안에 붙여 넣고 새로고침합니다.'],
    },
    {
      id: 'chatgpt',
      name: 'ChatGPT',
      snippet: keyUrl,
      where: 'ChatGPT → 설정 → 앱 → 고급 설정(개발자 모드)',
      steps: ['개발자 모드를 켜고 "앱 만들기"를 누릅니다.', 'MCP 서버 URL에 아래 주소를 넣고, 인증은 "없음"을 고릅니다.'],
      keyUrl: true,
    },
  ];
}
