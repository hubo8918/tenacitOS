import { NextRequest, NextResponse } from "next/server";
import type { Project } from "@/data/mockProjectsData";
import { getProjects, normalizeProject, saveProjects } from "@/lib/projects-data";

function generateId(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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
    const body = (await request.json()) as Record<string, unknown>;
    const title = asTrimmedString(body.title);
    const description = asTrimmedString(body.description);

    if (!title || !description) {
      return NextResponse.json({ error: "Missing required fields: title, description" }, { status: 400 });
    }

    const id = generateId(title);
    if (!id) {
      return NextResponse.json({ error: "Project title must include letters or numbers." }, { status: 400 });
    }

    const projects = await getProjects();
    if (projects.some((project) => project.id === id)) {
      return NextResponse.json({ error: `A project with the title "${title}" already exists.` }, { status: 409 });
    }

    const newProject = normalizeProject({
      id,
      title,
      description,
      status: body.status || "planning",
      progress: body.progress || 0,
      priority: body.priority || "medium",
      agent: body.agent || { emoji: "👤", name: "Unassigned", color: "#8E8E93" },
      updatedAgo: body.updatedAgo || "just now",
      updatedBy: body.updatedBy || "",
      ownerAgentId: body.ownerAgentId,
      participatingAgentIds: body.participatingAgentIds,
      phases: body.phases,
    });

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
    const body = (await request.json()) as Record<string, unknown>;

    if (!body.id) {
      return NextResponse.json({ error: "Missing required field: id" }, { status: 400 });
    }

    const projects = await getProjects();
    const index = projects.findIndex((p) => p.id === body.id);

    if (index === -1) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const updatedProject: Project = normalizeProject({
      ...projects[index],
      ...body,
      agent: body.agent !== undefined ? body.agent : projects[index].agent,
      participatingAgentIds:
        body.participatingAgentIds !== undefined ? body.participatingAgentIds : projects[index].participatingAgentIds,
      phases: body.phases !== undefined ? body.phases : projects[index].phases,
    });

    projects[index] = updatedProject;
    await saveProjects(projects);

    return NextResponse.json(updatedProject);
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
