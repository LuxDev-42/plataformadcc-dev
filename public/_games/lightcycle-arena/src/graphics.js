// Tudo gráfico: canvas, câmera e desenho da cena (arena, rastro, farol,
// partículas). Lê o `state` mas não o modifica (a câmera é estado próprio).
import { CELL, COLS, ROWS, W, H, DIRS, MAX_ZOOM, clamp } from "./config.js";

const MAX_DPR = 2;   // teto da resolução de render (≤2x = sem mudança visual; baixe p/ mais FPS em telas hi-DPI)

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.dpr = 1;
    this.viewW = 0;
    this.viewH = 0;
    // Câmera (coordenadas de mundo)
    this.camX = W / 2;
    this.camY = H / 2;
    this.camZoom = 1;
    this.snap = true;
    this.resize();
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    this.viewW = window.innerWidth;
    this.viewH = window.innerHeight;
    this.canvas.width = Math.max(1, Math.floor(this.viewW * this.dpr));
    this.canvas.height = Math.max(1, Math.floor(this.viewH * this.dpr));
    this.canvas.style.width = this.viewW + "px";
    this.canvas.style.height = this.viewH + "px";
  }

  // Faz a próxima atualização saltar direto para o enquadramento (sem suavizar).
  snapToTarget() { this.snap = true; }

  // ---- Câmera ----
  headWorld(player) {
    const progress = player.alive ? player.progress : 1;
    return {
      x: (player.prevX + (player.x - player.prevX) * progress + 0.5) * CELL,
      y: (player.prevY + (player.y - player.prevY) * progress + 0.5) * CELL,
    };
  }

  // Pan estéreo (-1..1) pela posição horizontal da moto NA TELA.
  screenPan(player) {
    const progress = player.alive ? player.progress : 1;   // só precisamos do X (sem alocar objeto)
    const worldX = (player.prevX + (player.x - player.prevX) * progress + 0.5) * CELL;
    const screenX = (worldX - this.camX) * this.camZoom + this.viewW / 2;
    return clamp((screenX / this.viewW) * 2 - 1, -1, 1);
  }

  cameraTarget(state) {
    // enquadra as motos vivas (ou todas, se a rodada já acabou) — inline, sem alocar arrays/objetos
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, count = 0;
    for (let pass = 0; pass < 2 && count === 0; pass++) {
      for (const p of state.players) {
        if (pass === 0 && !p.alive) continue;          // 1ª passada: só vivas; 2ª (se ninguém vivo): todas
        const progress = p.alive ? p.progress : 1;
        const hx = (p.prevX + (p.x - p.prevX) * progress + 0.5) * CELL;
        const hy = (p.prevY + (p.y - p.prevY) * progress + 0.5) * CELL;
        if (hx < minX) minX = hx;
        if (hx > maxX) maxX = hx;
        if (hy < minY) minY = hy;
        if (hy > maxY) maxY = hy;
        count++;
      }
    }
    const padding = 26 * CELL;                       // folga ao redor das motos
    const fitMargin = 6 * CELL;                      // margem ao enquadrar a arena inteira
    const frameW = (maxX - minX) + padding * 2;
    const frameH = (maxY - minY) + padding * 2;
    // pode afastar até ver a arena inteira + uma margem (pra a borda respirar)
    const minZoom = Math.min(this.viewW / (W + fitMargin * 2), this.viewH / (H + fitMargin * 2));
    let zoom = Math.min(this.viewW / frameW, this.viewH / frameH);
    zoom = clamp(zoom, minZoom, MAX_ZOOM);
    const halfViewW = (this.viewW / 2) / zoom;
    const halfViewH = (this.viewH / 2) / zoom;
    let centerX = (minX + maxX) / 2;
    let centerY = (minY + maxY) / 2;
    // segue o ponto médio livremente — a câmera PODE vazar além das paredes,
    // deixando a borda da arena visível; só recentraliza no eixo em que a
    // arena já cabe inteira na tela
    if (W <= halfViewW * 2) centerX = W / 2;
    if (H <= halfViewH * 2) centerY = H / 2;
    return { x: centerX, y: centerY, zoom };
  }

  updateCamera(state, dt) {
    if (!state.players) return;
    const target = this.cameraTarget(state);
    if (this.snap) {
      this.camX = target.x; this.camY = target.y; this.camZoom = target.zoom; this.snap = false;
      return;
    }
    const smoothing = 1 - Math.exp(-dt / 1000);      // suavização ~exponencial (maior = mais suave)
    this.camX += (target.x - this.camX) * smoothing;
    this.camY += (target.y - this.camY) * smoothing;
    this.camZoom += (target.zoom - this.camZoom) * smoothing;
  }

  // ---- Desenho ----
  drawArena(ares) {
    const ctx = this.ctx;
    ctx.save();
    const halfViewW = (this.viewW / 2) / this.camZoom;
    const halfViewH = (this.viewH / 2) / this.camZoom;
    const colStart = Math.max(0, Math.floor((this.camX - halfViewW) / CELL));
    const colEnd = Math.min(COLS, Math.ceil((this.camX + halfViewW) / CELL));
    const rowStart = Math.max(0, Math.floor((this.camY - halfViewH) / CELL));
    const rowEnd = Math.min(ROWS, Math.ceil((this.camY + halfViewH) / CELL));

    // grade fina (a que as motos percorrem), 1px de tela — vermelha no modo ARES
    ctx.lineWidth = 1 / this.camZoom;
    ctx.strokeStyle = ares ? "rgba(255,40,40,0.13)" : "rgba(25,120,160,0.10)";
    ctx.beginPath();
    for (let col = colStart; col <= colEnd; col++) { ctx.moveTo(col*CELL, rowStart*CELL); ctx.lineTo(col*CELL, rowEnd*CELL); }
    for (let row = rowStart; row <= rowEnd; row++) { ctx.moveTo(colStart*CELL, row*CELL); ctx.lineTo(colEnd*CELL, row*CELL); }
    ctx.stroke();

    // grade decorativa maior (a cada MAJOR células) — linhas brilham um pouco mais
    const MAJOR = 10;
    ctx.beginPath();
    for (let col = Math.floor(colStart / MAJOR) * MAJOR; col <= colEnd; col += MAJOR) { ctx.moveTo(col*CELL, rowStart*CELL); ctx.lineTo(col*CELL, rowEnd*CELL); }
    for (let row = Math.floor(rowStart / MAJOR) * MAJOR; row <= rowEnd; row += MAJOR) { ctx.moveTo(colStart*CELL, row*CELL); ctx.lineTo(colEnd*CELL, row*CELL); }
    // SEM shadowBlur (caríssimo num path que cobre a tela toda, todo frame):
    // glow fingido por camadas — halo largo e fraco + núcleo brilhante.
    ctx.lineWidth = 4 / this.camZoom;
    ctx.strokeStyle = ares ? "rgba(255,40,40,0.10)" : "rgba(25,224,255,0.09)";
    ctx.stroke();
    ctx.lineWidth = 1.4 / this.camZoom;
    ctx.strokeStyle = ares ? "rgba(255,70,70,0.34)" : "rgba(60,200,235,0.30)";
    ctx.stroke();

    // borda da arena (as paredes)
    ctx.lineWidth = 3 / this.camZoom;
    ctx.strokeStyle = ares ? "rgba(255,40,40,0.6)" : "rgba(25,224,255,0.55)";
    ctx.shadowColor = ares ? "rgba(255,40,40,0.65)" : "rgba(25,224,255,0.6)";
    ctx.shadowBlur = 18;
    ctx.strokeRect(0, 0, W, H);
    ctx.restore();
  }

  drawHeadlight(player, headX, headY) {
    // Cone de luz — a luz projetada do farol (atrás do bloco)
    const ctx = this.ctx;
    const dir = DIRS[player.dir];
    const side = { x: -dir.y, y: dir.x };            // vetor perpendicular à direção
    const coneLength = 7.8 * CELL;                   // alcance do facho
    const coneHalfWidth = 2 * CELL;                  // meia-largura na ponta (cone estreito)
    const baseHalfWidth = CELL * 0.45;               // meia-largura na origem (quase um ponto)
    const baseX = headX + dir.x * CELL * 0.4;
    const baseY = headY + dir.y * CELL * 0.4;
    const tipX = headX + dir.x * coneLength;
    const tipY = headY + dir.y * coneLength;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";        // luz aditiva: brilha sobre o fundo escuro
    const coneGradient = ctx.createRadialGradient(headX, headY, CELL * 0.3, headX, headY, coneLength);
    coneGradient.addColorStop(0,    `hsla(${player.hue}, 100%, 78%, 0.55)`);
    coneGradient.addColorStop(0.45, `hsla(${player.hue}, 100%, 62%, 0.20)`);
    coneGradient.addColorStop(1,    `hsla(${player.hue}, 100%, 55%, 0)`);
    ctx.fillStyle = coneGradient;
    ctx.beginPath();
    ctx.moveTo(baseX + side.x * baseHalfWidth, baseY + side.y * baseHalfWidth);
    ctx.lineTo(tipX  + side.x * coneHalfWidth, tipY  + side.y * coneHalfWidth);
    ctx.lineTo(tipX  - side.x * coneHalfWidth, tipY  - side.y * coneHalfWidth);
    ctx.lineTo(baseX - side.x * baseHalfWidth, baseY - side.y * baseHalfWidth);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawHeadlightBar(player, headX, headY) {
    // Lâmpada do farol: barra perpendicular à direção, dentro do bloco (por cima)
    const ctx = this.ctx;
    const dir = DIRS[player.dir];
    const side = { x: -dir.y, y: dir.x };
    const barX = headX + dir.x * CELL * 0.3;         // levemente à frente, ainda dentro do bloco
    const barY = headY + dir.y * CELL * 0.3;
    const halfLength = CELL * 0.42;
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.96)";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.shadowColor = `hsla(${player.hue}, 100%, 72%, 0.95)`;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(barX + side.x * halfLength, barY + side.y * halfLength);
    ctx.lineTo(barX - side.x * halfLength, barY - side.y * halfLength);
    ctx.stroke();
    ctx.restore();
  }

  drawTrail(player) {
    const ctx = this.ctx;
    const trail = player.trail;
    const len = trail.length;
    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.moveTo((trail[0].x + 0.5) * CELL, (trail[0].y + 0.5) * CELL);
    const wallEnd = player.alive ? len - 1 : len;    // vivo: parede até a célula anterior (cabeça é interpolada)
    for (let i = 1; i < wallEnd; i++) {
      ctx.lineTo((trail[i].x + 0.5) * CELL, (trail[i].y + 0.5) * CELL);
    }
    let headX = (player.x + 0.5) * CELL, headY = (player.y + 0.5) * CELL;
    if (player.alive) {
      headX = (player.prevX + (player.x - player.prevX) * player.progress + 0.5) * CELL;
      headY = (player.prevY + (player.y - player.prevY) * player.progress + 0.5) * CELL;
      ctx.lineTo(headX, headY);
    }

    // glow externo (sem shadow, barato)
    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = player.glow;
    ctx.lineWidth = CELL * 1.35;
    ctx.stroke();
    
    // núcleo
    ctx.globalAlpha = 1;
    ctx.strokeStyle = player.color;
    ctx.lineWidth = CELL - 2;
    ctx.stroke();
    ctx.restore();

    // cabeça brilhante (só vivo) — o bloco do derrotado some, a trilha fica
    if (player.alive) {
      this.drawHeadlight(player, headX, headY);
      ctx.save();
      ctx.shadowColor = player.glow;
      ctx.shadowBlur = 18;
      ctx.fillStyle = "#ffffff";
      const outerSize = CELL + 2;
      ctx.fillRect(headX - outerSize / 2, headY - outerSize / 2, outerSize, outerSize);
      ctx.shadowBlur = 24;
      ctx.fillStyle = player.color;
      const innerSize = CELL - 1;
      ctx.fillRect(headX - innerSize / 2, headY - innerSize / 2, innerSize, innerSize);
      ctx.restore();
      this.drawHeadlightBar(player, headX, headY);   // lâmpada perpendicular, por cima do bloco
    }
  }

  drawParticles(particles) {
    if (!particles.length) return;
    const ctx = this.ctx;
    ctx.save();
    for (const particle of particles) {
      ctx.globalAlpha = Math.max(0, particle.life);
      ctx.shadowColor = particle.color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = particle.color;
      const drawSize = particle.size * (0.5 + particle.life * 0.5);
      ctx.fillRect(particle.x - drawSize / 2, particle.y - drawSize / 2, drawSize, drawSize);
    }
    ctx.restore();
  }

  render(state) {
    const ctx = this.ctx;
    // base em coordenadas de tela (com devicePixelRatio)
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = "#03060c";
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    // aplica a câmera
    ctx.translate(this.viewW / 2, this.viewH / 2);
    ctx.scale(this.camZoom, this.camZoom);
    ctx.translate(-this.camX, -this.camY);

    this.drawArena(state.ares);
    if (state.players) for (const player of state.players) this.drawTrail(player);
    this.drawParticles(state.particles);
  }
}
