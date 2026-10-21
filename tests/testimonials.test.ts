import { describe, expect, it } from 'vitest';
import { TESTIMONIALS, filledStars } from '@/lib/testimonials';

describe('testimonials', () => {
  it('fills stars from the rating and clamps out-of-range values', () => {
    expect(filledStars(5)).toBe(5);
    expect(filledStars(4)).toBe(4);
    expect(filledStars(9)).toBe(5);
    expect(filledStars(-1)).toBe(0);
    expect(filledStars(NaN)).toBe(0);
  });

  it('keeps the four testimonials in order', () => {
    expect(TESTIMONIALS.map((t) => t.name)).toEqual(['Hari Prasath', 'Naganandhini Baskaran', 'Dinesh R', 'Patham Priyal']);
  });
});
