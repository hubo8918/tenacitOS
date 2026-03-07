/**
 * Quick Actions API
 * POST /api/actions  body: { action }
 * Available actions: git-status, restart-gateway, clear-temp, usage-stats, heartbeat
 */
import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fsPromises } from 'fs';
import path from 'path';
import os from 'os';
import { logActivity } from '@/lib/activities-db';

const execAsync = promisify(exec);

import { OPENCLAW_WORKSPACE as WORKSPACE } from '@/lib/paths';

const execOpts = { windowsHide: true } as const;
const isLinux = process.platform === 'linux';

interface ActionResult {
  action: string;
  status: 'success' | 'error';
  output: string;
  duration_ms: number;
  timestamp: string;
}

/** Cross-platform: find git repos up to 2 levels deep */
async function findGitRepos(): Promise<string[]> {
  const repos: string[] = [];
  try {
    const entries = await fsPromises.readdir(WORKSPACE, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const entryPath = path.join(WORKSPACE, entry.name);
      try {
        await fsPromises.access(path.join(entryPath, '.git'));
        repos.push(entryPath);
        continue;
      } catch {}
      try {
        const subs = await fsPromises.readdir(entryPath, { withFileTypes: true });
        for (const sub of subs) {
          if (!sub.isDirectory()) continue;
          try {
            await fsPromises.access(path.join(entryPath, sub.name, '.git'));
            repos.push(path.join(entryPath, sub.name));
          } catch {}
        }
      } catch {}
    }
  } catch {}
  return repos.slice(0, 10);
}

