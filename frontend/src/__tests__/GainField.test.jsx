import { fireEvent, render, screen } from "@testing-library/react";
import { GainField } from "../components/ControllerPanel";

const setup = (value = 2) => {
  const onChange = vi.fn();
  render(<GainField name="Kp" range={{ min: 0.1, max: 60 }} value={value} onChange={onChange} />);
  return { onChange, input: screen.getByLabelText("Kp") };
};

describe("GainField", () => {
  it("applies a typed value, including a decimal comma", () => {
    const { onChange, input } = setup();
    fireEvent.change(input, { target: { value: "1,5" } });
    expect(onChange).toHaveBeenCalledWith(1.5);
  });

  it("ignores out-of-range text while typing and clamps it on blur", () => {
    const { onChange, input } = setup();
    fireEvent.change(input, { target: { value: "999" } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(60);
    expect(input.value).toBe("60");
  });

  it("restores the previous value when the text is not a number", () => {
    const { onChange, input } = setup();
    fireEvent.change(input, { target: { value: "abc" } });
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
    expect(input.value).toBe("2");
  });

  it("reports slider changes", () => {
    const { onChange } = setup();
    fireEvent.change(screen.getByLabelText("Kp slider"), { target: { value: "3" } });
    expect(onChange).toHaveBeenCalledWith(3);
  });
});
