export default function UploadBox({ system, onFile, busy }) {
  return (
    <section>
      <label className="block cursor-pointer rounded-md border-2 border-dashed border-ink/25 bg-panel px-4 py-5 text-center hover:border-trace">
        <input
          type="file"
          accept=".py"
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
            e.target.value = "";
          }}
        />
        <span className="font-medium">{busy ? "Uploading…" : "Choose a dynamics file"}</span>
        <span className="mt-1 block text-sm text-ink/60">.py file defining dynamics(t, x, u)</span>
      </label>
      {system && (
        <p className="mt-3 text-sm">
          Loaded <strong className="font-semibold">{system.name}</strong>
          <span className="text-ink/60"> · {system.num_states} states</span>
        </p>
      )}
    </section>
  );
}
