// Engine de trilha MIDI (exclusivo da versão PlataformaDCC): toca arquivos .mid
// SINTETIZANDO as notas com osciladores no MESMO AudioContext do sound.js — sem
// arquivos de áudio, timbre chiptune que combina com o jogo. Mesma API do antigo
// MusicPlayer (start/stop/pause/resume/setVolume) pra integrar igual no main.js.
//
// As faixas vêm do manifesto midi/manifest.json (o servidor estático do Nuxt não
// lista diretório, então a lista é explícita). Sem faixas → simplesmente não toca.
import { MIDI_DIR, MIDI_MANIFEST } from "./config.js";
import { parseMidi } from "./midi-parser.js";

const LOOKAHEAD = 0.1;     // s — quanto agenda à frente do relógio de áudio
const TICK_MS = 25;        // intervalo do scheduler (wall-clock)
const MAX_VOICES = 24;     // teto de polifonia (evita pilha de osciladores)
const ATTACK = 0.008;      // s — ataque do envelope
const RELEASE = 0.09;      // s — release do envelope

const noteHz = (n) => 440 * Math.pow(2, (n - 69) / 12);   // nota MIDI → Hz

export class MidiMusicPlayer {
  constructor(audioEngine) {
    this.engine = audioEngine;     // compartilha o AudioContext da AudioEngine (SFX)
    this.volume = 1;
    this.tracksN = [];             // urls da trilha normal
    this.tracksD = [];             // urls da trilha do ARES
    this.active = [];              // lista em uso
    this.cache = {};               // url -> {events, duration}
    this.curUrl = null;
    this.playing = false;
    this.events = null;
    this.duration = 0;
    this.idx = 0;
    this.startTime = 0;            // ctx.currentTime correspondente ao tempo 0 da faixa
    this._pausedAt = -1;
    this._timer = null;
    this._voices = [];             // {ch, note, osc, g}
    this._ctx = null;
    this._out = null;
    this._noise = null;
    this._loadManifest();
  }

  // Lê midi/manifest.json: { "normal": ["a.mid", ...], "danger": ["b.mid", ...] }
  async _loadManifest() {
    try {
      const res = await fetch(MIDI_MANIFEST, { cache: "no-store" });
      if (!res.ok) return;
      const m = await res.json();
      this.tracksN = (m.normal || []).map((n) => MIDI_DIR + encodeURIComponent(n));
      this.tracksD = (m.danger || []).map((n) => MIDI_DIR + encodeURIComponent(n));
    } catch (e) { /* sem manifesto → sem trilha */ }
  }

