export const C = {
  ink: "#000000",
  panel: "#111111",
  panel2: "#1B1B1B",
  line: "#2C2C2C",
  lineSoft: "#202020",
  paper: "#F5F3EC",
  muted: "#9A988F",
  faint: "#6B6963",
  amber: "#FDDF4B",
  amberDim: "#332C11",
  teal: "#6FA0C7",
  sage: "#7CB88F",
  sageDim: "#1C2F22",
  brick: "#D9634A",
  brickDim: "#331B14",
};

// Headings: SF Pro Display (native on Apple devices via the system stack — no
// embed needed, and it's the licensed way to use it on the web). Falls back
// to Helvetica/Arial elsewhere.
export const FONT_DISPLAY = "-apple-system, 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif";
// Body: Helvetica, matching the brand's own typography.
export const FONT_BODY = "Helvetica, 'Helvetica Neue', Arial, sans-serif";
// Small data/labels reuse the same body face — no separate mono/display
// treatment, to keep the type system to just these two.
export const FONT_MONO = FONT_BODY;

