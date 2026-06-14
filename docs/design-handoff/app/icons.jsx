// ── lucide-style stroke icons ─────────────────────────────────────────────────
const Svg = ({ children, size = 18, className = "", ...rest }) =>
  React.createElement("svg", {
    width: size, height: size, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round",
    strokeLinejoin: "round", className, ...rest,
  }, children);

const P = (d) => React.createElement("path", { d });
const L = (x1, y1, x2, y2) => React.createElement("line", { x1, y1, x2, y2 });
const C = (cx, cy, r) => React.createElement("circle", { cx, cy, r });
const R = (x, y, w, h, rx) => React.createElement("rect", { x, y, width: w, height: h, rx });

const Icons = {
  cart:    (p) => <Svg {...p}><C cx="9" cy="21" r="1"/><C cx="20" cy="21" r="1"/>{P("M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6")}</Svg>,
  home:    (p) => <Svg {...p}>{P("M3 10.5 12 3l9 7.5")}{P("M5 9.5V21h14V9.5")}{P("M9.5 21v-6h5v6")}</Svg>,
  bookPlus:(p) => <Svg {...p}>{P("M4 19.5A2.5 2.5 0 0 1 6.5 17H20")}{P("M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z")}<L x1="12.5" y1="7" x2="12.5" y2="13"/><L x1="9.5" y1="10" x2="15.5" y2="10"/></Svg>,
  report:  (p) => <Svg {...p}>{P("M4 4a2 2 0 0 1 2-2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z")}{P("M14 2v6h6")}<L x1="8" y1="17" x2="8" y2="13"/><L x1="12" y1="17" x2="12" y2="11"/><L x1="16" y1="17" x2="16" y2="14"/></Svg>,
  search:  (p) => <Svg {...p}><C cx="11" cy="11" r="7"/><L x1="21" y1="21" x2="16.65" y2="16.65"/></Svg>,
  refresh: (p) => <Svg {...p}>{P("M21 12a9 9 0 1 1-2.64-6.36")}{P("M21 3v6h-6")}</Svg>,
  sun:     (p) => <Svg {...p}><C cx="12" cy="12" r="4"/><L x1="12" y1="2" x2="12" y2="5"/><L x1="12" y1="19" x2="12" y2="22"/><L x1="2" y1="12" x2="5" y2="12"/><L x1="19" y1="12" x2="22" y2="12"/><L x1="4.9" y1="4.9" x2="7" y2="7"/><L x1="17" y1="17" x2="19.1" y2="19.1"/><L x1="4.9" y1="19.1" x2="7" y2="17"/><L x1="17" y1="7" x2="19.1" y2="4.9"/></Svg>,
  moon:    (p) => <Svg {...p}>{P("M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z")}</Svg>,
  plus:    (p) => <Svg {...p}><L x1="12" y1="5" x2="12" y2="19"/><L x1="5" y1="12" x2="19" y2="12"/></Svg>,
  minus:   (p) => <Svg {...p}><L x1="5" y1="12" x2="19" y2="12"/></Svg>,
  x:       (p) => <Svg {...p}><L x1="18" y1="6" x2="6" y2="18"/><L x1="6" y1="6" x2="18" y2="18"/></Svg>,
  trash:   (p) => <Svg {...p}><L x1="3" y1="6" x2="21" y2="6"/>{P("M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2")}{P("M6 6v14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6")}<L x1="10" y1="11" x2="10" y2="17"/><L x1="14" y1="11" x2="14" y2="17"/></Svg>,
  barcode: (p) => <Svg {...p}><L x1="4" y1="6" x2="4" y2="18"/><L x1="7" y1="6" x2="7" y2="18"/><L x1="10" y1="6" x2="10" y2="18"/><L x1="13.5" y1="6" x2="13.5" y2="18"/><L x1="17" y1="6" x2="17" y2="18"/><L x1="20" y1="6" x2="20" y2="18"/></Svg>,
  check:   (p) => <Svg {...p}>{P("M20 6 9 17l-5-5")}</Svg>,
  copy:    (p) => <Svg {...p}><R x="9" y="9" w="13" h="13" rx="2"/>{P("M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1")}</Svg>,
  printer: (p) => <Svg {...p}>{P("M6 9V2h12v7")}{P("M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2")}<R x="6" y="14" w="12" h="8" rx="1"/></Svg>,
  user:    (p) => <Svg {...p}><C cx="12" cy="8" r="4"/>{P("M4 21a8 8 0 0 1 16 0")}</Svg>,
  package: (p) => <Svg {...p}>{P("M21 8 12 3 3 8v8l9 5 9-5Z")}{P("M3 8l9 5 9-5")}<L x1="12" y1="13" x2="12" y2="21"/></Svg>,
  card:    (p) => <Svg {...p}><R x="2" y="5" w="20" h="14" rx="2"/><L x1="2" y1="10" x2="22" y2="10"/></Svg>,
  money:   (p) => <Svg {...p}><R x="2" y="6" w="20" h="12" rx="2"/><C cx="12" cy="12" r="2.5"/><L x1="6" y1="12" x2="6" y2="12"/><L x1="18" y1="12" x2="18" y2="12"/></Svg>,
  pix:     (p) => <Svg {...p}>{P("M12 3 5 10l7 7 7-7-7-7Z")}<C cx="12" cy="10" r="0.4"/></Svg>,
  gift:    (p) => <Svg {...p}><R x="3" y="8" w="18" h="4" rx="1"/><L x1="12" y1="8" x2="12" y2="21"/>{P("M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7")}{P("M12 8C12 8 11 3 8 3a2.5 2.5 0 0 0 0 5Z")}{P("M12 8C12 8 13 3 16 3a2.5 2.5 0 0 1 0 5Z")}</Svg>,
  church:  (p) => <Svg {...p}><L x1="12" y1="2" x2="12" y2="7"/><L x1="9.5" y1="4.5" x2="14.5" y2="4.5"/>{P("M6 22V11l6-3 6 3v11")}{P("M10 22v-4a2 2 0 0 1 4 0v4")}</Svg>,
  alert:   (p) => <Svg {...p}>{P("M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z")}<L x1="12" y1="9" x2="12" y2="13"/><L x1="12" y1="17" x2="12" y2="17"/></Svg>,
  chevR:   (p) => <Svg {...p}>{P("M9 18l6-6-6-6")}</Svg>,
  chevD:   (p) => <Svg {...p}>{P("M6 9l6 6 6-6")}</Svg>,
  edit:    (p) => <Svg {...p}>{P("M12 20h9")}{P("M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z")}</Svg>,
  list:    (p) => <Svg {...p}><L x1="8" y1="6" x2="21" y2="6"/><L x1="8" y1="12" x2="21" y2="12"/><L x1="8" y1="18" x2="21" y2="18"/><L x1="3.5" y1="6" x2="3.5" y2="6"/><L x1="3.5" y1="12" x2="3.5" y2="12"/><L x1="3.5" y1="18" x2="3.5" y2="18"/></Svg>,
  trending:(p) => <Svg {...p}>{P("M22 7l-8.5 8.5-5-5L2 17")}{P("M16 7h6v6")}</Svg>,
  clock:   (p) => <Svg {...p}><C cx="12" cy="12" r="9"/>{P("M12 7v5l3 2")}</Svg>,
  logout:  (p) => <Svg {...p}>{P("M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4")}{P("M16 17l5-5-5-5")}<L x1="21" y1="12" x2="9" y2="12"/></Svg>,
  lock:    (p) => <Svg {...p}><R x="4" y="11" w="16" h="10" rx="2"/>{P("M8 11V7a4 4 0 0 1 8 0v4")}</Svg>,
  book:    (p) => <Svg {...p}>{P("M4 19.5A2.5 2.5 0 0 1 6.5 17H20")}{P("M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z")}</Svg>,
  calendar:(p) => <Svg {...p}><R x="3" y="4" w="18" h="18" rx="2"/><L x1="3" y1="9" x2="21" y2="9"/><L x1="8" y1="2" x2="8" y2="6"/><L x1="16" y1="2" x2="16" y2="6"/></Svg>,
};

// Brand mark — stacked "book page" bars forming an E inside a ring.
const BrandMark = ({ size = 36 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="24" cy="24" r="22" stroke="#1f7a4d" strokeWidth="2.5"/>
    <rect x="15" y="15" width="18" height="3.4" rx="1.7" fill="#1f7a4d"/>
    <rect x="15" y="22.3" width="13" height="3.4" rx="1.7" fill="#1f7a4d"/>
    <rect x="15" y="29.6" width="18" height="3.4" rx="1.7" fill="#c79a3a"/>
  </svg>
);

Object.assign(window, { Icons, BrandMark });