  // Garante ctx + subgrafo de saída (gain de música → compressor → destino).
  _ensureGraph() {
    this.engine.ensure();
    const ctx = this.engine.ctx;
    if (!ctx) return false;
    if (this._ctx !== ctx) {
      this._ctx = ctx;
      this._out = ctx.createGain();
      this._out.gain.value = this.volume;
      const comp = ctx.createDynamicsCompressor();   // protege contra clipping da soma de osciladores
      this._out.connect(comp);
      comp.connect(ctx.destination);
      // ruído branco (2 s) reaproveitado pelos golpes de percussão (caixa, chimbal, pratos)
      const nlen = Math.floor(ctx.sampleRate * 2);
      this._noise = ctx.createBuffer(1, nlen, ctx.sampleRate);
      const nd = this._noise.getChannelData(0);
      for (let i = 0; i < nlen; i++) nd[i] = Math.random() * 2 - 1;
    }
    return true;
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this._out) this._out.gain.setTargetAtTime(this.volume, this._ctx.currentTime, 0.02);
  }

  async _load(url) {
    if (this.cache[url]) return this.cache[url];
    const res = await fetch(url, { cache: "force-cache" });
    const data = parseMidi(await res.arrayBuffer());
    this.cache[url] = data;
    return data;
  }

  // Início de partida: escolhe a lista (danger = ARES) e sorteia uma faixa.
  start(danger = false) {
    if (!this._ensureGraph()) return;
    this.active = danger ? this.tracksD : this.tracksN;
    if (!this.active.length && danger) this.active = this.tracksN;   // sem trilha danger → usa a normal
    this._pausedAt = -1;
    this.playRandom();
  }

  playRandom() {
    if (!this.active.length) return;                 // sem faixas → silêncio (jogo segue normal)
    let url = this.active[(Math.random() * this.active.length) | 0];
    if (this.active.length > 1) {
      let tries = 0;
      while (url === this.curUrl && tries++ < 5) url = this.active[(Math.random() * this.active.length) | 0];
    }
    this.curUrl = url;
    this._load(url)
      .then((data) => { this.events = data.events; this.duration = data.duration; this._startAt(0); })
      .catch(() => { /* arquivo inválido → ignora */ });
  }

  // (Re)inicia a reprodução da faixa atual a partir de `offset` segundos.
  _startAt(offset) {
    if (!this.events || !this._ensureGraph()) return;
    this._silenceVoices();
    this.startTime = this._ctx.currentTime + 0.06 - offset;
    this.idx = 0;
    while (this.idx < this.events.length && this.events[this.idx].time < offset) this.idx++;
    this.playing = true;
    this._pausedAt = -1;
    if (this._timer) clearInterval(this._timer);
    this._timer = setInterval(() => this._schedule(), TICK_MS);
    this._schedule();
  }

  _schedule() {
    if (!this.playing || !this._ctx) return;
    const ctx = this._ctx;
    const horizon = ctx.currentTime - this.startTime + LOOKAHEAD;
    while (this.idx < this.events.length && this.events[this.idx].time <= horizon) {
      const ev = this.events[this.idx++];
      const when = Math.max(this.startTime + ev.time, ctx.currentTime);
      if (ev.kind === "on") {
        if (ev.ch === 9) this._drumHit(ev.note, ev.vel, when);       // canal 10 (GM) = percussão
        else this._noteOn(ev, when);
      } else this._noteOff(ev, when);
    }
    if (this.idx >= this.events.length && ctx.currentTime - this.startTime > this.duration + 0.3) {
      this.playing = false;                          // fim da faixa → sorteia a próxima
      if (this._timer) { clearInterval(this._timer); this._timer = null; }
      this.playRandom();
    }
  }

  _noteOn(ev, when) {
    const ctx = this._ctx;
    if (this._voices.length >= MAX_VOICES) this._killVoice(this._voices.shift(), when);  // rouba a mais antiga
    const g = ctx.createGain();
    const peak = 0.18 * (ev.vel / 127);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(peak, when + ATTACK);
    const osc = ctx.createOscillator();
    osc.type = (ev.ch % 2 === 0) ? "square" : "triangle";    // timbre simples por canal
    osc.frequency.setValueAtTime(noteHz(ev.note), when);
    osc.connect(g); g.connect(this._out);
    osc.start(when);
    this._voices.push({ ch: ev.ch, note: ev.note, osc, g });
  }

  // Percussão (canal 10 do GM): a "nota" é o INSTRUMENTO, não a altura — então
  // sintetizamos um golpe (ruído filtrado + tom) em vez de afinar. Fire-and-forget:
  // cada hit se autodestrói no fim do decay (não entra na lista de vozes).
  _drumHit(note, vel, when) {
    const ctx = this._ctx, out = this._out;
    const v = (vel / 127) * 0.5;                       // ganho da percussão (mexa o 0.5 p/ balancear)
    const noise = (hz, dur, level, type = "highpass") => {
      const src = ctx.createBufferSource(); src.buffer = this._noise;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = hz;
      const g = ctx.createGain();
      g.gain.setValueAtTime(level * v, when);
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      src.connect(f); f.connect(g); g.connect(out);
      src.start(when, Math.random() * 0.4);            // offset aleatório → cada hit soa diferente
      src.stop(when + dur + 0.02);
    };
    const tone = (f0, f1, dur, level, wave = "sine") => {
      const osc = ctx.createOscillator(); osc.type = wave;
      osc.frequency.setValueAtTime(f0, when);
      osc.frequency.exponentialRampToValueAtTime(f1, when + dur * 0.9);
      const g = ctx.createGain();
      g.gain.setValueAtTime(level * v, when);
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      osc.connect(g); g.connect(out);
      osc.start(when); osc.stop(when + dur + 0.02);
    };
    if (note === 35 || note === 36) tone(150, 45, 0.18, 0.9);                        // bumbo
    else if (note === 38 || note === 40) { noise(1500, 0.13, 0.5); tone(190, 130, 0.06, 0.35, "triangle"); }  // caixa
    else if (note === 39) noise(1200, 0.12, 0.5, "bandpass");                        // palma
    else if (note === 37) noise(2500, 0.05, 0.4);                                    // rim/side stick
    else if (note === 42 || note === 44) noise(8000, 0.035, 0.3);                    // chimbal fechado
    else if (note === 46) noise(8000, 0.25, 0.28);                                   // chimbal aberto
    else if (note === 49 || note === 52 || note === 55 || note === 57) noise(5000, 0.6, 0.3);   // crash/splash/china
    else if (note === 51 || note === 53 || note === 59) noise(6500, 0.3, 0.24);      // condução (ride)
    else if (note >= 41 && note <= 50) { const p = 90 + (note - 41) * 14; tone(p, p * 0.6, 0.2, 0.6, "triangle"); }  // toms
    else noise(3000, 0.08, 0.3);                                                     // outros
  }

  _noteOff(ev, when) {
    for (let k = this._voices.length - 1; k >= 0; k--) {   // a voz mais recente desse canal+nota
      const v = this._voices[k];
      if (v.ch === ev.ch && v.note === ev.note) {
        this._releaseVoice(v, when);
        this._voices.splice(k, 1);
        return;
      }
    }
  }

  _releaseVoice(v, when) {
    try {
      v.g.gain.cancelScheduledValues(when);
      v.g.gain.setTargetAtTime(0.0001, when, RELEASE / 3);
      v.osc.stop(when + RELEASE + 0.05);
    } catch (e) {}
  }

  _killVoice(v, when) {
    try {
      v.g.gain.cancelScheduledValues(when);
      v.g.gain.setValueAtTime(0.0001, when);
      v.osc.stop(when + 0.02);
    } catch (e) {}
  }

  _silenceVoices() {
    const now = this._ctx ? this._ctx.currentTime : 0;
    for (const v of this._voices) this._killVoice(v, now);
    this._voices = [];
  }

  // Pausa mantendo a posição (Pause do jogo).
  pause() {
    if (!this.playing || !this._ctx) return;
    this._pausedAt = this._ctx.currentTime - this.startTime;
    this.playing = false;
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    this._silenceVoices();
  }

  resume() {
    if (this.playing || this._pausedAt < 0 || !this.events) return;
    this._startAt(Math.max(0, this._pausedAt));
  }

  // Para de vez (volta pro menu): zera a faixa atual.
  stop() {
    this.playing = false;
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    this._silenceVoices();
    this.curUrl = null;
    this.events = null;
    this._pausedAt = -1;
  }
}
