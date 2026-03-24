import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync } from 'child_process';

import { OPENCLAW_CONFIG, OPENCLAW_WORKSPACE, WORKSPACE_IDENTITY } from '@/lib/paths';

const WORKSPACE_PATH = OPENCLAW_WORKSPACE;
const IDENTITY_PATH = WORKSPACE_IDENTITY;
const ENV_LOCAL_PATH = path.join(process.cwd(), '.env.local');
const OPENCLAW_CMD = 'openclaw';
const OPENCLAW_POWERSHELL_SCRIPT =
  process.platform === 'win32' && process.env.APPDATA
    ? path.join(process.env.APPDATA, 'npm', 'openclaw.ps1')
    : null;
const CLI_NOISE_PREFIXES = [
  '[secrets]',
  'Gateway target:',
  'Source:',
  'Config:',
  'Bind:',
];

interface OpenClawConfig {
  agents?: {
    defaults?: {
      model?: {
        primary?: string;
        fallbacks?: string[];
      };
    };
  };
  channels?: {
    telegram?: {
      enabled?: boolean;
      accounts?: Record<string, unknown>;
    };
  };
  plugins?: {
    entries?: Record<string, { enabled?: boolean }>;
  };
}

interface OpenClawSession {
  agentId?: string;
  updatedAt?: number;
  model?: string;
  modelProvider?: string;
}

interface OpenClawSessionsPayload {
  sessions?: OpenClawSession[];
}

interface RecentSessionModelSummary {
  model: string;
  provider: string | null;
  count: number;
}

function readOpenClawConfig(): OpenClawConfig | null {
  try {
    return JSON.parse(fs.readFileSync(OPENCLAW_CONFIG, 'utf-8')) as OpenClawConfig;
  } catch {
    return null;
  }
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
}

function loadConfiguredModelSummary(): { primary: string; fallbacks: string[] } {
  const config = readOpenClawConfig();
  const fallbackPrimary = process.env.OPENCLAW_MODEL || process.env.DEFAULT_MODEL || 'unknown';

  return {
    primary: config?.agents?.defaults?.model?.primary || fallbackPrimary,
    fallbacks: normalizeStringArray(config?.agents?.defaults?.model?.fallbacks),
  };
}

function runOpenClaw(args: string[]): string {
  const execOptions = {
    encoding: 'utf-8' as BufferEncoding,
    timeout: 10000,
    windowsHide: true,
  };

  let result = null as ReturnType<typeof spawnSync> | null;

  if (OPENCLAW_POWERSHELL_SCRIPT) {
    result = spawnSync(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', OPENCLAW_POWERSHELL_SCRIPT, ...args],
      execOptions
    );
  }

  if (!result || result.error?.message?.includes('ENOENT')) {
    result = spawnSync(OPENCLAW_CMD, args, {
      ...execOptions,
      shell: process.platform === 'win32',
    });
  }

  if (result.error) {
    throw result.error;
  }

  const stdoutText =
    typeof result.stdout === 'string'
      ? result.stdout
      : result.stdout
      ? result.stdout.toString('utf-8')
      : '';
  const stderrText =
    typeof result.stderr === 'string'
      ? result.stderr
      : result.stderr
      ? result.stderr.toString('utf-8')
      : '';

  if (result.status !== 0) {
    throw new Error((stderrText || stdoutText || 'openclaw command failed').trim());
  }

  return stdoutText.trim();
}

function stripCliNoise(raw: string): string {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !CLI_NOISE_PREFIXES.some((prefix) => line.startsWith(prefix)))
    .join('\n')
    .trim();
}

function extractJsonBlock(text: string): string | null {
  const start = text.search(/[\[{]/);
  if (start === -1) return null;

  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{' || ch === '[') {
      stack.push(ch === '{' ? '}' : ']');
      continue;
    }

    if ((ch === '}' || ch === ']') && stack.length > 0) {
      const expected = stack[stack.length - 1];
      if (ch === expected) {
        stack.pop();
        if (stack.length === 0) {
          return text.slice(start, i + 1);
        }
      }
    }
  }

  return null;
}

function parseJsonFromCliOutput(raw: string): unknown {
  const cleaned = stripCliNoise(raw);
  const candidates = [cleaned, raw.trim()].filter(Boolean);

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // continue
    }

    const block = extractJsonBlock(candidate);
    if (!block) continue;

    try {
      return JSON.parse(block);
    } catch {
      // continue
    }
  }

  throw new Error('CLI returned non-JSON output');
}

function loadRecentSessionModelSummary(): RecentSessionModelSummary[] {
  try {
    const output = runOpenClaw(['sessions', '--all-agents', '--json']);
    const parsed = parseJsonFromCliOutput(output) as OpenClawSessionsPayload;
    const sessions = Array.isArray(parsed?.sessions) ? parsed.sessions : [];
    const latestByAgent = new Map<string, OpenClawSession>();

    for (const session of sessions) {
      if (!session || typeof session !== 'object') continue;
      if (typeof session.agentId !== 'string') continue;
      if (typeof session.updatedAt !== 'number') continue;
      if (typeof session.model !== 'string' || session.model.trim().length === 0) continue;

      const current = latestByAgent.get(session.agentId);
      if (!current || (current.updatedAt ?? 0) < session.updatedAt) {
        latestByAgent.set(session.agentId, session);
      }
    }

    const counts = new Map<string, RecentSessionModelSummary>();
    for (const session of latestByAgent.values()) {
      if (!session?.model) continue;

      const provider = typeof session.modelProvider === 'string' ? session.modelProvider : null;
      const key = provider ? `${provider}/${session.model}` : session.model;
      const existing = counts.get(key);

      if (existing) {
        existing.count += 1;
        continue;
      }

      counts.set(key, {
        model: session.model,
        provider,
        count: 1,
      });
    }

    return Array.from(counts.values()).sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return `${left.provider || ''}/${left.model}`.localeCompare(
        `${right.provider || ''}/${right.model}`
      );
    });
  } catch {
    return [];
  }
}