async function runAction(action: string): Promise<ActionResult> {
  const start = Date.now();
  const timestamp = new Date().toISOString();

  try {
    let output = '';

    switch (action) {
      case 'git-status': {
        const repoPaths = await findGitRepos();
        const results: string[] = [];
        for (const repoPath of repoPaths) {
          const name = path.basename(repoPath);
          try {
            const { stdout: status } = await execAsync(`git status --short`, { ...execOpts, cwd: repoPath });
            const { stdout: log } = await execAsync(`git log --oneline -3`, { ...execOpts, cwd: repoPath }).catch(() => ({ stdout: '' }));
            results.push(`📁 ${name}:\n${(status + '\n' + log).trim() || '(clean)'}`);
          } catch {
            results.push(`📁 ${name}: (error reading git status)`);
          }
        }
        output = results.length ? results.join('\n\n') : 'No git repos found in workspace';
        break;
      }

      case 'restart-gateway': {
        if (isLinux) {
          const { stdout, stderr } = await execAsync('systemctl restart openclaw-gateway 2>&1 || echo "Service not found"');
          output = stdout || stderr || 'Restart command executed';
          try {
            const { stdout: status } = await execAsync('systemctl is-active openclaw-gateway 2>&1 || echo "unknown"');
            output += `\nStatus: ${status.trim()}`;
          } catch {}
        } else {
          // On Windows, try pm2
          try {
            const { stdout } = await execAsync('pm2 restart openclaw-gateway', execOpts);
            output = stdout || 'Restart command executed';
          } catch (e) {
            output = `Gateway restart not supported on this platform: ${e instanceof Error ? e.message : String(e)}`;
          }
        }
        break;
      }

      case 'clear-temp': {
        const results: string[] = [];
        if (isLinux) {
          const commands = [
            'find /tmp -maxdepth 1 -type f -mtime +1 -delete 2>/dev/null; echo "Cleaned /tmp"',
            `find "${WORKSPACE}" -name "*.tmp" -o -name "*.bak" | head -20 | xargs rm -f 2>/dev/null; echo "Cleaned tmp/bak files"`,
            'find /root/.pm2/logs -name "*.log" -size +50M -exec truncate -s 10M {} \\; 2>/dev/null; echo "Trimmed large PM2 logs"',
          ];
          const r = await Promise.all(commands.map((cmd) => execAsync(cmd).then((r) => r.stdout).catch((e) => e.message)));
          results.push(...r);
        } else {
          results.push('Temp cleanup not yet supported on Windows');
        }
        output = results.join('\n');
        break;
      }

      case 'usage-stats': {
        const lines: string[] = [];
        try {
          if (isLinux) {
            const { stdout: du } = await execAsync(`du -sh "${WORKSPACE}" 2>/dev/null || echo "N/A"`);
            const { stdout: df } = await execAsync('df -h / | tail -1');
            const { stdout: mem } = await execAsync('free -h | head -2');
            const { stdout: cpu } = await execAsync("top -bn1 | grep 'Cpu(s)' | head -1");
            const { stdout: uptime } = await execAsync('uptime -p');
            lines.push(`Workspace: ${du.trim()}`, `\nDisk: ${df.trim()}`, `\nMemory:\n${mem.trim()}`, `\nCPU: ${cpu.trim()}`, `\nUptime: ${uptime.trim()}`);
          } else {
            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            const usedMem = totalMem - freeMem;
            lines.push(`Memory: ${(usedMem / 1073741824).toFixed(1)}G / ${(totalMem / 1073741824).toFixed(1)}G`);
            lines.push(`CPUs: ${os.cpus().length} cores`);
            lines.push(`Uptime: ${(os.uptime() / 3600).toFixed(1)} hours`);
            lines.push(`Platform: ${os.platform()} ${os.release()}`);
          }
        } catch (e) {
          lines.push(`Error: ${e instanceof Error ? e.message : String(e)}`);
        }
        output = lines.join('\n');
        break;
      }

      case 'heartbeat': {
        const pm2services = ['classvault', 'content-vault', 'brain'];
        const results: string[] = [];

        if (isLinux) {
          const services = ['mission-control'];
          for (const svc of services) {
            const { stdout } = await execAsync(`systemctl is-active ${svc} 2>/dev/null || echo "inactive"`);
            const status = stdout.trim();
            results.push(`${status === 'active' ? '✅' : '❌'} ${svc}: ${status}`);
          }
        }

        try {
          const pm2Cmd = isLinux ? 'pm2 jlist 2>/dev/null' : 'pm2 jlist';
          const { stdout: pm2 } = await execAsync(pm2Cmd, execOpts);
          const pm2list = JSON.parse(pm2);
          for (const svc of pm2services) {
            const proc = pm2list.find((p: { name: string }) => p.name === svc);
            const status = proc?.pm2_env?.status || 'not found';
            results.push(`${status === 'online' ? '✅' : '❌'} ${svc} (pm2): ${status}`);
          }
        } catch {
          results.push('⚠️ PM2: could not connect');
        }

        output = results.join('\n');
        break;
      }

      case 'npm-audit': {
        try {
          const { stdout, stderr } = await execAsync('npm audit --json', { ...execOpts, cwd: path.join(WORKSPACE, 'mission-control') });
          try {
            const j = JSON.parse(stdout);
            output = 'Vulnerabilities: ' + JSON.stringify(j.metadata?.vulnerabilities || {});
          } catch {
            output = stdout || stderr || 'Audit completed';
          }
        } catch (e) {
          output = e instanceof Error ? e.message : 'Audit failed';
        }
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    const duration_ms = Date.now() - start;
    logActivity('command', `Quick action: ${action}`, 'success', { duration_ms, metadata: { action } });

    return { action, status: 'success', output, duration_ms, timestamp };
  } catch (err) {
    const duration_ms = Date.now() - start;
    const errMsg = err instanceof Error ? err.message : String(err);
    logActivity('command', `Quick action failed: ${action}`, 'error', { duration_ms, metadata: { action, error: errMsg } });
    return { action, status: 'error', output: errMsg, duration_ms, timestamp };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json({ error: 'Missing action' }, { status: 400 });
    }

    const validActions = ['git-status', 'restart-gateway', 'clear-temp', 'usage-stats', 'heartbeat', 'npm-audit'];
    if (!validActions.includes(action)) {
      return NextResponse.json({ error: `Unknown action. Valid: ${validActions.join(', ')}` }, { status: 400 });
    }

    const result = await runAction(action);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[actions] Error:', error);
    return NextResponse.json({ error: 'Action failed' }, { status: 500 });
  }
}
