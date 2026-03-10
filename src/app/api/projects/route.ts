import { NextRequest, NextResponse } from "next/server";
import type { Project } from "@/data/mockProjectsData";
import { getProjects, saveProjects } from "@/lib/projects-data";

function generateId(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    let projects = await getProjects();

    if (status) {
      projects = projects.filter((p) => p.status === status);
    }

    return NextResponse.json({ projects });
  } catch (error) {
    console.error("Failed to get projects:", error);
    return NextResponse.json({ error: "Failed to get projects" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.title || !body.description) {
      return NextResponse.json(
        { error: "Missing required fields: title, description" },
        { status: 400 }
      );
    }

    const projects = await getProjects();

    const newProject: Project = {
      id: generateId(body.title),
      title: body.title,
      description: body.description,
      status: body.status || "planning",
      progress: body.progress || 0,
      priority: body.priority || "medium",
      agent: body.agent || { emoji: "👤", name: "Unassigned", color: "#8E8E93" },
      updatedAgo: "just now",
      updatedBy: body.updatedBy || "",
    };

    projects.unshift(newProject);
    await saveProjects(projects);

    return NextResponse.json(newProject, { status: 201 });
  } catch (error) {
    console.error("Failed to create project:", error);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json(
        { error: "Missing required field: id" },
        { status: 400 }
      );
    }

    const projects = await getProjects();
    const project = projects.find((p) => p.id === body.id);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (body.title !== undefined) project.title = body.title;
    if (body.description !== undefined) project.description = body.description;
    if (body.status !== undefined) project.status = body.status;
    if (body.progress !== undefined) project.progress = body.progress;
    if (body.priority !== undefined) project.priority = body.priority;
    if (body.agent !== undefined) project.agent = body.agent;
    if (body.updatedAgo !== undefined) project.updatedAgo = body.updatedAgo;
    if (body.updatedBy !== undefined) project.updatedBy = body.updatedBy;

    await saveProjects(projects);

    return NextResponse.json(project);
  } catch (error) {
    console.error("Failed to update project:", error);
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing required query param: id" }, { status: 400 });
    }

    const projects = await getProjects();
    const index = projects.findIndex((p) => p.id === id);

    if (index === -1) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    projects.splice(index, 1);
    await saveProjects(projects);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete project:", error);
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
  }
}
