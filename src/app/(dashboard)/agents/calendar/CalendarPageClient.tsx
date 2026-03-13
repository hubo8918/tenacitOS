"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { taskStatusConfig } from "@/data/mockTasksData";
import type { Task } from "@/data/mockTasksData";
import { useFetch } from "@/lib/useFetch";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getDaysInMonth(y: number, m: number) {
  return new Date(y, m + 1, 0).getDate();
}
function getFirstDay(y: number, m: number) {
  return new Date(y, m, 1).getDay();
}
function fmtMonth(y: number, m: number) {
  return new Date(y, m).toLocaleString("default", { month: "long", year: "numeric" });
}
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function parseLocalDate(dateString: string) {
  if (!dateString) return null;

  const [year, month, day] = dateString.split("-").map((part) => Number(part));
  if (!year || !month || !day) return null;

  return new Date(year, month - 1, day);
}
function isOpenTask(task: Task) {
  return task.status !== "completed";
}
function isTaskOverdue(task: Task, startOfTodayTime: number) {
  const dueDate = parseLocalDate(task.dueDate);
  return Boolean(dueDate && isOpenTask(task) && dueDate.getTime() < startOfTodayTime);
}
function isTaskUpcoming(task: Task, startOfTodayTime: number, horizonEndTime: number) {
  const dueDate = parseLocalDate(task.dueDate);
  if (!dueDate || !isOpenTask(task)) return false;

  const dueTime = dueDate.getTime();
  return dueTime >= startOfTodayTime && dueTime <= horizonEndTime;
}
function getTaskAgentKey(task: Task) {
  return task.assigneeAgentId || task.agent.id || task.agent.name || "unassigned";
}
function getTaskSortScore(task: Task, startOfTodayTime: number) {
  if (task.status === "blocked") return 0;
  if (isTaskOverdue(task, startOfTodayTime)) return 1;
  if (task.status === "in_progress") return 2;
  if (task.status === "pending") return 3;
  return 4;
}

interface CalendarPageClientProps {
  initialTasks: Task[];
}

interface WorkloadAgentSummary {
  key: string;
  name: string;
  emoji: string;
  color: string;
  openCount: number;
  blockedCount: number;
  overdueCount: number;
  conflictDays: number;
}

