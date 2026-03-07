/**
 * Git Dashboard API
 * GET /api/git - List all repos with status
 * POST /api/git - { repo, action } actions: status, pull, add, commit
 */
import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import path from 'path';

const execAsync = promisify(exec);
import { OPENCLAW_WORKSPACE as WORKSPACE } from '@/lib/paths';

const execOpts = { windowsHide: true } as const;

interface RepoStatus {
  name: string;
  path: string;
  branch: string;
  ahead: number;
  behind: number;
  staged: string[];
  unstaged: string[];
  untracked: string[];
  lastCommit: { hash: string; message: string; author: string; date: string } | null;
  remoteUrl: string;
  isDirty: boolean;
}

async function getRepos(): Promise<string[]> {
  // Cross-platform: scan workspace for .git dirs up to 2 levels deep
  const repos: string[] = [];
  try {
    const entries = await fs.readdir(WORKSPACE, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const entryPath = path.join(WORKSPACE, entry.name);
      // Check if this dir itself is a git repo
      try {
        await fs.access(path.join(entryPath, '.git'));
        repos.push(entryPath);
        continue;
      } catch {}
      // Check one level deeper
      try {
        const subEntries = await fs.readdir(entryPath, { withFileTypes: true });
        for (const sub of subEntries) {
          if (!sub.isDirectory()) continue;
          const subPath = path.join(entryPath, sub.name);
          try {
            await fs.access(path.join(subPath, '.git'));
            repos.push(subPath);
          } catch {}
        }
      } catch {}
    }
  } catch {}
  // Also check if WORKSPACE itself is a git repo
  try {
    await fs.access(path.join(WORKSPACE, '.git'));
    if (!repos.includes(WORKSPACE)) repos.push(WORKSPACE);
  } catch {}
  return repos;
}

async function getRepoStatus(repoPath: string): Promise<RepoStatus> {
  const name = repoPath.split('/').pop() || repoPath;

  try {
    // Get branch
    const { stdout: branch } = await execAsync(`git rev-parse --abbrev-ref HEAD`, { ...execOpts, cwd: repoPath }).catch(() => ({ stdout: 'unknown' }));

    // Get ahead/behind
    let ahead = 0, behind = 0;
    try {
      const { stdout: abStr } = await execAsync(`git rev-list --left-right --count HEAD...@{upstream}`, { ...execOpts, cwd: repoPath }).catch(() => ({ stdout: '0\t0' }));
      const parts = abStr.trim().split('\t');
      ahead = parseInt(parts[0]) || 0;
      behind = parseInt(parts[1]) || 0;
    } catch {}

    // Get status
    const { stdout: statusOut } = await execAsync(`git status --porcelain`, { ...execOpts, cwd: repoPath }).catch(() => ({ stdout: '' }));
    const lines = statusOut.trim().split('\n').filter(Boolean);

    const staged: string[] = [];
    const unstaged: string[] = [];
    const untracked: string[] = [];

    for (const line of lines) {
      const xy = line.slice(0, 2);
      const file = line.slice(3);
      const x = xy[0]; // staged
      const y = xy[1]; // unstaged

      if (x !== ' ' && x !== '?') staged.push(file);
      if (y !== ' ' && y !== '?') unstaged.push(file);
      if (xy === '??') untracked.push(file);
    }

    // Last commit
    let lastCommit = null;
    try {
      const { stdout: commitOut } = await execAsync(`git log -1 --format="%H|%s|%an|%ar"`, { ...execOpts, cwd: repoPath });
      const parts = commitOut.trim().split('|');
      if (parts.length >= 4) {
        lastCommit = { hash: parts[0].slice(0, 8), message: parts[1], author: parts[2], date: parts[3] };
      }
    } catch {}

    // Remote URL
    let remoteUrl = '';
    try {
      const { stdout: remote } = await execAsync(`git remote get-url origin`, { ...execOpts, cwd: repoPath });
      remoteUrl = remote.trim();
    } catch {}

    return {
      name,
      path: repoPath,
      branch: branch.trim(),
      ahead,
      behind,
      staged,
      unstaged,
      untracked,
      lastCommit,
      remoteUrl,
      isDirty: staged.length > 0 || unstaged.length > 0 || untracked.length > 0,
    };
  } catch (error) {
    return {
      name,
      path: repoPath,
      branch: 'unknown',
      ahead: 0,
      behind: 0,
      staged: [],
      unstaged: [],
      untracked: [],
      lastCommit: null,
      remoteUrl: '',
      isDirty: false,
    };
  }
}

export async function GET() {
  try {
    const repos = await getRepos();
    const statuses = await Promise.all(repos.map(getRepoStatus));
    return NextResponse.json({ repos: statuses, total: statuses.length });
  } catch (error) {
    console.error('[git] Error:', error);
    return NextResponse.json({ error: 'Failed to get repos' }, { status: 500 });
  }
}

const ALLOWED_REPOS = [WORKSPACE + '/mission-control', WORKSPACE];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { repo, action } = body;

    // Security: only allow repos under workspace
    if (!repo || !repo.startsWith(WORKSPACE)) {
      return NextResponse.json({ error: 'Invalid repo path' }, { status: 400 });
    }

    let output = '';

    switch (action) {
      case 'status': {
        const { stdout } = await execAsync(`git status`, { ...execOpts, cwd: repo });
        output = stdout;
        break;
      }
      case 'pull': {
        const { stdout } = await execAsync(`git pull`, { ...execOpts, cwd: repo });
        output = stdout;
        break;
      }
      case 'log': {
        const { stdout } = await execAsync(`git log --oneline -20`, { ...execOpts, cwd: repo });
        output = stdout;
        break;
      }
      case 'diff': {
        const { stdout } = await execAsync(`git diff --stat`, { ...execOpts, cwd: repo });
        output = stdout || 'No changes';
        break;
      }
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    return NextResponse.json({ success: true, output, repo, action });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
