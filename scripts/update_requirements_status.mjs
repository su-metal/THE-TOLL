import fs from "node:fs";
import path from "node:path";

const FILE_PATH = path.resolve("REQUIREMENTS.md");
const text = fs.readFileSync(FILE_PATH, "utf8");

const TASKS_START = "<!-- AUTO_TASKS_START -->";
const TASKS_END = "<!-- AUTO_TASKS_END -->";
const STATUS_START = "<!-- AUTO_STATUS_START -->";
const STATUS_END = "<!-- AUTO_STATUS_END -->";

function between(source, start, end) {
  const i = source.indexOf(start);
  const j = source.indexOf(end);
  if (i === -1 || j === -1 || j < i) return null;
  return source.slice(i + start.length, j);
}

const tasksSection = between(text, TASKS_START, TASKS_END);
if (!tasksSection) {
  throw new Error("AUTO_TASKS section not found in REQUIREMENTS.md");
}

const rows = tasksSection
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => /^- \[[ xX]\] [A-Z]-\d+/.test(line));

if (rows.length === 0) {
  throw new Error("No checklist tasks found in AUTO_TASKS section");
}

const phaseMap = new Map();
for (const row of rows) {
  const checked = /^- \[[xX]\]/.test(row);
  const phase = row.match(/^[^-]*- \[[ xX]\] ([A-Z])-\d+/)?.[1];
  if (!phase) continue;
  if (!phaseMap.has(phase)) phaseMap.set(phase, { total: 0, completed: 0 });
  const item = phaseMap.get(phase);
  item.total += 1;
  if (checked) item.completed += 1;
}

const phases = [...phaseMap.keys()].sort();
const totalAll = phases.reduce((sum, p) => sum + phaseMap.get(p).total, 0);
const doneAll = phases.reduce((sum, p) => sum + phaseMap.get(p).completed, 0);
const progressAll = totalAll === 0 ? 0 : Math.round((doneAll / totalAll) * 100);

function statusOf(completed, total) {
  if (completed === 0) return "pending";
  if (completed >= total) return "done";
  return "in_progress";
}

const today = new Date().toISOString().slice(0, 10);
const tableLines = phases.map((phase) => {
  const { completed, total } = phaseMap.get(phase);
  const progress = total === 0 ? 0 : Math.round((completed / total) * 100);
  const status = statusOf(completed, total);
  return `| ${phase} | ${completed} | ${total} | ${progress}% | ${status} |`;
});

const statusBlock = [
  STATUS_START,
  `Last auto update: ${today}`,
  "",
  "| Phase | Completed | Total | Progress | Status |",
  "|---|---:|---:|---:|---|",
  ...tableLines,
  "",
  `Overall progress: **${doneAll} / ${totalAll} (${progressAll}%)**`,
  STATUS_END,
].join("\n");

const statusRegex = new RegExp(
  `${STATUS_START}[\\s\\S]*?${STATUS_END}`,
  "m",
);

if (!statusRegex.test(text)) {
  throw new Error("AUTO_STATUS section not found in REQUIREMENTS.md");
}

const updated = text.replace(statusRegex, statusBlock);
if (updated !== text) {
  fs.writeFileSync(FILE_PATH, updated, "utf8");
  console.log("Updated REQUIREMENTS.md auto progress snapshot.");
} else {
  console.log("No changes.");
}
