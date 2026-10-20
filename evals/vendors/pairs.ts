// 50 labelled vendor-name pairs. Synthetic: invented supplier names. `same` is the ground truth an AP analyst would give:
// the same legal supplier (spelling, suffix, abbreviation, parent/Indian-subsidiary of one brand) or a different company
// that only shares a word. Every pair is meant to look similar enough to reach the AI in production (see findVendorCandidates).
export type VendorPair = { id: number; nameA: string; nameB: string; same: boolean; kind: string };

const same = (nameA: string, nameB: string, kind: string) => ({ nameA, nameB, same: true, kind });
const diff = (nameA: string, nameB: string, kind: string) => ({ nameA, nameB, same: false, kind });

const RAW = [
  // ----- same supplier (22) -----
  same('Kaveri Steel Ltd', 'KAVERI STEEL LIMITED', 'suffix and case'),
  same('Sundaram Fasteners Pvt Ltd', 'Sundaram Fasteners Private Limited', 'suffix'),
  same('M/s Lakshmi Textiles', 'Lakshmi Textiles Pvt Ltd', 'prefix and suffix'),
  same('Meenakshi Packaging Pvt Ltd', 'Meenakshi Packaging', 'suffix dropped'),
  same('Rao & Sons Engineering Co', 'Rao and Sons Engineering Company', 'ampersand and Co'),
  same('Vinayak Castings Ltd.', 'Vinayak Castings Limited', 'punctuation'),
  same('Arvind Polymers India Pvt Ltd', 'Arvind Polymers Ltd', 'Indian subsidiary'),
  same('Northwind Tools GmbH', 'Northwind Tools India Pvt Ltd', 'parent and Indian subsidiary'),
  same('Orion Lubricants Inc', 'Orion Lubricants India Pvt Ltd', 'parent and Indian subsidiary'),
  same('Shree Ganesh Forgings Works', 'Sri Ganesh Forgings Works', 'Shree/Sri'),
  same('Bharat Electricals & Co', 'Bharat Electricals and Company', 'ampersand and Co'),
  same('K. R. Industries', 'KR Industries Ltd', 'initials and suffix'),
  same('Hindustan Valves Pvt. Ltd.', 'HINDUSTAN VALVES PVT LTD', 'punctuation and case'),
  same('Deccan Logistics LLP', 'Deccan Logistics (India) LLP', 'country tag'),
  same('Eastern Gaskets (P) Ltd', 'Eastern Gaskets Private Limited', '(P) abbreviation'),
  same('SRI VENKATESWARA TRADERS', 'Sri Venkateswara Traders Pvt Ltd', 'case and suffix'),
  same('Navkar Chemicals & Allied Ind.', 'Navkar Chemicals and Allied Industries', 'abbreviated Industries'),
  same('Apex Bearings Ltd. (Unit II)', 'Apex Bearings Limited', 'unit tag'),
  same('Tirupati Wire Products', 'Tirupathi Wire Products', 'spelling variant'),
  same('Pioneer Hydraulics Co.', 'Pioneer Hydraulics Company Ltd', 'Co and suffix'),
  same('Mahalakshmi Steel Traders', 'Maha Lakshmi Steel Traders', 'split word'),
  same('Zenith Packaging Industries Ltd', 'Zenith Packaging Inds Ltd', 'abbreviated Industries'),
  // ----- different suppliers (28) -----
  diff('Kaveri Steel Ltd', 'Kaveri Textiles Ltd', 'shared first word'),
  diff('Sundaram Fasteners Pvt Ltd', 'Sundaram Finance Ltd', 'shared first word'),
  diff('Lakshmi Textiles Pvt Ltd', 'Lakshmi Machine Works Ltd', 'shared first word'),
  diff('Meenakshi Packaging Pvt Ltd', 'Meenakshi Printing Pvt Ltd', 'one word differs'),
  diff('Rao & Sons Engineering Co', 'Rao & Sons Enterprises', 'one word differs'),
  diff('Deccan Logistics Ltd', 'Deccan Logistics LLP', 'Ltd vs LLP are different legal entities'),
  diff('Shree Ganesh Forgings Works', 'Shree Ganesh Foundry Works', 'one word differs'),
  diff('Bharat Electricals & Co', 'Bharat Electronics Co', 'electricals vs electronics'),
  diff('Hindustan Valves Pvt Ltd', 'Hindustan Pumps Pvt Ltd', 'product differs'),
  diff('Eastern Gaskets Pvt Ltd', 'Western Gaskets Pvt Ltd', 'direction differs'),
  diff('Apex Bearings Ltd', 'Apex Engineering Ltd', 'shared first word'),
  diff('Tirupati Wire Products', 'Tirumala Wire Products', 'similar place names'),
  diff('Pioneer Hydraulics Co', 'Pioneer Pneumatics Co', 'hydraulics vs pneumatics'),
  diff('Mahalakshmi Steel Traders', 'Mahalakshmi Silk Traders', 'product differs'),
  diff('Zenith Packaging Industries Ltd', 'Zenith Plastics Industries Ltd', 'product differs'),
  diff('Northwind Tools GmbH', 'Northwind Traders GmbH', 'one word differs'),
  diff('Orion Lubricants Inc', 'Orion Logistics Inc', 'one word differs'),
  diff('Patel Brothers Transport', 'Patel Brothers Traders', 'one word differs'),
  diff('Universal Springs Ltd', 'Universal Sprockets Ltd', 'near-identical spelling'),
  diff('Gujarat Alloys Ltd', 'Gujarat Agro Ltd', 'shared first word'),
  diff('Metro Fasteners Pvt Ltd', 'Metro Fabricators Pvt Ltd', 'shared first word'),
  diff('Allied Rubber Products', 'Allied Rubber Chemicals', 'product differs'),
  diff('Vijay Auto Components', 'Vijay Agro Components', 'one word differs'),
  diff('Surya Cables Ltd', 'Surya Ceramics Ltd', 'shared first word'),
  diff('Delta Valves Pvt Ltd', 'Delta Wires Pvt Ltd', 'shared first word'),
  diff('Ganga Paper Mills', 'Ganga Paper Traders', 'maker vs trader'),
  diff('Anand Tools Pvt Ltd', 'Anand Tubes Pvt Ltd', 'one word differs'),
  diff('Shree Balaji Textiles', 'Shree Balaji Traders', 'one word differs')
];

// A fixed shuffle so every batch mixes same and different pairs, as production batches do, and runs are repeatable.
function shuffled<T>(items: T[], seed: number): T[] {
  const out = [...items];
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) % 4294967296;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const PAIRS: VendorPair[] = shuffled(RAW, 20260101).map((p, id) => ({ id, ...p }));
export const BATCH_SIZE = 20; // production sends at most 20 pairs per call (findVendorCandidates default)
export const BATCHES: VendorPair[][] = Array.from({ length: Math.ceil(PAIRS.length / BATCH_SIZE) }, (_, i) => PAIRS.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE));
