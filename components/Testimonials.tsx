import { TESTIMONIALS, filledStars } from '@/lib/testimonials';

const STAR_PATH = 'M10 1.5l2.6 5.6 6.1.7-4.5 4.2 1.2 6.0L10 15l-5.4 3 1.2-6L1.3 7.8l6.1-.7z';

function Stars({ rating }: { rating: number }) {
  const filled = filledStars(rating);
  return (
    <div role="img" aria-label={`Rated ${filled} out of 5`} className="flex gap-1">
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} aria-hidden="true" viewBox="0 0 20 20" className={`h-6 w-6 ${i < filled ? 'fill-[#FACC15]' : 'fill-[#D1D5DB]'}`}>
          <path d={STAR_PATH} />
        </svg>
      ))}
    </div>
  );
}

export default function Testimonials() {
  return (
    <ul className="grid items-stretch gap-6 sm:grid-cols-2 xl:grid-cols-4">
      {TESTIMONIALS.map((t) => (
        <li key={t.name} className="flex flex-col gap-3 rounded-3xl bg-[#F3F4F6] p-6">
          <Stars rating={t.rating} />
          <h3 className="text-xl font-extrabold leading-tight text-[#0B1F4D]">{t.headline}</h3>
          <p className="text-base leading-[1.6] text-ink-700">{t.quote}</p>
          <p className="mt-auto pt-2 text-sm leading-snug text-ink-500">
            <span className="font-semibold">{t.name}</span>
            <br />
            {t.role}
          </p>
        </li>
      ))}
    </ul>
  );
}
