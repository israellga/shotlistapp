export const C = {
  ink: "#000000",
  // Liquid glass: surfaces are translucent whites over the dark ambient ground (see index.css)
  panel: "rgba(255,255,255,0.055)",
  panel2: "rgba(255,255,255,0.09)",
  line: "rgba(255,255,255,0.13)",
  lineSoft: "rgba(255,255,255,0.075)",
  paper: "#F5F5F7",
  muted: "#A9A9B2",
  faint: "#8D8D98",
  amber: "#FDDF4B",
  amberDim: "rgba(253,223,75,0.15)",
  teal: "#6FA0C7",
  sage: "#7CB88F",
  sageDim: "rgba(124,184,143,0.16)",
  brick: "#E0705A",
  brickDim: "rgba(224,112,90,0.16)",
};

// iOS system typography: the -apple-system stack resolves to SF Pro Text at small sizes and
// SF Pro Display at large sizes (optical sizing), the same way iOS does. Helvetica Neue is the
// fallback on other platforms.
const SYSTEM = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif";
export const FONT_DISPLAY = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif";
export const FONT_BODY = SYSTEM;
// Small data/labels reuse the same face, no separate mono treatment.
export const FONT_MONO = SYSTEM;
