// Animated cover illustrations, one per filing type (pure SVG + CSS, no image requests).
// mood tints the scene: good = green, bad = red, neutral = brand pink.
const INK = { good: '#5BD16B', bad: '#F6465D', neutral: '#00BFA6' };
const BG = { good: ['#0F1F18', '#14301F'], bad: ['#211216', '#33161C'], neutral: ['#0E1A24', '#112A33'] };

export const ART_FOR = {
  results: 'bars', results_deck: 'bars', earnings_call: 'wave', investor_meetings: 'wave',
  'M&A': 'merge', management_change: 'people', fund_raise: 'coins', dividend: 'coins', bonus_split: 'pie',
  credit_rating: 'gauge', litigation: 'gavel', press_release: 'megaphone', capex: 'factory',
  pledging: 'lock', insider_trading: 'eye', postal_ballot: 'ballot', agm_egm: 'ballot',
};

export default function Art({ category, mood = 'neutral', ticker = '', size = 'thumb' }) {
  const kind = ART_FOR[category] || 'doc';
  const c = INK[mood] || INK.neutral;
  const [a, b] = BG[mood] || BG.neutral;
  const gid = `g-${kind}-${mood}-${size}`;
  return (
    <div className={`art art-${size}`} aria-hidden>
      <svg viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={a} /><stop offset="1" stopColor={b} /></linearGradient>
        </defs>
        <rect width="160" height="120" fill={`url(#${gid})`} />
        <circle className="a-float" cx="138" cy="18" r="26" fill="#fff" opacity=".05" />
        <circle className="a-float2" cx="16" cy="108" r="20" fill="#fff" opacity=".04" />
        {SCENES[kind](c)}
        {size === 'hero' && ticker && (
          <text x="12" y="20" fontFamily="JetBrains Mono, monospace" fontSize="9" fontWeight="600" fill={c} opacity=".8" letterSpacing="1">{ticker}</text>
        )}
      </svg>
    </div>
  );
}

