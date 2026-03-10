"use client";

import { useState } from "react";
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

interface CalendarPageClientProps {
  initialTasks: Task[];
}

export default function CalendarPageClient({ initialTasks }: CalendarPageClientProps) {
  const hasInitialTasks = initialTasks.length > 0;
  const { data, loading, error, refetch } = useFetch<{ tasks: Task[] }>("/api/agent-tasks", {
    initialData: hasInitialTasks ? { tasks: initialTasks } : null,
    fetchOnMount: !hasInitialTasks,
  });
  const tasks = data?.tasks || [];

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDay(year, month);

  const tasksByDate = new Map<string, Task[]>();
  tasks.forEach((t) => {
    if (!tasksByDate.has(t.dueDate)) tasksByDate.set(t.dueDate, []);
    tasksByDate.get(t.dueDate)!.push(t);
  });

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
          Schedule overview &bull; Events and deadlines
        </p>
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

        <div className="flex items-center gap-4 px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          {(Object.keys(taskStatusConfig) as Task["status"][]).map((s) => (
            <div key={s} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: taskStatusConfig[s].color }} />
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{taskStatusConfig[s].label}</span>
            </div>
          ))}
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
            const dayTasks = day ? (tasksByDate.get(dateStr) || []) : [];
            const isToday = day ? isSameDay(new Date(year, month, day), today) : false;

            return (
              <div
                key={i}
                className="min-h-[100px] p-1.5"
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
                      {dayTasks.slice(0, 3).map((t) => {
                        const c = taskStatusConfig[t.status].color;
                        return (
                          <div
                            key={t.id}
                            className="text-[10px] leading-tight px-1.5 py-0.5 rounded truncate"
                            style={{ backgroundColor: `color-mix(in srgb, ${c} 15%, transparent)`, color: c }}
                            title={t.title}
                          >
                            {t.title}
                          </div>
                        );
                      })}
                      {dayTasks.length > 3 && (
                        <span className="text-[9px] pl-1" style={{ color: "var(--text-muted)" }}>
                          +{dayTasks.length - 3} more
                        </span>
                      )}
                    </div>
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
