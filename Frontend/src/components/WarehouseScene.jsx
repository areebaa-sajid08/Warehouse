const crates = [
  { x: 139, y: 82, width: 52, height: 39, color: "lime" },
  { x: 263, y: 135, width: 61, height: 42, color: "coral" },
  { x: 149, y: 191, width: 57, height: 41, color: "sand" },
  { x: 283, y: 245, width: 49, height: 36, color: "lime" },
];

const cratePalette = {
  lime: ["fill-[#d5ee90] stroke-[#efffbd]", "fill-[#a7c660] stroke-[#d7ed9f]", "fill-[#789448] stroke-[#bed782]"],
  coral: ["fill-[#f0a36d] stroke-[#ffd0a2]", "fill-[#c8754c] stroke-[#edac7a]", "fill-[#965538] stroke-[#d78a60]"],
  sand: ["fill-[#e7d6a8] stroke-[#fff2ca]", "fill-[#c3ae78] stroke-[#ebd8a4]", "fill-[#99875c] stroke-[#d4c18d]"],
};

function Crate({ x, y, width, height, color }) {
  const depth = 14;
  const [top, front, side] = cratePalette[color];
  return <g transform={`translate(${x} ${y})`}>
    <path d={`M0 ${depth} ${depth} 0 ${width} ${depth} ${width - depth} ${depth * 2}Z`} className={`${top} stroke-1`} />
    <path d={`M0 ${depth} ${width - depth} ${depth * 2}V${depth * 2 + height}L0 ${depth + height}Z`} className={`${front} stroke-1`} />
    <path d={`M${width - depth} ${depth * 2} ${width} ${depth}V${depth + height}L${width - depth} ${depth * 2 + height}Z`} className={`${side} stroke-1`} />
    <path d={`M${width / 2} ${depth / 2}v${depth}`} className="fill-none stroke-[#40532e] stroke-2" />
  </g>;
}

export default function WarehouseScene() {
  return <div className="relative mx-auto grid min-h-[150px] w-full max-w-[500px] place-items-center [perspective:1100px] sm:min-h-[190px] lg:min-h-[310px]" aria-hidden="true">
    <svg className="relative z-10 w-full overflow-visible drop-shadow-[0_26px_18px_#090e0a73] [transform-style:preserve-3d] [transform:rotateX(7deg)_rotateY(-12deg)_rotateZ(-2deg)] transition-transform duration-500 hover:scale-[1.03] hover:[transform:rotateX(3deg)_rotateY(-4deg)_rotateZ(0deg)]" viewBox="0 0 460 360" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22 254 222 139l215 124-201 91L22 254Z" className="fill-[#202a20] stroke-[#536147] stroke-[1.2]" />
      <path d="m60 255 197 112m-154-135 198 112m-153-137 198 112m-151-138 196 112m-151-138 198 114M78 285l196-112m-154 135 196-112m-153 135 196-112m-153 135 196-112" className="fill-none stroke-[#63754d]/40 stroke-1" />

      <path d="m83 97 137-78 167 91-137 79L83 97Z" className="fill-[#526444] stroke-[#a4bb72] stroke-2" />
      <path d="M83 97v171l167 91V188L83 97Z" className="fill-[#344436] stroke-[#829860] stroke-[1.5]" />
      <path d="m250 188 137-78v171l-137 78V188Z" className="fill-[#252f27] stroke-[#81965b] stroke-[1.5]" />

      <path d="m83 153 167 91 137-78m-304 45 167 91 137-78m-304 44 167 91 137-78" className="fill-none stroke-[#bacd88]/70 stroke-[3]" />
      <path d="m83 153 137-78 167 91-137 78L83 153Z" className="fill-[#829754] stroke-[#c5dc86] stroke-[1.5]" />
      <path d="m83 211 137-78 167 91-137 78L83 211Z" className="fill-[#829754] stroke-[#c5dc86] stroke-[1.5]" />
      <path d="m83 268 137-78 167 91-137 78L83 268Z" className="fill-[#829754] stroke-[#c5dc86] stroke-[1.5]" />
      <path d="M98 104v172m43-147v172m52-144v172m114-151v172m43-197v172m43-197v172" className="fill-none stroke-[#c1d785]/90 stroke-[4]" />

      {crates.map((crate) => <Crate key={`${crate.x}-${crate.y}`} {...crate} />)}

      <path d="m343 74 28-16 31 18-29 17-30-19Z" className="fill-[#e1f4a8] stroke-[#f3ffd5] stroke-1" />
      <path d="M343 74v37l30 19V93l-30-19Z" className="fill-[#a5c864] stroke-[#d9efa1] stroke-1" />
      <path d="m373 93 29-17v36l-29 18V93Z" className="fill-[#758f46] stroke-[#b8d57a] stroke-1" />
    </svg>
    <span className="absolute bottom-1 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap text-[7px] font-bold tracking-[.16em] text-[#9eaa96]"><i className="size-1 rounded-full bg-[#c9ef6b]" /> RECEIVING <b className="text-[#657160]">·</b> STORAGE <b className="text-[#657160]">·</b> FULFILMENT</span>
  </div>;
}
