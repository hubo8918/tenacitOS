import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

const DATA_PATH = path.join(process.cwd(), 'data', 'docs.json');

export interface DocFolder {
  id: string;
  name: string;
  emoji: string;
  agent?: { name: string; emoji: string; color: string };
  fileCount: number;
}

export interface DocFile {
  id: string;
  name: string;
  type: string;
  size: string;
  modifiedAt: string;
  modifiedBy: { name: string; emoji: string; color: string };
  folderId: string;
}

interface DocsData {
  folders: DocFolder[];
  files: DocFile[];
}

async function loadDocs(): Promise<DocsData> {
  try {
    const data = await fs.readFile(DATA_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { folders: [], files: [] };
  }
}

async function saveDocs(docs: DocsData): Promise<void> {
  const dir = path.dirname(DATA_PATH);
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
  await fs.writeFile(DATA_PATH, JSON.stringify(docs, null, 2));
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get('folderId');

    const docs = await loadDocs();

    let files = docs.files;
    if (folderId) {
      files = files.filter((f) => f.folderId === folderId);
    }

    return NextResponse.json({ folders: docs.folders, files });
  } catch (error) {
    console.error('Failed to get docs:', error);
    return NextResponse.json({ error: 'Failed to get docs' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.name || !body.folderId || !body.type) {
      return NextResponse.json(
        { error: 'Missing required fields: name, folderId, type' },
        { status: 400 }
      );
    }

    const docs = await loadDocs();

    const folder = docs.folders.find((f) => f.id === body.folderId);
    if (!folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    const newFile: DocFile = {
      id: randomUUID(),
      name: body.name,
      type: body.type,
      size: body.size || '0 KB',
      modifiedAt: new Date().toISOString().split('T')[0],
      modifiedBy: body.modifiedBy || { name: 'Unknown', emoji: '❓', color: '#999999' },
      folderId: body.folderId,
    };

    docs.files.push(newFile);
    folder.fileCount += 1;

    await saveDocs(docs);

    return NextResponse.json(newFile, { status: 201 });
  } catch (error) {
    console.error('Failed to create doc:', error);
    return NextResponse.json({ error: 'Failed to create doc' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json({ error: 'Missing required field: id' }, { status: 400 });
    }

    const docs = await loadDocs();

    const index = docs.files.findIndex((f) => f.id === body.id);
    if (index === -1) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    docs.files[index] = { ...docs.files[index], ...body, id: docs.files[index].id };

    await saveDocs(docs);

    return NextResponse.json(docs.files[index]);
  } catch (error) {
    console.error('Failed to update doc:', error);
    return NextResponse.json({ error: 'Failed to update doc' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing required query param: id' }, { status: 400 });
    }

    const docs = await loadDocs();

    const index = docs.files.findIndex((f) => f.id === id);
    if (index === -1) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const deletedFile = docs.files[index];
    docs.files.splice(index, 1);

    const folder = docs.folders.find((f) => f.id === deletedFile.folderId);
    if (folder) {
      folder.fileCount = Math.max(0, folder.fileCount - 1);
    }

    await saveDocs(docs);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete doc:', error);
    return NextResponse.json({ error: 'Failed to delete doc' }, { status: 500 });
  }
}
