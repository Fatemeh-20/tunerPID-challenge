import { render, screen } from "@testing-library/react";
import MetricsPanel from "../components/MetricsPanel";

const metrics = {
  mse: 0.1, rmse: 0.3, settling_time: 1.2, rise_time: null, overshoot: 0,
  ss_error: 0, control_effort: 0.01, zero_crossings: 2, stable: true,
};

describe("MetricsPanel", () => {
  it("shows the stable badge and formatted values", () => {
    render(<MetricsPanel metrics={metrics} diverged={false} />);
    expect(screen.getByText("Stable")).toBeTruthy();
    expect(screen.getByText("1.200 s")).toBeTruthy();
  });

  it("shows null metrics as infinity", () => {
    render(<MetricsPanel metrics={metrics} diverged={false} />);
    expect(screen.getByText("∞")).toBeTruthy();
  });

  it("warns when the response diverged", () => {
    render(<MetricsPanel metrics={{ ...metrics, stable: false }} diverged />);
    expect(screen.getByText("Unstable")).toBeTruthy();
    expect(screen.getByRole("alert")).toBeTruthy();
  });
});