const SCENES = {
  bars: (c) => (
    <g>
      <line x1="34" y1="92" x2="128" y2="92" stroke={c} strokeOpacity=".3" strokeWidth="2" />
      {[30, 44, 38, 58].map((h, i) => (
        <rect key={i} className="a-grow" style={{ animationDelay: `${i * 0.15}s` }} x={42 + i * 21} y={92 - h} width="13" height={h} rx="3" fill={c} opacity={0.45 + i * 0.18} />
      ))}
      <polyline className="a-draw" points="48,64 69,50 90,56 111,32" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle className="a-pop" cx="111" cy="32" r="4" fill={c} />
    </g>
  ),
  wave: (c) => (
    <g>
      <rect x="64" y="26" width="32" height="44" rx="16" fill="none" stroke={c} strokeWidth="3" />
      <path d="M56 58a24 24 0 0 0 48 0M80 82v10M68 92h24" fill="none" stroke={c} strokeWidth="3" strokeLinecap="round" />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} className="a-eq" style={{ animationDelay: `${i * 0.12}s` }} x={22 + i * 7} y="40" width="4" height="30" rx="2" fill={c} opacity=".55" />
      ))}
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} className="a-eq" style={{ animationDelay: `${0.3 + i * 0.12}s` }} x={110 + i * 7} y="40" width="4" height="30" rx="2" fill={c} opacity=".55" />
      ))}
    </g>
  ),
  merge: (c) => (
    <g>
      <circle className="a-left" cx="62" cy="60" r="24" fill={c} opacity=".35" />
      <circle className="a-right" cx="98" cy="60" r="24" fill={c} opacity=".55" />
      <path className="a-pop" d="M74 60h12M80 54v12" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    </g>
  ),
  people: (c) => (
    <g>
      <g opacity=".35"><circle cx="58" cy="46" r="11" fill={c} /><path d="M38 90c0-14 9-24 20-24s20 10 20 24z" fill={c} /></g>
      <g className="a-slidein"><circle cx="100" cy="44" r="12" fill={c} /><path d="M78 90c0-15 10-26 22-26s22 11 22 26z" fill={c} /></g>
      <path className="a-pop" d="M74 30l6-6 6 6" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  ),
  coins: (c) => (
    <g>
      {[0, 1, 2].map((i) => <ellipse key={i} cx="80" cy={88 - i * 9} rx="22" ry="7" fill={c} opacity={0.35 + i * 0.15} />)}
      <g className="a-drop"><ellipse cx="80" cy="40" rx="16" ry="16" fill={c} opacity=".85" /><text x="80" y="45.5" textAnchor="middle" fontSize="15" fontWeight="700" fill="#fff">₹</text></g>
      <circle className="a-twinkle" cx="112" cy="40" r="2.5" fill={c} />
      <circle className="a-twinkle" style={{ animationDelay: '.6s' }} cx="50" cy="52" r="2" fill={c} />
    </g>
  ),
  pie: (c) => (
    <g>
      <path d="M78 60V32a28 28 0 1 0 28 28z" fill={c} opacity=".45" />
      <path className="a-split" d="M84 54V26a28 28 0 0 1 28 28z" fill={c} opacity=".85" />
    </g>
  ),
  gauge: (c) => (
    <g>
      <path d="M42 84a38 38 0 0 1 76 0" fill="none" stroke={c} strokeOpacity=".25" strokeWidth="10" strokeLinecap="round" />
      <path d="M42 84a38 38 0 0 1 58-32" fill="none" stroke={c} strokeOpacity=".7" strokeWidth="10" strokeLinecap="round" />
      <g className="a-needle" style={{ transformOrigin: '80px 84px' }}><line x1="80" y1="84" x2="80" y2="54" stroke={c} strokeWidth="3" strokeLinecap="round" /></g>
      <circle cx="80" cy="84" r="5" fill={c} />
    </g>
  ),
  gavel: (c) => (
    <g>
      <rect x="46" y="88" width="68" height="8" rx="3" fill={c} opacity=".4" />
      <g className="a-gavel" style={{ transformOrigin: '96px 80px' }}>
        <rect x="58" y="36" width="34" height="16" rx="4" fill={c} transform="rotate(-35 75 44)" />
        <line x1="80" y1="52" x2="100" y2="82" stroke={c} strokeWidth="5" strokeLinecap="round" />
      </g>
      <path className="a-twinkle" d="M50 80l-6-4M54 74l-4-7" stroke={c} strokeWidth="2" strokeLinecap="round" />
    </g>
  ),
  megaphone: (c) => (
    <g>
      <path d="M44 52h12l30-16v48L56 68H44z" fill={c} opacity=".8" />
      <rect x="50" y="68" width="8" height="18" rx="3" fill={c} opacity=".5" />
      {[0, 1, 2].map((i) => (
        <path key={i} className="a-ripple" style={{ animationDelay: `${i * 0.35}s` }} d={`M${96 + i * 10} ${46 - i * 6}a${18 + i * 8} ${18 + i * 8} 0 0 1 0 ${28 + i * 12}`} fill="none" stroke={c} strokeWidth="3" strokeLinecap="round" />
      ))}
    </g>
  ),
  factory: (c) => (
    <g>
      <path d="M34 92V58l20 12V58l20 12V58l20 12V40h12v52z" fill={c} opacity=".75" />
      <circle className="a-smoke" cx="100" cy="32" r="6" fill={c} opacity=".3" />
      <circle className="a-smoke" style={{ animationDelay: '.8s' }} cx="100" cy="32" r="5" fill={c} opacity=".3" />
      {[0, 1, 2].map((i) => <rect key={i} x={40 + i * 20} y="78" width="8" height="8" rx="1" fill="#F0B90B" opacity=".8" />)}
    </g>
  ),
  lock: (c) => (
    <g className="a-float">
      <path d="M66 54v-8a14 14 0 0 1 28 0v8" fill="none" stroke={c} strokeWidth="5" />
      <rect x="58" y="54" width="44" height="36" rx="6" fill={c} opacity=".8" />
      <circle cx="80" cy="70" r="4" fill="#fff" /><rect x="78.5" y="72" width="3" height="8" fill="#fff" />
    </g>
  ),
  eye: (c) => (
    <g>
      <path d="M36 60s16-24 44-24 44 24 44 24-16 24-44 24-44-24-44-24z" fill="none" stroke={c} strokeWidth="3" />
      <g className="a-look"><circle cx="80" cy="60" r="12" fill={c} opacity=".8" /><circle cx="84" cy="56" r="3" fill="#fff" /></g>
    </g>
  ),
  ballot: (c) => (
    <g>
      <rect x="50" y="62" width="60" height="32" rx="4" fill={c} opacity=".75" />
      <rect x="66" y="60" width="28" height="4" rx="2" fill="#121417" />
      <g className="a-drop"><rect x="68" y="30" width="24" height="28" rx="2" fill="#1A1D26" stroke={c} strokeWidth="2" /><path d="M74 44l4 4 8-8" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" /></g>
    </g>
  ),
  doc: (c) => (
    <g className="a-float">
      <path d="M58 28h32l14 14v50H58z" fill="#1A1D26" stroke={c} strokeWidth="2.5" />
      <path d="M90 28v14h14" fill="none" stroke={c} strokeWidth="2.5" />
      {[0, 1, 2, 3].map((i) => <rect key={i} className="a-grow-x" style={{ animationDelay: `${i * 0.15}s` }} x="66" y={52 + i * 9} width={i === 3 ? 18 : 30} height="3.5" rx="1.75" fill={c} opacity=".55" />)}
    </g>
  ),
};

// Empty-state picture
export function EmptyArt() {
  return (
    <svg width="120" height="90" viewBox="0 0 160 120" aria-hidden>
      <circle className="a-float" cx="80" cy="60" r="42" fill="var(--auto-bg)" />
      <path d="M58 64l14 14 30-32" fill="none" stroke="var(--auto)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" className="a-draw" />
      <circle className="a-twinkle" cx="122" cy="30" r="3" fill="var(--auto)" />
      <circle className="a-twinkle" style={{ animationDelay: '.7s' }} cx="36" cy="38" r="2.5" fill="var(--auto)" />
    </svg>
  );
}
