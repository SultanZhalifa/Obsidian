import type { SVGProps } from "react";

/**
 * Monochrome stroke-SVG icon set. 1.5px stroke, 24x24 viewBox, currentColor.
 * No emoji anywhere in the product — every glyph is a deliberate vector here.
 */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 18, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconChart = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 3v18h18" />
    <path d="M7 14l3-4 3 3 4-6" />
  </Base>
);

export const IconCandles = (p: IconProps) => (
  <Base {...p}>
    <path d="M6 4v4M6 16v4M6 8h0a0 0 0 0 1 0 0v8H4V8h2zM6 8H4" />
    <rect x="4" y="8" width="4" height="8" rx="1" />
    <path d="M6 4v4M6 16v4" />
    <rect x="14" y="6" width="4" height="6" rx="1" />
    <path d="M16 3v3M16 12v5" />
  </Base>
);

export const IconBook = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 5h16M4 9h10M4 13h16M4 17h10" />
  </Base>
);

export const IconWallet = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="6" width="18" height="13" rx="2" />
    <path d="M3 10h18" />
    <circle cx="16.5" cy="14" r="1" />
  </Base>
);

export const IconBell = (p: IconProps) => (
  <Base {...p}>
    <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" />
    <path d="M10 19a2 2 0 0 0 4 0" />
  </Base>
);

export const IconShield = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Z" />
  </Base>
);

export const IconSearch = (p: IconProps) => (
  <Base {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" />
  </Base>
);

export const IconArrowUp = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </Base>
);

export const IconArrowDown = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </Base>
);

export const IconCheck = (p: IconProps) => (
  <Base {...p}>
    <path d="M5 12l5 5L20 6" />
  </Base>
);

export const IconX = (p: IconProps) => (
  <Base {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Base>
);

export const IconWarning = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3l9 16H3L12 3Z" />
    <path d="M12 10v4M12 17h.01" />
  </Base>
);

export const IconDot = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
  </Base>
);

export const IconLogout = (p: IconProps) => (
  <Base {...p}>
    <path d="M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3" />
    <path d="M10 12H3M6 8l-3 4 3 4" />
  </Base>
);

export const IconUsers = (p: IconProps) => (
  <Base {...p}>
    <circle cx="9" cy="8" r="3" />
    <path d="M3 20a6 6 0 0 1 12 0" />
    <path d="M16 6a3 3 0 0 1 0 6M21 20a6 6 0 0 0-4-5.6" />
  </Base>
);

export const IconActivity = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 12h4l3 8 4-16 3 8h4" />
  </Base>
);

export const IconBacktest = (p: IconProps) => (
  <Base {...p}>
    <path d="M9 3h6M10 3v6l-5 8a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-8V3" />
    <path d="M7.5 14h9" />
  </Base>
);

/**
 * OBSIDIAN brand emblem, rendered from the original obsidian.svg artwork.
 *
 * Unlike the stroke icons above this is a fill glyph, so it uses
 * `fill="currentColor"` — the surrounding `className` (e.g. text-fg-0) still
 * controls its colour, keeping it monochrome and theme-adaptive. The viewBox is
 * cropped tightly to the emblem's rendered bounds (in the artwork's own flipped
 * coordinate space) so it fills the icon box squarely.
 */
export const IconLogo = ({ size = 18, ...props }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="1180 70 455 636"
    fill="currentColor"
    aria-hidden="true"
    {...props}
  >
    <g transform="translate(0,755) scale(0.1,-0.1)">
      <path d="M14274 6703 c6 -30 48 -265 152 -858 l67 -380 210 -285 c400 -543 532 -719 538 -720 3 0 26 48 51 108 25 59 105 243 177 409 72 167 131 308 131 315 0 15 -202 237 -770 848 -207 223 -415 446 -461 497 -46 50 -88 92 -92 92 -5 1 -6 -11 -3 -26z" />
      <path d="M13694 6518 c-430 -490 -1643 -1866 -1692 -1920 l-25 -27 477 -237 c284 -142 480 -234 485 -228 5 5 61 153 124 329 750 2081 820 2276 813 2282 -2 2 -84 -87 -182 -199z" />
      <path d="M13812 5937 c-144 -402 -327 -914 -407 -1137 -80 -223 -144 -408 -143 -412 3 -6 515 517 889 906 l146 152 -106 606 c-58 334 -109 609 -112 612 -3 3 -123 -324 -267 -727z" />
      <path d="M14098 4962 c-163 -169 -454 -469 -648 -667 -328 -336 -350 -362 -346 -390 3 -16 73 -334 156 -705 106 -477 156 -680 168 -692 21 -20 995 -686 1015 -694 11 -4 19 8 30 48 57 206 534 1875 598 2091 43 148 79 276 79 285 0 9 -44 76 -98 148 -53 72 -218 294 -366 495 -148 200 -274 369 -280 376 -8 10 -81 -60 -308 -295z" />
      <path d="M15700 5018 c-18 -46 -91 -215 -161 -377 -71 -162 -127 -296 -125 -299 2 -2 141 -34 307 -72 167 -38 344 -78 392 -89 48 -12 92 -21 97 -21 5 0 -45 105 -111 233 -66 127 -172 339 -236 470 -64 130 -119 237 -123 237 -3 0 -21 -37 -40 -82z" />
      <path d="M11944 4333 c63 -307 221 -1075 301 -1468 127 -623 138 -675 145 -675 3 0 63 206 134 458 71 251 180 637 243 856 62 220 112 401 110 403 -7 6 -925 453 -932 453 -4 0 -4 -12 -1 -27z" />
      <path d="M15321 4118 c-26 -91 -493 -1729 -521 -1826 -17 -63 -30 -115 -28 -118 7 -6 180 222 1176 1545 106 140 191 255 189 257 -4 4 -776 174 -791 174 -8 0 -19 -15 -25 -32z" />
      <path d="M16148 3658 c-36 -46 -132 -173 -215 -283 -82 -110 -358 -474 -612 -809 -254 -335 -460 -611 -457 -613 2 -2 55 25 117 60 63 34 302 166 531 291 409 224 418 229 427 265 5 20 46 191 92 381 45 190 106 444 135 565 29 120 52 221 50 223 -2 1 -33 -34 -68 -80z" />
      <path d="M12961 3463 c-11 -37 -33 -115 -50 -173 -46 -160 -321 -1152 -321 -1157 0 -12 50 18 327 190 172 107 293 188 293 197 0 21 -217 1001 -224 1007 -2 3 -14 -26 -25 -64z" />
      <path d="M12980 2134 c-157 -97 -322 -199 -368 -227 l-83 -51 23 -22 c26 -24 377 -350 663 -614 104 -96 285 -264 402 -373 206 -193 263 -243 263 -234 0 3 -32 94 -71 203 -39 110 -137 388 -219 619 -144 407 -248 699 -291 818 -12 31 -24 57 -28 57 -3 0 -134 -79 -291 -176z" />
      <path d="M15585 2124 c-443 -240 -963 -528 -979 -544 -11 -11 -68 -178 -147 -431 -71 -228 -138 -441 -148 -474 -11 -33 -18 -61 -17 -63 4 -4 86 85 647 703 636 701 801 885 792 885 -4 -1 -71 -35 -148 -76z" />
      <path d="M13530 2184 c0 -5 45 -135 101 -289 109 -303 372 -1045 421 -1189 20 -57 33 -84 38 -75 13 24 304 979 299 982 -7 6 -801 542 -831 562 -16 9 -28 13 -28 9z" />
    </g>
  </svg>
);