export default function CalendarPageClient({ initialTasks }: CalendarPageClientProps) {
  const hasInitialTasks = initialTasks.length > 0;
  const { data, loading, error, refetch } = useFetch<{ tasks: Task[] }>("/api/agent-tasks", {
    initialData: hasInitialTasks ? { tasks: initialTasks } : null,
    fetchOnMount: !hasInitialTasks,
  });
  const tasks = data?.tasks ?? initialTasks;

  const today = new Date();
  const startOfTodayTime = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const upcomingHorizonTime = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7).getTime();

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDay(year, month);

  const tasksByDate = useMemo(() => {
    const nextMap = new Map<string, Task[]>();

    tasks.forEach((task) => {
      if (!task.dueDate) return;
      if (!nextMap.has(task.dueDate)) nextMap.set(task.dueDate, []);
      nextMap.get(task.dueDate)!.push(task);
    });

    nextMap.forEach((dayTasks, dateKey) => {
      nextMap.set(
        dateKey,
        [...dayTasks].sort((a, b) => {
          const scoreDiff = getTaskSortScore(a, startOfTodayTime) - getTaskSortScore(b, startOfTodayTime);
          if (scoreDiff !== 0) return scoreDiff;
          return a.title.localeCompare(b.title);
        })
      );
    });

    return nextMap;
  }, [startOfTodayTime, tasks]);

  const visibleMonthTasks = useMemo(
    () =>
      tasks.filter((task) => {
        const dueDate = parseLocalDate(task.dueDate);
        return Boolean(dueDate && dueDate.getFullYear() === year && dueDate.getMonth() === month);
      }),
    [month, tasks, year]
  );

  const visibleMonthOpenTasks = useMemo(() => visibleMonthTasks.filter((task) => isOpenTask(task)), [visibleMonthTasks]);
  const visibleBlockedCount = useMemo(
    () => visibleMonthOpenTasks.filter((task) => task.status === "blocked").length,
    [visibleMonthOpenTasks]
  );
  const visibleOverdueCount = useMemo(
    () => visibleMonthOpenTasks.filter((task) => isTaskOverdue(task, startOfTodayTime)).length,
    [startOfTodayTime, visibleMonthOpenTasks]
  );
  const upcomingCount = useMemo(
    () => tasks.filter((task) => isTaskUpcoming(task, startOfTodayTime, upcomingHorizonTime)).length,
    [startOfTodayTime, tasks, upcomingHorizonTime]
  );

  const { workloadAgents, sameDayPileupCount } = useMemo(() => {
    const agentMap = new Map<
      string,
      {
        key: string;
        name: string;
        emoji: string;
        color: string;
        openCount: number;
        blockedCount: number;
        overdueCount: number;
        conflictDates: Set<string>;
      }
    >();
    const agentDayCounts = new Map<string, number>();

    visibleMonthOpenTasks.forEach((task) => {
      const key = getTaskAgentKey(task);
      const existing = agentMap.get(key);
      const agentSummary =
        existing ||
        {
          key,
          name: task.agent.name || "Unassigned",
          emoji: task.agent.emoji || "👤",
          color: task.agent.color || "#8E8E93",
          openCount: 0,
          blockedCount: 0,
          overdueCount: 0,
          conflictDates: new Set<string>(),
        };

      agentSummary.openCount += 1;
      if (task.status === "blocked") agentSummary.blockedCount += 1;
      if (isTaskOverdue(task, startOfTodayTime)) agentSummary.overdueCount += 1;

      agentMap.set(key, agentSummary);

      if (task.dueDate) {
        const agentDayKey = `${key}::${task.dueDate}`;
        agentDayCounts.set(agentDayKey, (agentDayCounts.get(agentDayKey) || 0) + 1);
      }
    });

    let nextSameDayPileupCount = 0;
    agentDayCounts.forEach((count, agentDayKey) => {
      if (count <= 1) return;
      nextSameDayPileupCount += 1;
      const [agentKey, dateKey] = agentDayKey.split("::");
      const summary = agentMap.get(agentKey);
      if (summary) {
        summary.conflictDates.add(dateKey);
      }
    });

    const nextWorkloadAgents: WorkloadAgentSummary[] = Array.from(agentMap.values())
      .map((agent) => ({
        key: agent.key,
        name: agent.name,
        emoji: agent.emoji,
        color: agent.color,
        openCount: agent.openCount,
        blockedCount: agent.blockedCount,
        overdueCount: agent.overdueCount,
        conflictDays: agent.conflictDates.size,
      }))
      .sort((a, b) => {
        if (b.overdueCount !== a.overdueCount) return b.overdueCount - a.overdueCount;
        if (b.blockedCount !== a.blockedCount) return b.blockedCount - a.blockedCount;
        if (b.conflictDays !== a.conflictDays) return b.conflictDays - a.conflictDays;
        if (b.openCount !== a.openCount) return b.openCount - a.openCount;
        return a.name.localeCompare(b.name);
      });

    return {
      workloadAgents: nextWorkloadAgents,
      sameDayPileupCount: nextSameDayPileupCount,
    };
  }, [startOfTodayTime, visibleMonthOpenTasks]);

  function prev() {
    if (month === 0) {
      setMonth(11);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  }

  function next() {
    if (month === 11) {
      setMonth(0);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  }

  function goToday() {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
  }

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  if (loading && !data) {
    return (
      <div className="p-4 md:p-8">
        <div className="flex items-center justify-center h-64">
          <p style={{ color: "var(--text-muted)" }}>Loading calendar...</p>
        </div>
      </div>
    );
  }

  if (error && tasks.length === 0) {
    return (
      <div className="p-4 md:p-8">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p style={{ color: "var(--status-blocked)" }}>Failed to load tasks: {error}</p>
          <button
            onClick={refetch}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
            style={{
              backgroundColor: "var(--surface-elevated)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1
          className="text-3xl font-bold mb-2"
          style={{ fontFamily: "var(--font-heading)", color: "var(--text-primary)", letterSpacing: "-1.5px" }}
        >
          <CalendarDays className="inline-block w-8 h-8 mr-2 mb-1" />
          Calendar
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
          Task scheduling view &bull; Due dates, open workload, and same-day pileups by assignee. Project phase timing is not modeled yet.
        </p>
      </div>

      <div className="grid gap-3 mb-6 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: `Open due in ${fmtMonth(year, month)}`,
            value: String(visibleMonthOpenTasks.length),
            tone: "var(--accent)",
            detail: `${workloadAgents.length} agent${workloadAgents.length === 1 ? "" : "s"} carrying due work`,
          },
          {
            label: "Blocked in view",
            value: String(visibleBlockedCount),
            tone: "var(--status-blocked)",
            detail: "Open tasks already marked blocked in this month",
          },
          {
            label: "Overdue in view",
            value: String(visibleOverdueCount),
            tone: "#FF9F0A",
            detail: "Open tasks whose due date is already behind today",
          },
          {
            label: "Same-day pileups",
            value: String(sameDayPileupCount),
            tone: "#BF5AF2",
            detail: "Agent/date pairs with more than one open task due together",
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-xl p-4"
            style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
          >
            <p className="text-[11px] uppercase tracking-[0.16em] mb-2" style={{ color: "var(--text-muted)" }}>
              {card.label}
            </p>
            <div className="text-3xl font-semibold mb-1" style={{ color: card.tone }}>
              {card.value}
            </div>
            <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {card.detail}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-xl p-4 mb-6" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
        <div className="flex flex-col gap-1 mb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}>
              Agent workload in {fmtMonth(year, month)}
            </h2>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Open task due dates only. This is the honest planning view until project phases have real timing fields.
            </p>
          </div>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Due in next 7 days across all tasks: <span style={{ color: "var(--text-primary)" }}>{upcomingCount}</span>
          </p>
        </div>

        {workloadAgents.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {workloadAgents.map((agent) => (
              <div
                key={agent.key}
                className="rounded-xl p-4"
                style={{ backgroundColor: "var(--surface-elevated)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="inline-flex w-8 h-8 items-center justify-center rounded-full text-sm shrink-0"
                      style={{ backgroundColor: `color-mix(in srgb, ${agent.color} 22%, transparent)` }}
                    >
                      {agent.emoji}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium truncate" style={{ color: "var(--text-primary)" }}>
                        {agent.name}
                      </p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {agent.openCount} open task{agent.openCount === 1 ? "" : "s"} due this month
                      </p>
                    </div>
                  </div>
                  <span
                    className="text-xs px-2 py-1 rounded-full"
                    style={{
                      color: agent.color,
                      backgroundColor: `color-mix(in srgb, ${agent.color} 16%, transparent)`,
                      border: `1px solid color-mix(in srgb, ${agent.color} 28%, transparent)`,
                    }}
                  >
                    {agent.conflictDays > 0 ? `${agent.conflictDays} pileup day${agent.conflictDays === 1 ? "" : "s"}` : "No pileups"}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  <span
                    className="px-2 py-1 rounded-full"
                    style={{ color: "var(--text-primary)", backgroundColor: "rgba(10, 132, 255, 0.12)" }}
                  >
                    {agent.openCount} due
                  </span>
                  <span
                    className="px-2 py-1 rounded-full"
                    style={{ color: visibleBlockedCount > 0 ? "var(--status-blocked)" : "var(--text-muted)", backgroundColor: "rgba(255, 69, 58, 0.12)" }}
                  >
                    {agent.blockedCount} blocked
                  </span>
                  <span
                    className="px-2 py-1 rounded-full"
                    style={{ color: agent.overdueCount > 0 ? "#FF9F0A" : "var(--text-muted)", backgroundColor: "rgba(255, 159, 10, 0.12)" }}
                  >
                    {agent.overdueCount} overdue
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl px-4 py-6" style={{ backgroundColor: "var(--surface-elevated)", border: "1px dashed var(--border)" }}>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              No open task due dates land in {fmtMonth(year, month)} yet. The calendar can still show completed history, but workload visibility stays empty until tasks carry due dates into this month.
            </p>
          </div>
        )}
      </div>

      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}>
            {fmtMonth(year, month)}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={goToday}
              className="px-3 py-1 text-xs font-medium rounded-lg transition-colors"
              style={{ color: "var(--text-secondary)", backgroundColor: "var(--surface-elevated)", border: "1px solid var(--border)" }}
            >
              Today
            </button>
            <button onClick={prev} className="p-1.5 rounded-lg transition-colors" style={{ color: "var(--text-muted)" }}>
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={next} className="p-1.5 rounded-lg transition-colors" style={{ color: "var(--text-muted)" }}>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 px-5 py-3 flex-wrap" style={{ borderBottom: "1px solid var(--border)" }}>
          {(Object.keys(taskStatusConfig) as Task["status"][]).map((s) => (
            <div key={s} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: taskStatusConfig[s].color }} />
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{taskStatusConfig[s].label}</span>
            </div>
          ))}
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            Day cells are ordered with blocked/overdue work first.
          </span>
        </div>

        <div className="grid grid-cols-7">
          {DAYS.map((d) => (
            <div key={d} className="text-center text-[10px] font-semibold uppercase tracking-wider py-2" style={{ color: "var(--text-muted)" }}>
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7" style={{ borderTop: "1px solid var(--border)" }}>
          {cells.map((day, i) => {
            const dateStr = day ? `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}` : "";
            const dayTasks = day ? tasksByDate.get(dateStr) || [] : [];
            const dayOpenTasks = dayTasks.filter((task) => isOpenTask(task));
            const dayBlockedCount = dayOpenTasks.filter((task) => task.status === "blocked").length;
            const dayOverdueCount = dayOpenTasks.filter((task) => isTaskOverdue(task, startOfTodayTime)).length;
            const dayAgentCount = new Set(dayOpenTasks.map((task) => getTaskAgentKey(task))).size;
            const dayPileups = dayOpenTasks.reduce((count, task, _, arr) => {
              const agentKey = getTaskAgentKey(task);
              const taskCountForAgent = arr.filter((rowTask) => getTaskAgentKey(rowTask) === agentKey).length;
              return taskCountForAgent > 1 ? count + 1 : count;
            }, 0);
            const hasDayPileup = dayPileups > 1;
            const isToday = day ? isSameDay(new Date(year, month, day), today) : false;

            return (
              <div
                key={i}
                className="min-h-[128px] p-1.5"
                style={{
                  borderRight: "1px solid var(--border)",
                  borderBottom: "1px solid var(--border)",
                  backgroundColor: day ? "transparent" : "var(--surface-elevated)",
                }}
              >
                {day && (
                  <>
                    <span
                      className="inline-flex items-center justify-center text-xs w-6 h-6 rounded-full mb-1"
                      style={{
                        backgroundColor: isToday ? "#0A84FF" : "transparent",
                        color: isToday ? "#fff" : "var(--text-secondary)",
                        fontWeight: isToday ? 700 : 400,
                      }}
                    >
                      {day}
                    </span>
                    <div className="space-y-0.5">
                      {dayTasks.slice(0, 3).map((task) => {
                        const color = taskStatusConfig[task.status].color;
                        return (
                          <div
                            key={task.id}
                            className="text-[10px] leading-tight px-1.5 py-0.5 rounded truncate"
                            style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`, color }}
                            title={task.title}
                          >
                            {task.title}
                          </div>
                        );
                      })}
                      {dayTasks.length > 3 && (
                        <span className="text-[9px] pl-1 block" style={{ color: "var(--text-muted)" }}>
                          +{dayTasks.length - 3} more
                        </span>
                      )}
                    </div>

                    {dayOpenTasks.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ color: "var(--text-muted)", backgroundColor: "var(--surface-elevated)" }}>
                          {dayOpenTasks.length} open
                        </span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ color: "var(--text-muted)", backgroundColor: "var(--surface-elevated)" }}>
                          {dayAgentCount} agent{dayAgentCount === 1 ? "" : "s"}
                        </span>
                        {dayBlockedCount > 0 && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ color: "var(--status-blocked)", backgroundColor: "rgba(255, 69, 58, 0.12)" }}>
                            {dayBlockedCount} blocked
                          </span>
                        )}
                        {dayOverdueCount > 0 && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ color: "#FF9F0A", backgroundColor: "rgba(255, 159, 10, 0.12)" }}>
                            {dayOverdueCount} overdue
                          </span>
                        )}
                        {hasDayPileup && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ color: "#BF5AF2", backgroundColor: "rgba(191, 90, 242, 0.12)" }}>
                            pileup
                          </span>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
