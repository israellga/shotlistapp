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

// Headings: SF Pro Display (native on Apple devices via the system stack — no
// embed needed, and it's the licensed way to use it on the web). Falls back
// to Helvetica/Arial elsewhere.
export const FONT_DISPLAY = "-apple-system, 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif";
// Body: Helvetica, matching the brand's own typography.
export const FONT_BODY = "Helvetica, 'Helvetica Neue', Arial, sans-serif";
// Small data/labels reuse the same body face — no separate mono/display
// treatment, to keep the type system to just these two.
export const FONT_MONO = FONT_BODY;

