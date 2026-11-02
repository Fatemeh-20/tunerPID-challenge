import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "../App";
import * as api from "../api";

vi.mock("../api", () => ({
  uploadSystem: vi.fn(), getSchema: vi.fn(), simulate: vi.fn(), autotune: vi.fn(),
}));

const schema = { Kp: { min: 0.1, max: 60 }, Ki: { min: 0, max: 5 }, Kd: { min: 0, max: 20 } };
const result = {
  success: true, diverged: false, time_points: [0, 0.01, 0.02], trajectory: [1, 0.9, 0.8],
  control_signals: [-2, -1, -1],
  metrics: { mse: 0.1, rmse: 0.3, settling_time: null, rise_time: 1.2, overshoot: 0, ss_error: 0,
             control_effort: 0.01, zero_crossings: 0, stable: false },
};

async function uploadFile() {
  const input = document.querySelector('input[type="file"]');
  fireEvent.change(input, { target: { files: [new File(["x"], "BallBeam.py")] } });
  await screen.findByText("BallBeam");
}

beforeEach(() => {
  vi.resetAllMocks();
  api.uploadSystem.mockResolvedValue({ system_id: "abc", name: "BallBeam", num_states: 2 });
  api.getSchema.mockResolvedValue(schema);
  api.simulate.mockResolvedValue(result);
});

describe("graded flow", () => {
  it("uploads, sets the gains at mid-range, runs, and shows the metrics", async () => {
    render(<App />);
    await uploadFile();
    expect(api.getSchema).toHaveBeenCalledWith("abc", "PID");

    fireEvent.click(screen.getByText("Run simulation"));
    await screen.findByText("Metrics for run #1");

    expect(api.simulate).toHaveBeenCalledWith("abc", {
      controller_type: "PID",
      params: { Kp: 30.05, Ki: 2.5, Kd: 10 },
      system_config: { dt: 0.01, max_time: 5 },
    });
    expect(screen.getAllByText("Unstable")).toHaveLength(2); // badge + run row
    expect(screen.getAllByText("∞").length).toBeGreaterThan(0);
  });

  it("keeps earlier runs in the list", async () => {
    render(<App />);
    await uploadFile();
    fireEvent.click(screen.getByText("Run simulation"));
    await screen.findByText("Metrics for run #1");
    fireEvent.click(screen.getByText("Run simulation"));
    await screen.findByText("Metrics for run #2");
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
  });

  it("shows the server's message when the upload is rejected", async () => {
    api.uploadSystem.mockRejectedValue(new Error("import of 'os' is not allowed"));
    render(<App />);
    fireEvent.change(document.querySelector('input[type="file"]'), {
      target: { files: [new File(["x"], "evil.py")] },
    });
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("not allowed"));
  });
});
