/* 器械库与比赛共用的外观参数。 */
(function(G) {
  const YY = G.YY;
// ---------- 球拍：拍框渐变、拍头形状（sq 越大越“方圆”）、框厚、中杆、手胶、拍线与贴花 ----------
const RACKETS = {
  r_basic: { tier: 'std', tag: '均衡入门', frame: ['#f7fbff', '#a6d9ea'], edge: '#3f7f9c', accent: '#2aa6c9', shaft: ['#e7eef8', '#9fb3c9'], grip: '#2f6fb5', wrap: '#e9f4ff', string: '#f6fbff', thick: 1, sq: .1, decal: 'band' },
  r_flex: { tier: 'adv', tag: '容错型', frame: ['#fffaf0', '#efe2c9'], edge: '#b9a37c', accent: '#4fd1a5', shaft: ['#e6fff4', '#5fcfa6'], grip: '#2f9f7c', wrap: '#e9fff5', string: '#f4fff9', thick: 1.02, sq: 0, decal: 'feather1', inner: '#bff5df' },
  r_heavy: { tier: 'pro', tag: '后场强攻', frame: ['#3e3f47', '#141519'], edge: '#000000', accent: '#ff4a2e', shaft: ['#34353d', '#111216'], grip: '#18191d', wrap: '#ff4a2e', string: '#ffb19f', thick: 1.24, sq: .3, decal: 'ridge', headW: 1.03, inner: '#ff5a2e', matte: true },
  r_light: { tier: 'pro', tag: '快速衔接', frame: ['#ffffff', '#b8c4d4'], edge: '#5d6b80', accent: '#2fc4ff', shaft: ['#f6f9fd', '#aab8c9'], grip: '#1d4f73', wrap: '#7fe0ff', string: '#eefaff', thick: .72, sq: .06, decal: 'blade', shaftW: .86, inner: '#9feaff' },
  r_silk: { tier: 'adv', tag: '网前控制', frame: ['#fffdfa', '#f2e6ea'], edge: '#e79ab4', accent: '#ffb3cb', shaft: ['#fffafc', '#e9c9d6'], grip: '#d4789c', wrap: '#ffe1ec', string: '#fff4f8', thick: 1, sq: .72, decal: 'petals', inner: '#ffd0df' },
  r_tide: { tier: 'adv', tag: '持续拉吊', frame: ['#2f6cc8', '#0c2a66'], edge: '#061638', accent: '#7fe9ff', shaft: ['#e8f1ff', '#2f6cc8'], shaftV: true, grip: '#123a7a', wrap: '#7fe9ff', string: '#d8f6ff', thick: 1.04, sq: .18, decal: 'ripple', inner: '#8ff0ff' },
  r_prism: { tier: 'pro', tag: '精准击球', frame: ['#676d7c', '#2a2e37'], edge: '#14161b', accent: '#ff8a1e', shaft: ['#ffffff', '#cfd6e0'], grip: '#2a2e37', wrap: '#ff8a1e', string: '#fff0e0', thick: 1.08, sq: .34, decal: 'facet', poly: 12, gridShaft: true, inner: '#c6ccd8' },
  r_star: { tier: 'ltd', tag: '球路变化', frame: ['#6a45c8', '#1d0f4a'], edge: '#0c0628', accent: '#ffcf4a', shaft: ['#eef1f8', '#9aa6bd'], grip: '#2a1660', wrap: '#ffcf4a', string: '#ffeaa8', thick: 1.06, sq: .2, decal: 'stars', orbit: true, glow: '#ffcf4a', inner: '#c7a8ff' },
  r_shield: { tier: 'pro', tag: '防守反击', frame: ['#767e8c', '#363c47'], edge: '#1a1e25', accent: '#2fa36d', shaft: ['#5d6472', '#2b3039'], grip: '#1f5b40', wrap: '#5fe3a1', string: '#e2f7ec', thick: 1.22, sq: .46, decal: 'shield', headW: 1.08, inner: '#2fa36d' },
};
// ---------- 球线：线盘配色、线色、线径（影响缠绕纹理与拍面网格粗细） ----------
const STRINGS = {
  s_dur: { tier: 'std', tag: '耐打耐用', color: '#f2f6fa', shade: '#b9c4d0', reel: ['#3b7bd0', '#1d3f78'], label: '#ffffff', gauge: .70, sheen: .25 },
  s_ctrl: { tier: 'adv', tag: '咬球控制', color: '#8fb3d6', shade: '#4d7299', reel: ['#26344f', '#121a2b'], label: '#9fd1ff', gauge: .68, sheen: .08, matte: true },
  s_crisp: { tier: 'pro', tag: '清脆击球', color: '#ffe24a', shade: '#c9a20f', reel: ['#2b2b2b', '#0d0d0d'], label: '#ffe24a', gauge: .62, sheen: .45 },
  s_rep: { tier: 'pro', tag: '高弹进攻', color: '#ff5fa2', shade: '#b82768', reel: ['#4a1a5a', '#1f0826'], label: '#ffb3d4', gauge: .66, sheen: .4 },
};
// ---------- 球鞋：鞋面/中底/大底配色、中底厚度、鞋跟落差、侧面纹样 ----------
const SHOES = {
  sh_basic: { tier: 'std', tag: '抓地稳当', upper: ['#ffffff', '#dfe7f2'], accent: '#2f7de1', trim: '#173a6b', mid: ['#ffffff', '#e3e8ef'], out: '#c98a4b', lace: '#f4f7fb', midH: .075, heel: .085, logo: 'arcs' },
  sh_run: { tier: 'warn', tag: '不适合球场', upper: ['#b7bfcc', '#7f8898'], accent: '#ff8a3d', trim: '#3d4350', mid: ['#ffffff', '#e8e2d8'], out: '#4a4e57', lace: '#2b2f38', midH: .11, heel: .17, logo: 'reflect', mesh: true, toe: .05 },
  sh_light: { tier: 'adv', tag: '全场移动', upper: ['#fffef6', '#efe8d2'], accent: '#3fd0e0', trim: '#2a7f9a', mid: ['#ffffff', '#eef4f6'], out: '#9fd2ff', lace: '#3fd0e0', midH: .05, heel: .055, logo: 'wing', knit: true },
  sh_stable: { tier: 'pro', tag: '急停转向', upper: ['#555b67', '#2b2f37'], accent: '#ffb02e', trim: '#15171c', mid: ['#eceef2', '#c4c9d2'], out: '#2a2c32', lace: '#ffb02e', midH: .08, heel: .09, logo: 'cage', outrigger: true, herring: true, hexHeel: true },
  sh_cushion: { tier: 'pro', tag: '跳杀衔接', upper: ['#ffffff', '#ece9f6'], accent: '#a98bf0', trim: '#5a46a0', mid: ['#f3edff', '#c9b6f4'], out: '#c98a4b', lace: '#ffffff', midH: .1, heel: .12, logo: 'cloud', layered: true, spring: true },
  sh_butterfly: { tier: 'adv', tag: '上网回收', upper: ['#ffffff', '#f3eef1'], accent: '#ff9cc2', trim: '#c25a86', mid: ['#ffffff', '#eaf2ef'], out: '#d39a5c', lace: '#ff9cc2', midH: .05, heel: .06, logo: 'butterfly', fore: '#7fe6c4', toe: .075, low: true },
  sh_cruise: { tier: 'pro', tag: '体能管理', upper: ['#fdf8ec', '#e9dfc8'], accent: '#6fa8c8', trim: '#3d6a85', mid: ['#ffffff', '#ece6da'], out: '#c98a4b', lace: '#6fa8c8', midH: .085, heel: .1, logo: 'route' },
  sh_moon: { tier: 'pro', tag: '后场覆盖', upper: ['#33468a', '#141c44'], accent: '#dfe6f4', trim: '#0a1030', mid: ['#f1f4fa', '#c9d1e2'], out: '#3a4258', lace: '#dfe6f4', midH: .065, heel: .075, logo: 'moon' },
};
const ART = { racket: RACKETS, string: STRINGS, shoe: SHOES };

  YY.GEAR_ART = ART;
})(typeof GameGlobal !== 'undefined' ? GameGlobal : typeof window !== 'undefined' ? window : globalThis);
