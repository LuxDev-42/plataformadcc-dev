// Constantes do jogo, vetores de direção e utilidades da grade.
// Módulo "folha": não importa nada, todos os outros importam daqui.

export const CELL = 12;        // unidade de mundo (px) por célula
export const COLS = 160;
export const ROWS = 90;
export const W = COLS * CELL;  // largura do mundo (px)
export const H = ROWS * CELL;  // altura do mundo (px)

export const BASE_TICK = 70;    // ms por passo (menor = mais rápido)
export const MIN_TICK = 42;           // intervalo mínimo = velocidade máxima
export const MAX_TICK = 150;          // intervalo máximo = velocidade mínima (piso ao virar muito)
export const SPEEDUP = 0.980;         // fator de aceleração por passo (mais perto de 1 = recupera devagar)
export const TURN_SPEED_KEEP = 0.85;   // ao virar: mantém esta fração da velocidade atual (curvas seguidas acumulam)
export const VICTORY_MS = 1000;// tempo até congelar e mostrar o painel
export const MAX_ZOOM = 2.1;   // limite de aproximação quando estão pertinho

export const WIN_SCORE = 5;      // melhor de 10: o primeiro a 5 vitórias leva a partida
export const COUNTDOWN_MS = 3000;// contagem 3-2-1 antes de cada round começar

// ---- Modo ARES (easter egg) ----
export const ARES_CHANCE = 0.05; // chance de ARES no singleplayer (multiplayer = /10)
export const ARES_HOLD_MS = 3000;// tempo do título ARES parado na tela
export const ARES_FADE_MS = 2000;// fade-out do título ARES (sobreposto à contagem)
export const ARES_HUE = 0;       // matiz vermelha (grid + programa ARES)
export const ARES_VIOLENCE = 1;   // violência da IA no modo ARES
export const ARES_SPEEDUP = 0.95;    // aceleração do programa ARES (bem mais rápida que SPEEDUP)
export const ARES_SPEED_MULT = 1.1;  // topo de velocidade do ARES = 10% acima do normal (minTick ÷ 1.1)

export const DIRS = {
  up:    { x: 0, y: -1 },
  down:  { x: 0, y: 1 },
  left:  { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
export const OPPOSITE = { up: "down", down: "up", left: "right", right: "left" };

// Trilha sonora em MIDI, sintetizada por osciladores (ver midi-music.js). As faixas
// vêm do manifesto — lista explícita, pois o servidor estático do Nuxt não lista
// diretório. Os efeitos sonoros continuam 100% procedurais (ver sound.js).
export const MIDI_DIR = "midi/";
export const MIDI_MANIFEST = "midi/manifest.json";

export function clamp(value, lo, hi) { return value < lo ? lo : (value > hi ? hi : value); }

// ---- Grade (ocupação por célula: 0 = vazia, 1 = P1, 2 = P2) ----
export function createGrid() { return new Array(COLS * ROWS).fill(0); }
export function idx(col, row) { return row * COLS + col; }
export function inBounds(col, row) { return col >= 0 && col < COLS && row >= 0 && row < ROWS; }
export function isFree(grid, col, row) { return inBounds(col, row) && grid[idx(col, row)] === 0; }
