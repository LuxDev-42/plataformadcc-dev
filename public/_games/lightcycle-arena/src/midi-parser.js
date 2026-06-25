// Parser de Standard MIDI File (formato 0/1) — sem dependências.
// Lê um ArrayBuffer (.mid) e devolve uma lista de eventos de nota já em SEGUNDOS,
// ordenados no tempo, prontos pra o scheduler do midi-music.js.
//
// Suporta: note on/off (incl. running status), meta de tempo (0x51), divisão em
// ticks-por-semínima (TPQN). Ignora (pula com segurança): SMPTE, sysex, control
// change, pitch-bend, aftertouch, program change e demais metas.

function readVarLen(view, pos) {            // quantidade de tamanho variável (VLQ)
  let value = 0, byte;
  do {
    byte = view.getUint8(pos.i++);
    value = (value << 7) | (byte & 0x7f);
  } while (byte & 0x80);
  return value;
}

function readStr(view, pos, len) {
  let s = "";
  for (let k = 0; k < len; k++) s += String.fromCharCode(view.getUint8(pos.i++));
  return s;
}

export function parseMidi(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  const pos = { i: 0 };

  if (readStr(view, pos, 4) !== "MThd") throw new Error("arquivo não é MIDI (MThd ausente)");
  pos.i += 4;                                       // tamanho do header (6)
  pos.i += 2;                                       // formato (0/1/2) — não precisamos
  const ntracks = view.getUint16(pos.i); pos.i += 2;
  const division = view.getUint16(pos.i); pos.i += 2;
  const tpqn = (division & 0x8000) ? 480 : division; // SMPTE não suportado → assume 480

  // 1) eventos crus em ticks absolutos (todas as faixas juntas)
  const raw = [];                                   // {tick, kind:'on'|'off'|'tempo', ...}
  for (let t = 0; t < ntracks; t++) {
    if (readStr(view, pos, 4) !== "MTrk") break;    // faixa malformada → para
    const len = view.getUint32(pos.i); pos.i += 4;
    const end = pos.i + len;
    let tick = 0, status = 0;
    while (pos.i < end) {
      tick += readVarLen(view, pos);
      let byte = view.getUint8(pos.i);
      if (byte & 0x80) { status = byte; pos.i++; }  // novo status (senão: running status)
      const cmd = status & 0xf0;
      const ch = status & 0x0f;
      if (status === 0xff) {                        // meta-evento
        const type = view.getUint8(pos.i++);
        const mlen = readVarLen(view, pos);
        if (type === 0x51 && mlen === 3) {          // set tempo (µs por semínima)
          const us = (view.getUint8(pos.i) << 16) | (view.getUint8(pos.i + 1) << 8) | view.getUint8(pos.i + 2);
          raw.push({ tick, kind: "tempo", us });
        }
        pos.i += mlen;
        status = 0;                                 // meta limpa o running status
      } else if (status === 0xf0 || status === 0xf7) {  // sysex → pula
        const slen = readVarLen(view, pos);
        pos.i += slen;
        status = 0;
      } else if (cmd === 0x90 || cmd === 0x80) {    // note on / note off
        const note = view.getUint8(pos.i++);
        const vel = view.getUint8(pos.i++);
        if (cmd === 0x90 && vel > 0) raw.push({ tick, kind: "on", note, vel, ch });
        else raw.push({ tick, kind: "off", note, ch });
      } else if (cmd === 0xc0 || cmd === 0xd0) {    // program change / channel pressure → 1 byte
        pos.i += 1;
      } else if (cmd === 0xa0 || cmd === 0xb0 || cmd === 0xe0) {  // aftertouch / CC / pitch-bend → 2 bytes
        pos.i += 2;
      } else {
        break;                                      // status desconhecido → aborta a faixa (evita loop)
      }
    }
    pos.i = end;                                    // realinha no fim da faixa
  }

  // 2) ordena por tick e converte ticks → segundos com o mapa de tempo
  raw.sort((a, b) => a.tick - b.tick);
  const events = [];
  let curTick = 0, curTime = 0, us = 500000;        // 120 BPM por padrão
  for (const e of raw) {
    curTime += (e.tick - curTick) * ((us / 1e6) / tpqn);
    curTick = e.tick;
    if (e.kind === "tempo") us = e.us;
    else events.push({ time: curTime, kind: e.kind, note: e.note, vel: e.vel, ch: e.ch });
  }
  return { events, duration: curTime, tpqn };
}
