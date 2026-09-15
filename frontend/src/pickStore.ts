// Tiny module-level store to return a picked exercise from the picker screen
// back to whatever screen requested it (builder / active workout).
type Picked = { id: string; name: string; primary_muscle?: string };
let resolver: ((ex: Picked) => void) | null = null;

export const pickStore = {
  request(cb: (ex: Picked) => void) { resolver = cb; },
  resolve(ex: Picked) { const r = resolver; resolver = null; r?.(ex); },
  clear() { resolver = null; },
};
