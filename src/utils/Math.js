export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const lerp = (start, end, t) => start + (end - start) * t;

export const normalize = (value, min, max) => {
  if (max - min === 0) return 0;
  return (value - min) / (max - min);
};
