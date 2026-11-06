import React, { useMemo } from "react";
import { buildLogoSvg } from "./logo";

let n = 0;

// The Shotlist app icon (glass cards + amber viewfinder), usable at any size.
export default function ShotlistLogo({ size = 32, style }) {
  const html = useMemo(() => buildLogoSvg({ id: `slg${n++}`, content: 1.16, small: typeof size === "number" && size <= 40 }), [size]);
  return <span aria-hidden="true" style={{ display: "block", width: size, height: size, flexShrink: 0, ...style }} dangerouslySetInnerHTML={{ __html: html }} />;
}
