/**
 * Write file content endpoint
 * POST /api/files/write
 * Body: { workspace, path, content }
 */
import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { logActivity } from '@/lib/activities-db';

import { getWorkspaceBase, resolveWorkspaceFilePath } from '@/lib/workspace-files';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspace, path: filePath, content } = body;

    if (!filePath || content === undefined) {
      return NextResponse.json({ error: 'Missing path or content' }, { status: 400 });
    }

    const requestedWorkspace = workspace || 'workspace';
    const workspaceEntry = getWorkspaceBase(requestedWorkspace);
    if (!workspaceEntry) {
      return NextResponse.json({ error: 'Unknown workspace' }, { status: 400 });
    }

    const resolved = resolveWorkspaceFilePath({ workspace: requestedWorkspace, filePath });
    if (!resolved) {
      return NextResponse.json(
        {
          error:
            'Invalid path. Use a path inside the selected workspace, or an absolute/~/ path that resolves inside a known workspace.',
        },
        { status: 400 }
      );
    }

    await fs.mkdir(path.dirname(resolved.fullPath), { recursive: true });
    await fs.writeFile(resolved.fullPath, content, 'utf-8');

    const stat = await fs.stat(resolved.fullPath);

    logActivity('file_write', `Edited file: ${resolved.relativePath || filePath}`, 'success', {
      metadata: {
        workspace: resolved.workspace,
        requestedWorkspace,
        filePath: resolved.relativePath || filePath,
        size: stat.size,
      },
    });

    return NextResponse.json({
      success: true,
      workspace: resolved.workspace,
      path: resolved.relativePath || filePath,
      size: stat.size,
    });
  } catch (error) {
    console.error('[write] Error:', error);
    return NextResponse.json({ error: 'Write failed' }, { status: 500 });
  }
}