function parseIdentityMd(): { name: string; creature: string; emoji: string } {
  try {
    const content = fs.readFileSync(IDENTITY_PATH, 'utf-8');
    const nameMatch = content.match(/\*\*Name:\*\*\s*(.+)/);
    const creatureMatch = content.match(/\*\*Creature:\*\*\s*(.+)/);
    const emojiMatch = content.match(/\*\*Emoji:\*\*\s*(.+)/);

    return {
      name: nameMatch?.[1]?.trim() || 'Unknown',
      creature: creatureMatch?.[1]?.trim() || 'AI Agent',
      emoji: emojiMatch?.[1]?.match(/./u)?.[0] || '\u{1F916}',
    };
  } catch {
    return { name: 'OpenClaw Agent', creature: 'AI Agent', emoji: '\u{1F916}' };
  }
}

function getIntegrationStatus() {
  const integrations = [];
  const openclawConfig = readOpenClawConfig();

  let telegramEnabled = false;
  let telegramAccounts = 0;
  try {
    const telegramConfig = openclawConfig?.channels?.telegram;
    telegramEnabled = !!telegramConfig?.enabled;
    if (telegramConfig?.accounts) {
      telegramAccounts = Object.keys(telegramConfig.accounts).length;
    }
  } catch {
    telegramEnabled = false;
  }
  integrations.push({
    id: 'telegram',
    name: 'Telegram',
    status: telegramEnabled ? 'connected' : 'disconnected',
    icon: 'MessageCircle',
    lastActivity: telegramEnabled ? new Date().toISOString() : null,
    detail: telegramEnabled ? `${telegramAccounts} bots configured` : null,
  });

  let twitterConfigured = false;
  try {
    const toolsPath = path.join(WORKSPACE_PATH, 'TOOLS.md');
    const toolsContent = fs.readFileSync(toolsPath, 'utf-8');
    twitterConfigured = toolsContent.includes('bird') && toolsContent.includes('auth_token');
  } catch {
    twitterConfigured = false;
  }
  integrations.push({
    id: 'twitter',
    name: 'Twitter (bird CLI)',
    status: twitterConfigured ? 'configured' : 'not_configured',
    icon: 'Twitter',
    lastActivity: null,
    detail: null,
  });

  let googleConfigured = false;
  let googleDetail: string | null = null;
  try {
    const gogPlugin = openclawConfig?.plugins?.entries?.['google-gemini-cli-auth'];
    googleConfigured = !!gogPlugin?.enabled;
    if (googleConfigured) {
      googleDetail = 'google-gemini-cli-auth plugin enabled';
    }
  } catch {
    googleConfigured = false;
  }
  if (!googleConfigured) {
    try {
      const gogPath = path.join(os.homedir(), '.config', 'gog');
      googleConfigured = fs.existsSync(gogPath);
    } catch {
      googleConfigured = false;
    }
  }
  integrations.push({
    id: 'google',
    name: 'Google (GOG)',
    status: googleConfigured ? 'configured' : 'not_configured',
    icon: 'Mail',
    lastActivity: null,
    detail: googleDetail,
  });

  return integrations;
}

export async function GET() {
  const identity = parseIdentityMd();
  const uptime = process.uptime();
  const nodeVersion = process.version;
  const configuredModel = loadConfiguredModelSummary();
  const recentSessionModels = loadRecentSessionModelSummary();

  const systemInfo = {
    agent: {
      name: identity.name,
      creature: identity.creature,
      emoji: identity.emoji,
    },
    system: {
      uptime: Math.floor(uptime),
      uptimeFormatted: formatUptime(uptime),
      nodeVersion,
      model: configuredModel.primary,
      modelPrimary: configuredModel.primary,
      configuredFallbackModels: configuredModel.fallbacks,
      recentSessionModels,
      workspacePath: WORKSPACE_PATH,
      platform: os.platform(),
      hostname: os.hostname(),
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem(),
      },
    },
    integrations: getIntegrationStatus(),
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(systemInfo);
}

export async function POST(request: Request) {
  try {
    const { action, data } = await request.json();

    if (action === 'change_password') {
      const { currentPassword, newPassword } = data;

      let envContent = '';
      try {
        envContent = fs.readFileSync(ENV_LOCAL_PATH, 'utf-8');
      } catch {
        return NextResponse.json({ error: 'Could not read configuration' }, { status: 500 });
      }

      const currentPassMatch = envContent.match(/AUTH_PASSWORD=(.+)/);
      const storedPassword = currentPassMatch?.[1]?.trim();

      if (storedPassword !== currentPassword) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
      }

      const newEnvContent = envContent.replace(/AUTH_PASSWORD=.*/, `AUTH_PASSWORD=${newPassword}`);
      fs.writeFileSync(ENV_LOCAL_PATH, newEnvContent);

      return NextResponse.json({ success: true, message: 'Password updated successfully' });
    }

    if (action === 'clear_activity_log') {
      const activitiesPath = path.join(process.cwd(), 'data', 'activities.json');
      fs.writeFileSync(activitiesPath, '[]');
      return NextResponse.json({ success: true, message: 'Activity log cleared' });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Action failed' }, { status: 500 });
  }
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (parts.length === 0) parts.push(`${Math.floor(seconds)}s`);

  return parts.join(' ');
}
