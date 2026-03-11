import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { logActivity } from '@/lib/activities-db';

import { getWorkspaceBase, resolveWorkspaceFilePath } from '@/lib/workspace-files';

function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.ts': 'text/plain',
    '.tsx': 'text/plain',
    '.js': 'text/javascript',
    '.jsx': 'text/javascript',
    '.json': 'application/json',
    '.md': 'text/markdown',
    '.txt': 'text/plain',
    '.log': 'text/plain',
    '.py': 'text/plain',
    '.sh': 'text/plain',
    '.yaml': 'text/yaml',
    '.yml': 'text/yaml',
    '.toml': 'text/plain',
    '.css': 'text/css',
    '.html': 'text/html',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
    '.zip': 'application/zip',
  };
  return mimeMap[ext] || 'application/octet-stream';
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspace = searchParams.get('workspace') || 'workspace';
    const filePath = searchParams.get('path') || '';

    if (!filePath) {
      return NextResponse.json({ error: 'Missing path parameter' }, { status: 400 });
    }

    if (!getWorkspaceBase(workspace)) {
      return NextResponse.json({ error: 'Unknown workspace' }, { status: 400 });
    }

    const resolved = resolveWorkspaceFilePath({ workspace, filePath });
    if (!resolved) {
      return NextResponse.json(
        {
          error:
            'Invalid path. Use a path inside the selected workspace, or an absolute/~/ path that resolves inside a known workspace.',
        },
        { status: 400 }
      );
    }

    const stat = await fs.stat(resolved.fullPath);
    if (!stat.isFile()) {
      return NextResponse.json({ error: 'Not a file' }, { status: 400 });
    }

    const content = await fs.readFile(resolved.fullPath);
    const filename = path.basename(resolved.fullPath);
    const mimeType = getMimeType(filename);

    logActivity('file_read', `Downloaded file: ${resolved.relativePath || filePath}`, 'success', {
      metadata: {
        workspace: resolved.workspace,
        requestedWorkspace: workspace,
        filePath: resolved.relativePath || filePath,
        size: stat.size,
      },
    });

    return new NextResponse(content, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': stat.size.toString(),
      },
    });
  } catch (error) {
    console.error('[download] Error:', error);
    return NextResponse.json({ error: 'Download failed' }, { status: 500 });
  }
}
