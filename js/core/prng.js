// PRNG determinista (rápido y suficiente para arte generativo)
export function mulberry32(seed){
  let t = seed >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function rFloat(rng, min, max){
  return rng() * (max - min) + min;
}

export function rInt(rng, min, max){
  return Math.floor(rng() * (max - min + 1)) + min;
}

export function pick(rng, arr){
  return arr[Math.floor(rng() * arr.length)];
}
