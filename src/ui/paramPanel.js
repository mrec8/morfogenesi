// Panel sutil que mostra els valors actuals de F i k al "Pearson space".
//
// Visualment: una caixa petita a la cantonada inferior esquerra, amb un
// punt que es desplaça lentament dins de la regió possible de paràmetres.
// Una traça de baixa opacitat mostra la trajectòria recent.
//
// No és una interfície de control — només una insinuació al lector que
// la peça està viatjant per un espai de possibilitats, no congelada.

export class ParamPanel {
  constructor(container) {
    this.container = container;
    this.history = [];
    this.maxHistory = 320;
    // Rang del Pearson space que mostrem. Els paràmetres oscil·len en
    // una regió més petita; ho deixem així perquè es vegi que la peça
    // viu en un subconjunt d'un espai més ampli.
    this.fRange = [0.014, 0.075];
    this.kRange = [0.038, 0.078];

    this._build();
  }

  _build() {
    const panel = document.createElement('div');
    panel.className = 'param-panel';

    const canvas = document.createElement('canvas');
    canvas.width = 144;
    canvas.height = 144;
    canvas.className = 'param-canvas';
    panel.appendChild(canvas);

    const label = document.createElement('div');
    label.className = 'param-label';
    label.innerHTML = `
      <div class="param-line"><span class="param-key">F</span><span class="param-val" data-k="F">—</span></div>
      <div class="param-line"><span class="param-key">k</span><span class="param-val" data-k="k">—</span></div>
    `;
    panel.appendChild(label);

    this.container.appendChild(panel);
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.elF = label.querySelector('[data-k="F"]');
    this.elK = label.querySelector('[data-k="k"]');

    // Cache per evitar canvis innecessaris al DOM.
    this._lastFStr = '';
    this._lastKStr = '';
  }

  update(F, k) {
    this.history.push({ F, k });
    if (this.history.length > this.maxHistory) this.history.shift();
    this._draw();
    this._updateLabel(F, k);
  }

  _toPixel(p, W, H, m) {
    const fr = this.fRange;
    const kr = this.kRange;
    const fN = (p.F - fr[0]) / (fr[1] - fr[0]);
    const kN = (p.k - kr[0]) / (kr[1] - kr[0]);
    return {
      x: m + kN * (W - 2 * m),
      y: H - m - fN * (H - 2 * m),
    };
  }

  _draw() {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const m = 14;

    ctx.clearRect(0, 0, W, H);

    // Fons amb tonalitat càlida del paper.
    ctx.fillStyle = 'rgba(245, 240, 226, 0.78)';
    ctx.fillRect(0, 0, W, H);

    // Marc fí.
    ctx.strokeStyle = 'rgba(58, 42, 26, 0.45)';
    ctx.lineWidth = 0.6;
    ctx.strokeRect(m, m, W - 2 * m, H - 2 * m);

    // Grid molt suau (terceres parts).
    ctx.strokeStyle = 'rgba(58, 42, 26, 0.12)';
    ctx.lineWidth = 0.4;
    const innerW = W - 2 * m;
    const innerH = H - 2 * m;
    for (let i = 1; i < 3; i++) {
      const x = m + (innerW * i) / 3;
      const y = m + (innerH * i) / 3;
      ctx.beginPath();
      ctx.moveTo(x, m);
      ctx.lineTo(x, H - m);
      ctx.moveTo(m, y);
      ctx.lineTo(W - m, y);
      ctx.stroke();
    }

    // Etiquetes dels eixos.
    ctx.fillStyle = 'rgba(58, 42, 26, 0.55)';
    ctx.font = 'italic 9px "EB Garamond", Garamond, Georgia, serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('F', 2, 2);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('k', W - 2, H - 2);

    // Traça de la història.
    if (this.history.length > 1) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      // Dibuixem la traça en segments amb opacitat creixent cap al final.
      const N = this.history.length;
      const step = Math.max(1, Math.floor(N / 80));
      for (let i = step; i < N; i += step) {
        const t = i / N;
        const alpha = 0.06 + t * t * 0.55;
        ctx.strokeStyle = `rgba(72, 48, 28, ${alpha})`;
        ctx.lineWidth = 0.5 + t * 0.8;
        ctx.beginPath();
        const p0 = this._toPixel(this.history[i - step], W, H, m);
        const p1 = this._toPixel(this.history[i], W, H, m);
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }
    }

    // Punt actual amb halo.
    const cur = this.history[this.history.length - 1];
    if (cur) {
      const p = this._toPixel(cur, W, H, m);
      // Halo càlid pulsant.
      const t = (Date.now() / 1000) % 2;
      const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI);
      const haloR = 5 + pulse * 2.5;
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, haloR);
      grad.addColorStop(0, 'rgba(180, 100, 50, 0.45)');
      grad.addColorStop(1, 'rgba(180, 100, 50, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, haloR, 0, Math.PI * 2);
      ctx.fill();

      // Punt central.
      ctx.fillStyle = 'rgba(40, 26, 16, 0.95)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _updateLabel(F, k) {
    const fStr = F.toFixed(4);
    const kStr = k.toFixed(4);
    if (fStr !== this._lastFStr) {
      this.elF.textContent = fStr;
      this._lastFStr = fStr;
    }
    if (kStr !== this._lastKStr) {
      this.elK.textContent = kStr;
      this._lastKStr = kStr;
    }
  }
}
