// Writes tests/fixtures/tones.wav: 40 s stereo, a 3.2 s tone then 0.8 s silence every 4 s,
// pitch rising a whole step each block. Gives the tests predictable "phrases" at 4 s boundaries.
import { mkdirSync, writeFileSync } from "node:fs";
const sr = 44100, dur = 40, ch = 2, n = sr * dur;
const data = Buffer.alloc(n * ch * 2);
for (let i = 0; i < n; i++) {
  const t = i / sr, block = Math.floor(t / 4), on = (t % 4) < 3.2;
  const v = on ? 0.6 * Math.sin(2 * Math.PI * (330 + 110 * block) * t) : 0;
  const s = Math.max(-32768, Math.min(32767, Math.round(v * 32767)));
  for (let c = 0; c < ch; c++) data.writeInt16LE(s, (i * ch + c) * 2);
}
const h = Buffer.alloc(44);
h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVE", 8);
h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(ch, 22);
h.writeUInt32LE(sr, 24); h.writeUInt32LE(sr * ch * 2, 28); h.writeUInt16LE(ch * 2, 32); h.writeUInt16LE(16, 34);
h.write("data", 36); h.writeUInt32LE(data.length, 40);
mkdirSync("tests/fixtures", { recursive: true });
writeFileSync("tests/fixtures/tones.wav", Buffer.concat([h, data]));
console.log("wrote tests/fixtures/tones.wav");
