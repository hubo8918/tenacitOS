/**
 * Service action API
 * POST /api/system/services
 * Body: { name, backend, action }  action: restart | stop | start | logs
 */
import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import path from 'path';

const execAsync = promisify(exec);
const execOpts = { windowsHide: true } as const;
const isLinux = process.platform === 'linux';

const ALLOWED_SERVICES_PM2 = ['classvault', 'content-vault', 'postiz-simple', 'brain'];
const ALLOWED_SERVICES_SYSTEMD = ['mission-control', 'openclaw-gateway', 'nginx'];
const ALLOWED_DOCKER_IDS_PATTERN = /^[a-f0-9]{6,64}$|^[a-zA-Z0-9_-]+$/;

async function pm2Action(name: string, action: string): Promise<string> {
  if (!ALLOWED_SERVICES_PM2.includes(name)) {
    throw new Error(`Service "${name}" not in allowlist`);
  }
  if (!['restart', 'stop', 'start', 'logs'].includes(action)) {
    throw new Error(`Invalid action "${action}"`);
  }

  if (action === 'logs') {
    try {
      const pm2Home = process.env.PM2_HOME || path.join(os.homedir(), '.pm2');
      const logFile = path.join(pm2Home, 'logs', `${name}-out.log`);
      const errFile = path.join(pm2Home, 'logs', `${name}-error.log`);
      if (isLinux) {
        const { stdout } = await execAsync(`tail -100 "${logFile}" 2>/dev/null || echo "No logs available"`);
        const { stdout: errOut } = await execAsync(`tail -50 "${errFile}" 2>/dev/null || echo ""`).catch(() => ({ stdout: '' }));
        return `=== STDOUT (last 100 lines) ===\n${stdout}\n${errOut ? `\n=== STDERR (last 50 lines) ===\n${errOut}` : ''}`;
      } else {
        const { stdout } = await execAsync(`powershell -Command "Get-Content '${logFile}' -Tail 100 -ErrorAction SilentlyContinue"`, execOpts).catch(() => ({ stdout: 'No logs available' }));
        return `=== STDOUT (last 100 lines) ===\n${stdout}`;
      }
    } catch {
      return 'Could not retrieve logs';
    }
  }

  const { stdout, stderr } = await execAsync(`pm2 ${action} "${name}"`, execOpts);
  return stdout + (stderr ? `\nSTDERR: ${stderr}` : '');
}

async function systemdAction(name: string, action: string): Promise<string> {
  if (!ALLOWED_SERVICES_SYSTEMD.includes(name)) {
    throw new Error(`Service "${name}" not in allowlist`);
  }
  if (!['restart', 'stop', 'start', 'logs'].includes(action)) {
    throw new Error(`Invalid action "${action}"`);
  }
  if (!isLinux) {
    return `systemd is not available on ${process.platform}`;
  }

  if (action === 'logs') {
    const { stdout } = await execAsync(`journalctl -u "${name}" -n 100 --no-pager 2>&1`);
    return stdout;
  }

  const { stdout } = await execAsync(`systemctl ${action} "${name}" 2>&1`);
  return stdout || `${action} executed successfully`;
}

async function dockerAction(id: string, action: string): Promise<string> {
  if (!ALLOWED_DOCKER_IDS_PATTERN.test(id)) {
    throw new Error(`Invalid container ID "${id}"`);
  }
  if (!['start', 'stop', 'restart', 'logs'].includes(action)) {
    throw new Error(`Invalid action "${action}"`);
  }

  if (action === 'logs') {
    const { stdout } = await execAsync(`docker logs --tail 100 "${id}"`, execOpts);
    return stdout;
  }

  const { stdout } = await execAsync(`docker ${action} "${id}"`, execOpts);
  return stdout || `${action} executed successfully`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, backend, action } = body;

    if (!name || !backend || !action) {
      return NextResponse.json({ error: 'Missing name, backend or action' }, { status: 400 });
    }

    let output = '';

    switch (backend) {
      case 'pm2':
        output = await pm2Action(name, action);
        break;
      case 'systemd':
        output = await systemdAction(name, action);
        break;
      case 'docker':
        output = await dockerAction(name, action);
        break;
      default:
        return NextResponse.json({ error: `Unknown backend "${backend}"` }, { status: 400 });
    }

    return NextResponse.json({ success: true, output, action, name, backend });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[services API] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
