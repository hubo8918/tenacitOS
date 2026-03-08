import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_PATH = path.join(process.cwd(), 'data', 'team.json');

async function loadTeam() {
  try {
    const data = await fs.readFile(DATA_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function saveTeam(team: any[]) {
  await fs.writeFile(DATA_PATH, JSON.stringify(team, null, 2));
}

// GET — list all team members, optional ?tier= filter
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tier = searchParams.get('tier');
    let team = await loadTeam();
    if (tier) team = team.filter((a: any) => a.tier === tier);
    return NextResponse.json({ team });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load team' }, { status: 500 });
  }
}

// POST — add new team member
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.id || !body.name || !body.role) {
      return NextResponse.json({ error: 'Missing required fields: id, name, role' }, { status: 400 });
    }
    const team = await loadTeam();
    if (team.find((a: any) => a.id === body.id)) {
      return NextResponse.json({ error: 'Agent with this ID already exists' }, { status: 409 });
    }
    const newAgent = {
      id: body.id,
      name: body.name,
      role: body.role,
      emoji: body.emoji || '🤖',
      color: body.color || '#8E8E93',
      description: body.description || '',
      tags: body.tags || [],
      status: body.status || 'offline',
      tier: body.tier || 'io',
      specialBadge: body.specialBadge,
    };
    team.push(newAgent);
    await saveTeam(team);
    return NextResponse.json(newAgent, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create agent' }, { status: 500 });
  }
}

// PUT — update existing team member
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const team = await loadTeam();
    const index = team.findIndex((a: any) => a.id === body.id);
    if (index === -1) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    team[index] = { ...team[index], ...body };
    await saveTeam(team);
    return NextResponse.json(team[index]);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update agent' }, { status: 500 });
  }
}

// DELETE — remove team member
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const team = await loadTeam();
    const index = team.findIndex((a: any) => a.id === id);
    if (index === -1) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    team.splice(index, 1);
    await saveTeam(team);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete agent' }, { status: 500 });
  }
}
