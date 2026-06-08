// GLSL shaders per a la simulació Gray-Scott + render.
//
// Convencions:
//   - Canal R = concentració de la substància U.
//   - Canal G = concentració de la substància V.
//   - Tot al rang [0,1].

// Vertex shader genèric: quad fullscreen sense projecció (NDC directe).
export const VERT_QUAD = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// Sembrar el camp: U = 1 a tot arreu, V = 0, més clusters de V en
// posicions aleatòries — mides i intensitats variades perquè els
// patrons emergeixin amb diversitat des del primer instant.
export const SEED_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    float u = 1.0;
    float v = 0.0;
    // 14 llavors amb mides diverses, mig disperses pel camp.
    for (int i = 0; i < 14; i++) {
      float fi = float(i);
      vec2 seed = vec2(
        0.10 + hash(vec2(fi, 13.7)) * 0.80,
        0.10 + hash(vec2(fi, 7.31)) * 0.80
      );
      float sz = 0.0003 + hash(vec2(fi, 23.1)) * 0.0014;
      float d = length(vUv - seed);
      float a = exp(-d * d / sz);
      u -= a * (0.45 + hash(vec2(fi, 41.7)) * 0.2);
      v += a * (0.55 + hash(vec2(fi, 17.3)) * 0.25);
    }
    gl_FragColor = vec4(clamp(u, 0.0, 1.0), clamp(v, 0.0, 1.0), 0.0, 1.0);
  }
`;

// Pas d'actualització Gray-Scott + difusió del canal B (ripple visual).
//   R = U, G = V (reacció-difusió pròpiament dita).
//   B = ripple — pulse decorativa que segueix cada perturbació i decau
//   ràpid per donar feedback visible de la interacció.
export const UPDATE_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uState;
  uniform vec2 uTexelSize;
  uniform float uDu;
  uniform float uDv;
  uniform float uF;
  uniform float uK;
  uniform float uDt;
  uniform float uVariation;
  uniform sampler2D uHistory;
  uniform float uHistoryStrength;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  void main() {
    vec2 ts = uTexelSize;

    vec3 c  = texture2D(uState, vUv).rgb;
    vec3 le = texture2D(uState, vUv - vec2(ts.x, 0.0)).rgb;
    vec3 ri = texture2D(uState, vUv + vec2(ts.x, 0.0)).rgb;
    vec3 to = texture2D(uState, vUv + vec2(0.0, ts.y)).rgb;
    vec3 bo = texture2D(uState, vUv - vec2(0.0, ts.y)).rgb;
    vec3 tl = texture2D(uState, vUv + vec2(-ts.x,  ts.y)).rgb;
    vec3 tr = texture2D(uState, vUv + vec2( ts.x,  ts.y)).rgb;
    vec3 bl = texture2D(uState, vUv + vec2(-ts.x, -ts.y)).rgb;
    vec3 br = texture2D(uState, vUv + vec2( ts.x, -ts.y)).rgb;

    vec2 lap = (le.rg + ri.rg + to.rg + bo.rg) * 0.20
             + (tl.rg + tr.rg + bl.rg + br.rg) * 0.05
             - c.rg;

    float nF = vnoise(vUv * 2.3);
    float nK = vnoise(vUv * 2.7 + vec2(11.3, 4.7));
    float Floc = uF + (nF - 0.5) * uVariation * 0.012;
    float Kloc = uK + (nK - 0.5) * uVariation * 0.008;

    float hist = texture2D(uHistory, vUv).r;
    float push = hist * uHistoryStrength;
    Floc += push * 0.018;
    Kloc += push * 0.014;

    float u = c.r;
    float v = c.g;
    float uvv = u * v * v;

    float du = uDu * lap.r - uvv + Floc * (1.0 - u);
    float dv = uDv * lap.g + uvv - (Floc + Kloc) * v;

    // Ripple (B): difusió suau + decaïment ràpid. Visible com a flash
    // del cursor que es propaga i s'apaga en ~1s.
    float bAvg = (le.b + ri.b + to.b + bo.b) * 0.20
               + (tl.b + tr.b + bl.b + br.b) * 0.05;
    float newB = mix(c.b, bAvg, 0.45) * 0.935;

    gl_FragColor = vec4(
      clamp(u + du * uDt, 0.0, 1.0),
      clamp(v + dv * uDt, 0.0, 1.0),
      clamp(newB, 0.0, 4.0),
      1.0
    );
  }
`;

// Splat: injecta V al camp (perturba la reacció) i puja el ripple (canal B)
// per a fer visible la perturbació.
export const SPLAT_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uState;
  uniform vec2 uPoint;
  uniform float uRadius;
  uniform float uIntensity;
  uniform float uAspect;

  void main() {
    vec3 state = texture2D(uState, vUv).rgb;
    vec2 p = vUv - uPoint;
    p.x *= uAspect;
    float a = exp(-dot(p, p) / uRadius) * uIntensity;
    state.r = clamp(state.r - a * 0.5, 0.0, 1.0);
    state.g = clamp(state.g + a, 0.0, 1.0);
    state.b = clamp(state.b + a * 2.6, 0.0, 4.0);
    gl_FragColor = vec4(state.rgb, 1.0);
  }
`;

// Acumular saturació al buffer d'història: cada splat fa pujar el
// valor local de la història; també hi ha decaïment global per recuperar
// sensibilitat amb el temps.
export const HISTORY_SPLAT_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uHistory;
  uniform vec2 uPoint;
  uniform float uRadius;
  uniform float uAmount;
  uniform float uAspect;

  void main() {
    float h = texture2D(uHistory, vUv).r;
    vec2 p = vUv - uPoint;
    p.x *= uAspect;
    h += exp(-dot(p, p) / uRadius) * uAmount;
    gl_FragColor = vec4(min(h, 4.0), 0.0, 0.0, 1.0);
  }
`;

