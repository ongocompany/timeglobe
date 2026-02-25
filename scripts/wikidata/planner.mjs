export function buildTasks({
  types = ["event", "person", "place"],
  yearFrom,
  yearTo,
  chunkYears,
  mode,
}) {
  const tasks = [];
  for (const type of types) {
    for (let from = yearFrom; from <= yearTo; from += chunkYears) {
      const to = Math.min(yearTo, from + chunkYears - 1);
      tasks.push({
        id: `${type}:${from}:${to}`,
        type,
        yearFrom: from,
        yearTo: to,
        mode,
      });
    }
  }
  return tasks;
}
