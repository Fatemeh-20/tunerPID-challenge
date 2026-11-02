export function runToCsv(run) {
  const { time_points: t, trajectory: y, control_signals: u } = run.result;
  const rows = ["time_s,response,control"];
  t.forEach((time, i) => rows.push([time, y[i], u[i]].map((v) => +v.toPrecision(7)).join(",")));
  return rows.join("\n");
}

export function downloadCsv(run) {
  const blob = new Blob([runToCsv(run)], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${run.system}_${run.type}_run${run.id}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}