// Decaïment lent de la saturació d'història (la sensibilitat
// es recupera amb el temps).
export const HISTORY_DECAY_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uHistory;
  uniform float uDecay;

  void main() {
    float h = texture2D(uHistory, vUv).r * uDecay;
    gl_FragColor = vec4(h, 0.0, 0.0, 1.0);
  }
`;

// Display final: mapa V → paleta de gravat amb edge, glow càlid en
// patrons densos, habituació visible com a desaturació, i halo de
// ripple per cada perturbació recent.
export const DISPLAY_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uState;
  uniform sampler2D uHistory;
  uniform vec2 uTexelSize;
  uniform float uTime;

  void main() {
    vec2 ts = uTexelSize;
    vec3 state = texture2D(uState, vUv).rgb;
    float v = state.g;
    float u = state.r;
    float ripple = state.b;
    float hist = texture2D(uHistory, vUv).r;

    // Sobel edge sobre V — fronteres com a tinta més marcada.
    float vL = texture2D(uState, vUv - vec2(ts.x, 0.0)).g;
    float vR = texture2D(uState, vUv + vec2(ts.x, 0.0)).g;
    float vT = texture2D(uState, vUv + vec2(0.0, ts.y)).g;
    float vB = texture2D(uState, vUv - vec2(0.0, ts.y)).g;
    float vTL = texture2D(uState, vUv + vec2(-ts.x, ts.y)).g;
    float vTR = texture2D(uState, vUv + vec2(ts.x, ts.y)).g;
    float vBL = texture2D(uState, vUv + vec2(-ts.x, -ts.y)).g;
    float vBR = texture2D(uState, vUv + vec2(ts.x, -ts.y)).g;
    float gx = (vTR + 2.0 * vR + vBR) - (vTL + 2.0 * vL + vBL);
    float gy = (vTL + 2.0 * vT + vTR) - (vBL + 2.0 * vB + vBR);
    float edge = sqrt(gx * gx + gy * gy);

    // Glow: sample circular ampli — blur barat per a halo càlid.
    float gd = ts.x * 5.5;
    float glow = (
      texture2D(uState, vUv + vec2(gd, 0.0)).g +
      texture2D(uState, vUv - vec2(gd, 0.0)).g +
      texture2D(uState, vUv + vec2(0.0, gd)).g +
      texture2D(uState, vUv - vec2(0.0, gd)).g +
      texture2D(uState, vUv + vec2(gd, gd)).g +
      texture2D(uState, vUv - vec2(gd, gd)).g +
      texture2D(uState, vUv + vec2(gd, -gd)).g +
      texture2D(uState, vUv - vec2(gd, -gd)).g
    ) * 0.125;

    // Paleta — paper → wash → amber → sèpia → tinta.
    vec3 paper  = vec3(0.953, 0.937, 0.892);
    vec3 wash   = vec3(0.84, 0.74, 0.58);
    vec3 amber  = vec3(0.68, 0.48, 0.30);
    vec3 sepia  = vec3(0.42, 0.27, 0.16);
    vec3 ink    = vec3(0.08, 0.06, 0.05);

    vec2 q = vUv - 0.5;
    float r = length(q);
    vec3 bg = mix(paper, paper * 0.965, smoothstep(0.0, 0.85, r));

    vec3 col = bg;
    col = mix(col, wash,  smoothstep(0.05, 0.18, v));
    col = mix(col, amber, smoothstep(0.18, 0.32, v));
    col = mix(col, sepia, smoothstep(0.32, 0.46, v));
    col = mix(col, ink,   smoothstep(0.46, 0.62, v));

    // Halo càlid molt subtil al voltant de patrons densos — només on
    // el cell es propi no està ja saturat de tinta.
    float glowMask = smoothstep(0.20, 0.50, glow) * (1.0 - smoothstep(0.50, 0.70, v));
    col = mix(col, amber * 1.05, glowMask * 0.22);

    // Reforç de l'edge.
    float edgeMark = smoothstep(0.06, 0.22, edge);
    col = mix(col, ink, edgeMark * 0.45);

    // Habituació: desaturació + lleugera basculació cap a fred.
    float histN = clamp(hist * 0.40, 0.0, 0.6);
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(col, vec3(lum), histN * 0.4);
    col *= mix(vec3(1.0), vec3(0.92, 0.96, 1.05), histN * 0.7);

    // Ripple — flash càlid del cursor que es desfà ràpid.
    float rippleN = smoothstep(0.0, 1.8, ripple);
    vec3 ripCol = mix(paper, vec3(1.0, 0.98, 0.90), 0.6);
    col = mix(col, ripCol, rippleN * 0.45);
    // I un edge clar al rastre del ripple.
    float ripEdge = smoothstep(0.4, 0.9, ripple) * (1.0 - smoothstep(0.9, 1.6, ripple));
    col += vec3(0.06, 0.04, 0.02) * ripEdge;

    // Vinyeta.
    col *= 1.0 - r * r * 0.22;

    // Gra de paper.
    float grain = fract(sin(dot(vUv * 110.0 + vec2(uTime * 0.31, uTime * 0.27),
                                  vec2(12.9898, 78.233))) * 43758.5453);
    col -= (grain - 0.5) * 0.013;

    gl_FragColor = vec4(col, 1.0);
  }
`;
