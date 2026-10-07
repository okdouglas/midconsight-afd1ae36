/**
 * Dusk scene for "Voice you can count on."
 *
 * To use the photo instead of the drawing, change the next line to:
 *   const PUMPJACK_PHOTO = '/img/pumpjack.webp';
 * and drop the file in public/img/. Nothing else needs to change.
 */
const PUMPJACK_PHOTO: string | null = null;

const LABEL = 'A pumpjack silhouetted against a dusk sky over an Oklahoma field';
const NAVY = '#0B2545';

export function PumpjackScene() {
  if (PUMPJACK_PHOTO) {
    return (
      <div className="lp-scene">
        <img src={PUMPJACK_PHOTO} alt={LABEL} loading="lazy" decoding="async" />
      </div>
    );
  }
  return (
    <div className="lp-scene">
      <svg viewBox="30 0 500 400" preserveAspectRatio="xMidYMax slice" role="img" aria-label={LABEL}>
        <defs>
          <linearGradient id="lp-sky" gradientUnits="userSpaceOnUse" x1="0" y1="-140" x2="0" y2="330">
            <stop offset="0" stopColor="#0B2545" />
            <stop offset="0.38" stopColor="#0F3A6B" />
            <stop offset="0.62" stopColor="#1F6DB0" />
            <stop offset="0.8" stopColor="#6FA3D3" />
            <stop offset="0.92" stopColor="#F2C78F" />
            <stop offset="1" stopColor="#F8E0B4" />
          </linearGradient>
          <radialGradient id="lp-sun" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#FFF4DA" stopOpacity="0.95" />
            <stop offset="0.55" stopColor="#FBD9A0" stopOpacity="0.55" />
            <stop offset="1" stopColor="#F2C78F" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* sky */}
        <rect x="-200" y="-400" width="900" height="730" fill="url(#lp-sky)" />
        <g fill="#fff" opacity="0.65">
          <circle cx="70" cy="26" r="1.3" />
          <circle cx="168" cy="58" r="1" />
          <circle cx="322" cy="22" r="1.4" />
          <circle cx="436" cy="52" r="1.1" />
          <circle cx="96" cy="104" r="0.9" />
          <circle cx="396" cy="96" r="1" />
        </g>
        <circle cx="352" cy="326" r="96" fill="url(#lp-sun)" />

        {/* far ridge */}
        <path
          d="M-20 322 C40 308 100 312 170 318 S300 324 360 314 S450 304 540 316 L540 340 L-20 340 Z"
          fill="#12335D"
        />

        {/* power pole and wires */}
        <g fill={NAVY} stroke={NAVY}>
          <rect x="452" y="196" width="5" height="136" stroke="none" />
          <rect x="438" y="206" width="33" height="4" stroke="none" />
          <rect x="443" y="219" width="23" height="3" stroke="none" />
          <path d="M438 208 C 410 222 380 226 340 224" fill="none" strokeWidth="1.2" />
          <path d="M471 208 C 490 214 505 222 520 232" fill="none" strokeWidth="1.2" />
        </g>

        {/* ground */}
        <path d="M-20 330 L520 330 L520 420 L-20 420 Z" fill={NAVY} />

        {/* skid, motor and gearbox */}
        <g fill={NAVY}>
          <rect x="96" y="320" width="318" height="10" />
          <rect x="296" y="296" width="44" height="26" rx="3" />
          <rect x="344" y="262" width="76" height="60" rx="6" />
          <path d="M322 300 L372 270" stroke={NAVY} strokeWidth="3.5" fill="none" />
        </g>

        {/* samson post (A-frame) */}
        <g fill={NAVY}>
          <path d="M214 322 L245 178 L255 178 L286 322 L273 322 L250 212 L227 322 Z" />
          <rect x="231" y="268" width="38" height="6" />
          <rect x="238" y="240" width="24" height="5" />
          <rect x="236" y="174" width="28" height="9" rx="3" />
        </g>

        {/* walking beam, horse head and pitman nod around the saddle bearing */}
        <g className="lp-nod" fill={NAVY}>
          {/* beam */}
          <path d="M168 169 L398 169 L398 179 L296 187 L250 189 L204 187 L168 179 Z" />
          {/* horse head: arc face struck from the pivot */}
          <path d="M126.7 120.1 A135 135 0 0 0 127.7 232 L178 200 L180 150 Z" />
          <path d="M126.7 120.1 L141 111 L180 142 L180 150 Z" />
          {/* bridle cable down to the polished rod */}
          <path d="M127.7 232 L127.7 296" stroke={NAVY} strokeWidth="3.5" fill="none" />
          {/* pitman arm, runs down behind the gearbox */}
          <rect x="386" y="178" width="6" height="96" />
          {/* equalizer pin */}
          <circle cx="389" cy="176" r="7" />
        </g>

        {/* saddle bearing detail */}
        <circle cx="250" cy="176" r="10" fill={NAVY} />
        <circle cx="250" cy="176" r="4.5" fill="none" stroke="#6FA3D3" strokeWidth="1.4" opacity="0.55" />

        {/* counterweight and crank, drawn over the gearbox */}
        <g>
          <circle cx="394" cy="296" r="34" fill={NAVY} />
          <circle cx="394" cy="296" r="9" fill="none" stroke="#6FA3D3" strokeWidth="1.6" opacity="0.5" />
          <circle cx="394" cy="296" r="24" fill="none" stroke="#6FA3D3" strokeWidth="1.2" opacity="0.28" />
        </g>

        {/* wellhead and polished rod */}
        <g fill={NAVY}>
          <rect x="125.4" y="288" width="4.6" height="34" />
          <rect x="118" y="298" width="19" height="14" rx="2" />
          <path d="M106 330 L110 312 L146 312 L150 330 Z" />
          <rect x="112" y="318" width="34" height="12" />
          <path d="M150 324 L214 324" stroke={NAVY} strokeWidth="5" fill="none" />
        </g>
      </svg>
    </div>
  );
}
