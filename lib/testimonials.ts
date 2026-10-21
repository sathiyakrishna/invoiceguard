export type Testimonial = {
  rating: number;
  headline: string;
  quote: string;
  name: string;
  role: string;
};

export const TESTIMONIALS: Testimonial[] = [
  { rating: 5, headline: 'Simple and rich in appearance', quote: "It's an awesome product, simple and rich in appearance.", name: 'Hari Prasath', role: 'Financial Accountant' },
  { rating: 5, headline: 'Clean, intuitive and easy to navigate', quote: 'The app has a clean, intuitive interface and is easy to navigate. The features are well organized, and the invoice processing and risk analysis functions work smoothly. Overall, a well-designed and user-friendly application!', name: 'Naganandhini Baskaran', role: 'QA Lead' },
  { rating: 5, headline: 'Really nice features and UI', quote: "The application's features are really nice, and I like the UI.", name: 'Dinesh R', role: 'Senior Engineer' },
  { rating: 5, headline: 'The problem is clear and valuable', quote: 'Great work on InvoiceGuard 👏 The problem is clear and valuable, the landing page explains it in seconds, and the SAP-style sample data with planted duplicates is very realistic. The simple flow (Upload → Risk queue → Evidence) is easy to follow.', name: 'Patham Priyal', role: 'Sales and Business Management Professional' }
];

/** Whole stars to fill, kept within 0..max. */
export function filledStars(rating: number, max = 5): number {
  return Number.isFinite(rating) ? Math.min(max, Math.max(0, Math.round(rating))) : 0;
}
