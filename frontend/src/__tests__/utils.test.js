import { runToCsv } from "../csv";
import { formatGains, parseNumber } from "../utils";

describe("parseNumber", () => {
  it("parses plain numbers", () => expect(parseNumber("1.5")).toBe(1.5));
  it("accepts a decimal comma", () => expect(parseNumber("1,5")).toBe(1.5));
  it("accepts Persian and Arabic digits", () => {
    expect(parseNumber("۱٫۵")).toBe(1.5);
    expect(parseNumber("٢")).toBe(2);
  });
  it("returns NaN for empty or invalid text", () => {
    expect(parseNumber("")).toBeNaN();
    expect(parseNumber("abc")).toBeNaN();
  });
});

describe("formatGains", () => {
  it("rounds to two decimals", () =>
    expect(formatGains({ Kp: 1.954, Ki: 0 })).toBe("Kp 1.95, Ki 0"));
});

describe("runToCsv", () => {
  it("writes a header and one rounded row per sample", () => {
    const run = { result: { time_points: [0, 0.01], trajectory: [1, 0.123456789], control_signals: [-2, -1] } };
    expect(runToCsv(run).split("\n")).toEqual(["time_s,response,control", "0,1,-2", "0.01,0.1234568,-1"]);
  });
});
