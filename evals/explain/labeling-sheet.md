# Labelling sheet: 40 explanations

Fill in `human-labels.csv`, one row per number below. For each check enter `P` (pass) or `F` (fail). `NA` is already filled where a check does not apply.
Label from the pair data and the explanation only. Do not look at any judge output first.

| Column | Pass (`P`) when |
|---|---|
| `a` | Every fact in the explanation (names, numbers, dates, causes) is in the pair data. Fail if anything is invented or changed. |
| `b1` | High and Medium pairs only: the explanation never calls the pair uncertain, unclear or unsure, and never suggests it may be legitimate. Fail otherwise. |
| `b2` | Low pairs only: the explanation does not claim certainty that it is a duplicate. Saying it could be legitimate and is worth a quick check is fine. Fail if it speaks as if it is certain. |
| `c` | The conclusion fits the suggested action. "Block the open invoice": plainly the same invoice entered twice (or a repeat of one already paid). "Check with supplier": the duplicate evidence plus a reason the supplier should confirm first. |
| `d` | The explanation does not claim InvoiceGuard blocks, holds, releases or pays anything, or acts in the ERP. |

## #1 · High risk (score 100) · suggested action: Block the open invoice

Rules: Normalized invoice number match; Same gross amount; Invoice dates within 30 days; Posted in two company codes
- A: vendor Vinayak Castings Ltd (V3) · invoice VI9-3489 · date 02/09/2026 · amount ₹1,60,560.29 · company code 1000 · PO 4500012345 · doc 5100000001 · open
- B: vendor Vinayak Castings Ltd (V3) · invoice VI9-3489 · date 03/09/2026 · amount ₹1,60,560.29 · company code 2000 · PO 4500012345 · doc 5100000002 · open

> Vinayak Castings Ltd billed VI9-3489 for ₹1,60,560.29 on 02/09/2026 in company code 1000 and again on 03/09/2026 in company code 2000. This looks like the same invoice entered twice.

## #2 · High risk (score 90) · suggested action: Block the open invoice

Rules: Normalized invoice number match; Same gross amount; Invoice dates within 30 days
- A: vendor Lakshmi Textiles Pvt Ltd (V5) · invoice LT-1190 · date 02/09/2026 · amount ₹2,41,800.00 · company code 1000 · PO 4500012345 · doc 5100000001 · PAID on 18/09/2026
- B: vendor Lakshmi Textiles Pvt Ltd (V5) · invoice LT-1190 · date 11/09/2026 · amount ₹2,41,800.00 · company code 1000 · PO 4500012345 · doc 5100000002 · open

> Lakshmi Textiles Pvt Ltd billed LT-1190 for ₹2,41,800.00 on 02/09/2026; it was already paid on 18/09/2026, and the same number is open again from 11/09/2026 in company code 1000. This looks like a repeat of an invoice already paid.

## #3 · High risk (score 100) · suggested action: Check with supplier

Rules: Normalized invoice number match; Same gross amount; Invoice dates within 30 days; Same supplier under two vendor accounts (AI)
- A: vendor Eastern Gaskets Pvt Ltd (V10) · invoice EG-3345 · date 02/09/2026 · amount ₹84,100.00 · company code 1000 · PO 4500012345 · doc 5100000001 · PAID on 18/09/2026
- B: vendor Eastern Gaskets Private Limited (V11) · invoice EG-3345 · date 12/09/2026 · amount ₹84,100.00 · company code 1000 · PO 4500012345 · doc 5100000002 · open

> Eastern Gaskets Pvt Ltd billed EG-3345 for ₹84,100.00 on 02/09/2026; it was already paid on 18/09/2026, and the same number is open again from 12/09/2026 in company code 1000. This looks like a repeat of an invoice already paid.

## #4 · High risk (score 100) · suggested action: Block the open invoice

Rules: Normalized invoice number match; Same gross amount; Invoice dates within 30 days; Posted in two company codes; One with PO, one without
- A: vendor Rao & Sons Engineering Co (V9) · invoice RS-6601 · date 02/09/2026 · amount ₹1,29,990.50 · company code 1000 · PO 4500012345 · doc 5100000001 · PAID on 18/09/2026
- B: vendor Rao & Sons Engineering Co (V9) · invoice RS-6601 · date 08/09/2026 · amount ₹1,29,990.50 · company code 3000 · PO (none) · doc 5100000002 · open

> Rao & Sons Engineering Co billed RS-6601 for ₹1,29,990.50 on 02/09/2026; it was already paid on 18/09/2026, and the same number is open again from 08/09/2026 in company code 3000. This looks like the same invoice entered twice.

## #5 · Low risk (score 55) · suggested action: Check with supplier

Rules: Invoice number with a typo (swapped or extra character); Amount within 1%; Invoice dates within 30 days
- A: vendor Anand Tools Pvt Ltd (V29) · invoice AT-9120 · date 02/09/2026 · amount ₹1,74,500.00 · company code 1000 · PO 4500012345 · doc 5100000001 · PAID on 18/09/2026
- B: vendor Anand Tools Pvt Ltd (V29) · invoice AT-9102 · date 14/09/2026 · amount ₹1,75,200.00 · company code 1000 · PO (none) · doc 5100000002 · open

> Anand Tools Pvt Ltd billed AT-9120 for ₹1,74,500.00 on 02/09/2026; it was already paid on 18/09/2026, and the same vendor billed AT-9102 for ₹1,75,200.00 on 14/09/2026 in company code 1000. This pair could be legitimate due to a possible typo in the invoice number.

## #6 · Low risk (score 55) · suggested action: Check with supplier

Rules: Invoice number with a typo (swapped or extra character); Amount within 1%; Invoice dates within 30 days
- A: vendor Metro Fasteners Pvt Ltd (V24) · invoice MF-8801 · date 02/09/2026 · amount ₹45,200.00 · company code 1000 · PO 4500012345 · doc 5100000001 · open
- B: vendor Metro Fasteners Pvt Ltd (V24) · invoice MF-8810 · date 05/09/2026 · amount ₹45,350.00 · company code 1000 · PO 4500012345 · doc 5100000002 · open

> Metro Fasteners Pvt Ltd billed MF-8801 for ₹45,200.00 on 02/09/2026 and again with invoice MF-8810 for ₹45,350.00 on 05/09/2026, both in company code 1000. This pair could be legitimate due to a possible typo in the invoice number, so confirm with the supplier before paying.

## #7 · Low risk (score 55) · suggested action: Check with supplier

Rules: Invoice number with a typo (swapped or extra character); Amount within 1%; Invoice dates within 30 days
- A: vendor Universal Springs Ltd (V23) · invoice LT60718 · date 02/09/2026 · amount ₹3,00,000.00 · company code 1000 · PO 4500012345 · doc 5100000001 · open
- B: vendor Universal Springs Ltd (V23) · invoice LT60781 · date 03/09/2026 · amount ₹3,00,900.00 · company code 1000 · PO 4500012345 · doc 5100000002 · open

> Universal Springs Ltd billed LT60718 for ₹3,00,000.00 on 02/09/2026 and LT60781 for ₹3,00,900.00 on 03/09/2026, both in company code 1000. This pair could be legitimate due to a possible typo in the invoice number, so confirm with the supplier before paying.

## #8 · High risk (score 90) · suggested action: Block the open invoice

Rules: Normalized invoice number match; Same gross amount; Invoice dates within 30 days
- A: vendor Kaveri Steel Ltd (V1) · invoice KS-7741 · date 02/09/2026 · amount ₹4,53,210.55 · company code 1000 · PO 4500012345 · doc 5100000001 · open
- B: vendor Kaveri Steel Ltd (V1) · invoice KS-7741 · date 02/09/2026 · amount ₹4,53,210.55 · company code 1000 · PO 4500012345 · doc 5100000002 · open

> Kaveri Steel Ltd billed KS-7741 for ₹4,53,210.55 on 02/09/2026 and again on 02/09/2026. The supplier has already confirmed that the first payment went to a new bank account, so this looks like the same invoice entered twice.

## #9 · Medium risk (score 70) · suggested action: Check with supplier

Rules: Invoice number with a typo (swapped or extra character); Same gross amount; Invoice dates within 30 days
- A: vendor Zenith Packaging Industries Ltd (V13) · invoice LT40417 · date 02/09/2026 · amount ₹55,000.00 · company code 1000 · PO 4500012345 · doc 5100000001 · open
- B: vendor Zenith Packaging Industries Ltd (V13) · invoice LT40471 · date 05/09/2026 · amount ₹55,000.00 · company code 1000 · PO 4500012345 · doc 5100000002 · open

> Zenith Packaging Industries Ltd billed LT40417 for ₹55,000.00 on 02/09/2026 and again with a similar reference LT40471 for ₹55,000.00 on 05/09/2026, both in company code 1000. This looks like a duplicate, so confirm with the supplier before paying.

## #10 · High risk (score 100) · suggested action: Block the open invoice

Rules: Normalized invoice number match; Same gross amount; Invoice dates within 30 days; Posted in two company codes
- A: vendor Pioneer Hydraulics Co (V12) · invoice PH-9007 · date 02/09/2026 · amount ₹12,04,000.00 · company code 1000 · PO 4500020001 · doc 5100000001 · open
- B: vendor Pioneer Hydraulics Co (V12) · invoice PH-9007 · date 03/09/2026 · amount ₹12,04,000.00 · company code 2000 · PO 4500020002 · doc 5100000002 · open

> Pioneer Hydraulics Co billed PH-9007 for ₹12,04,000.00 on 02/09/2026 in company code 1000 and again on 03/09/2026 in company code 2000. This looks like the same invoice entered twice.

## #11 · High risk (score 90) · suggested action: Block the open invoice

Rules: Normalized invoice number match; Same gross amount; Invoice dates within 30 days
- A: vendor Kaveri Steel Ltd (V1) · invoice KS-7741 · date 02/09/2026 · amount ₹4,53,210.55 · company code 1000 · PO 4500012345 · doc 5100000001 · open
- B: vendor Kaveri Steel Ltd (V1) · invoice KS-7741 · date 02/09/2026 · amount ₹4,53,210.55 · company code 1000 · PO 4500012345 · doc 5100000002 · open

> Kaveri Steel Ltd billed KS-7741 for ₹4,53,210.55 on 02/09/2026 in company code 1000, and the same invoice number appears again with a different document number. This looks like the same invoice entered twice.

## #12 · Medium risk (score 75) · suggested action: Block the open invoice

Rules: Normalized invoice number match; Amount within 1%; Invoice dates within 30 days
- A: vendor Bharat Electricals & Co (V19) · invoice BE-5005 · date 02/09/2026 · amount ₹1,50,000.00 · company code 1000 · PO 4500012345 · doc 5100000001 · PAID on 18/09/2026
- B: vendor Bharat Electricals & Co (V19) · invoice BE-5005 · date 10/09/2026 · amount ₹1,50,900.00 · company code 1000 · PO 4500012345 · doc 5100000002 · open

> Bharat Electricals & Co billed BE-5005 for ₹1,50,000.00 on 02/09/2026; it was already paid on 18/09/2026, and the same number is open again from 10/09/2026 in company code 1000 for ₹1,50,900.00. This looks like a repeat of an invoice already paid.

## #13 · Medium risk (score 70) · suggested action: Check with supplier

Rules: Invoice number with a typo (swapped or extra character); Same gross amount; Invoice dates within 30 days
- A: vendor Navkar Chemicals Pvt Ltd (V14) · invoice SF55 · date 02/09/2026 · amount ₹3,18,750.00 · company code 1000 · PO 4500012345 · doc 5100000001 · open
- B: vendor Navkar Chemicals Pvt Ltd (V14) · invoice SF55A · date 04/09/2026 · amount ₹3,18,750.00 · company code 1000 · PO 4500012345 · doc 5100000002 · open

> Navkar Chemicals Pvt Ltd billed SF55 and SF55A for ₹3,18,750.00 on 02/09/2026 and 04/09/2026. These may well be two legitimate bills, so it is hard to say.

## #14 · High risk (score 100) · suggested action: Block the open invoice

Rules: Normalized invoice number match; Same gross amount; Invoice dates within 30 days; One with PO, one without
- A: vendor Meenakshi Packaging Pvt Ltd (V4) · invoice MP-5520 · date 02/09/2026 · amount ₹72,400.00 · company code 1000 · PO 4500012345 · doc 5100000001 · open
- B: vendor Meenakshi Packaging Pvt Ltd (V4) · invoice MP-5520 · date 09/09/2026 · amount ₹72,400.00 · company code 1000 · PO (none) · doc 5100000002 · open

> Meenakshi Packaging Pvt Ltd billed MP-5520 for ₹72,400.00 on 02/09/2026 and again on 09/09/2026, one with a PO and one without. It is unclear whether this is really a duplicate and the match is uncertain.

## #15 · High risk (score 80) · suggested action: Block the open invoice

Rules: Normalized invoice number match; Same gross amount
- A: vendor Deccan Logistics LLP (V8) · invoice DL-0412 · date 02/09/2026 · amount ₹36,900.00 · company code 1000 · PO 4500012345 · doc 5100000001 · open
- B: vendor Deccan Logistics LLP (V8) · invoice DL-0412 · date 17/10/2026 · amount ₹36,900.00 · company code 1000 · PO 4500012345 · doc 5100000002 · open

> Deccan Logistics LLP billed DL-0412 for ₹36,950.00 on 02/09/2026 and again on 17/10/2026. This looks like the same invoice entered twice.

## #16 · Low risk (score 55) · suggested action: Check with supplier

Rules: Invoice number with a typo (swapped or extra character); Amount within 1%; Invoice dates within 30 days
- A: vendor Universal Springs Ltd (V23) · invoice LT60718 · date 02/09/2026 · amount ₹3,00,000.00 · company code 1000 · PO 4500012345 · doc 5100000001 · open
- B: vendor Universal Springs Ltd (V23) · invoice LT60781 · date 03/09/2026 · amount ₹3,00,900.00 · company code 1000 · PO 4500012345 · doc 5100000002 · open

> Universal Springs Ltd billed LT60718 for ₹3,00,000.00 on 02/09/2026 and LT60781 for ₹3,00,900.00 on 03/09/2026. This is definitely a duplicate with no doubt at all.

## #17 · Medium risk (score 70) · suggested action: Check with supplier

Rules: Invoice number with a typo (swapped or extra character); Same gross amount; Invoice dates within 30 days
- A: vendor Mahalakshmi Steel Traders (V17) · invoice MS-4180 · date 02/09/2026 · amount ₹91,200.00 · company code 1000 · PO 4500012345 · doc 5100000001 · PAID on 18/09/2026
- B: vendor Mahalakshmi Steel Traders (V17) · invoice MS-4108 · date 07/09/2026 · amount ₹91,200.00 · company code 1000 · PO 4500012345 · doc 5100000002 · open

> Mahalakshmi Steel Traders billed MS-4180 for ₹91,200.00 on 02/09/2026; it was already paid on 18/09/2026, and the same amount is open again from 07/09/2026 with invoice number MS-4108. This looks like a duplicate, but confirm with the supplier before paying because the invoice number may have a typo.

## #18 · Low risk (score 55) · suggested action: Check with supplier

Rules: Invoice number with a typo (swapped or extra character); Amount within 1%; Invoice dates within 30 days
- A: vendor Sai Enterprises (V32) · invoice SE-3012 · date 02/09/2026 · amount ₹18,800.00 · company code 1000 · PO 4500012345 · doc 5100000001 · open
- B: vendor Sai Enterprises (V32) · invoice SE-3021 · date 02/09/2026 · amount ₹18,890.00 · company code 1000 · PO 4500012345 · doc 5100000002 · open

> Sai Enterprises billed SE-3012 for ₹18,800.00 on 02/09/2026 and SE-3021 for ₹18,890.00 on the same date, both in company code 1000. This pair could be legitimate due to a possible typo in the invoice number, so confirm with the supplier before paying.

## #19 · Low risk (score 55) · suggested action: Check with supplier

Rules: Invoice number with a typo (swapped or extra character); Amount within 1%; Invoice dates within 30 days
- A: vendor Ganga Paper Mills (V28) · invoice GP-2041 · date 02/09/2026 · amount ₹23,500.00 · company code 1000 · PO 4500012345 · doc 5100000001 · open
- B: vendor Ganga Paper Mills (V28) · invoice GP-2014 · date 02/09/2026 · amount ₹23,600.00 · company code 2000 · PO 4500012345 · doc 5100000002 · open

> Ganga Paper Mills billed GP-2041 for ₹23,500.00 on 02/09/2026 in company code 1000 and also billed GP-2014 for ₹23,600.00 on the same date in company code 2000. This pair could be legitimate due to a possible typo in the invoice number, so confirm with them before paying.

## #20 · High risk (score 100) · suggested action: Block the open invoice

Rules: Normalized invoice number match; Same gross amount; Invoice dates within 30 days; One with PO, one without
- A: vendor Meenakshi Packaging Pvt Ltd (V4) · invoice MP-5520 · date 02/09/2026 · amount ₹72,400.00 · company code 1000 · PO 4500012345 · doc 5100000001 · open
- B: vendor Meenakshi Packaging Pvt Ltd (V4) · invoice MP-5520 · date 09/09/2026 · amount ₹72,400.00 · company code 1000 · PO (none) · doc 5100000002 · open

> Meenakshi Packaging Pvt Ltd billed MP-5520 for ₹72,400.00 on 02/09/2026 and again on 09/09/2026, both in company code 1000. This looks like the same invoice entered twice.

## #21 · Medium risk (score 75) · suggested action: Block the open invoice

Rules: Normalized invoice number match; Amount within 1%; Invoice dates within 30 days
- A: vendor Tirupati Wire Products (V15) · invoice TW-2210 · date 02/09/2026 · amount ₹2,00,000.00 · company code 1000 · PO 4500012345 · doc 5100000001 · open
- B: vendor Tirupati Wire Products (V15) · invoice TW-2210 · date 04/09/2026 · amount ₹2,00,800.00 · company code 1000 · PO 4500012345 · doc 5100000002 · open

> Tirupati Wire Products billed TW-2210 for ₹2,00,000.00 on 02/09/2026 and again on 04/09/2026, both in company code 1000. This looks like the same invoice entered twice.

## #22 · High risk (score 90) · suggested action: Block the open invoice

Rules: Normalized invoice number match; Same gross amount; Invoice dates within 30 days
- A: vendor Sundaram Fasteners Pvt Ltd (V2) · invoice INV-2041 · date 02/09/2026 · amount ₹98,250.00 · company code 1000 · PO 4500012345 · doc 5100000001 · open
- B: vendor Sundaram Fasteners Pvt Ltd (V2) · invoice INV2041 · date 04/09/2026 · amount ₹98,250.00 · company code 1000 · PO 4500012345 · doc 5100000002 · open

> Sundaram Fasteners Pvt Ltd billed INV-2041 for ₹98,250.00 on 02/09/2026 and again on 04/09/2026 with the invoice number INV2041, both in company code 1000. This looks like the same invoice entered twice.

## #23 · Low risk (score 55) · suggested action: Check with supplier

Rules: Invoice number with a typo (swapped or extra character); Amount within 1%; Invoice dates within 30 days
- A: vendor Nandi Castings Pvt Ltd (V31) · invoice NC-615 · date 02/09/2026 · amount ₹96,500.00 · company code 1000 · PO 4500012345 · doc 5100000001 · open
- B: vendor Nandi Castings Pvt Ltd (V31) · invoice NC-6150 · date 06/09/2026 · amount ₹96,900.00 · company code 1000 · PO 4500012345 · doc 5100000002 · open

> Nandi Castings Pvt Ltd billed NC-615 for ₹96,500.00 on 02/09/2026 and NC-6150 for ₹96,900.00 on 06/09/2026, both in company code 1000. This could be a legitimate difference, but confirm with the supplier before paying.

## #24 · Medium risk (score 70) · suggested action: Check with supplier

Rules: Invoice number with a typo (swapped or extra character); Same gross amount; Invoice dates within 30 days
- A: vendor Zenith Packaging Industries Ltd (V13) · invoice LT40417 · date 02/09/2026 · amount ₹55,000.00 · company code 1000 · PO 4500012345 · doc 5100000001 · open
- B: vendor Zenith Packaging Industries Ltd (V13) · invoice LT40471 · date 05/09/2026 · amount ₹55,000.00 · company code 1000 · PO 4500012345 · doc 5100000002 · open

> Zenith Packaging Industries Ltd billed LT40417 for ₹55,000.00 on 02/09/2026 and again as LT40471 on 05/09/2026. This looks like the same invoice entered twice.

## #25 · High risk (score 100) · suggested action: Block the open invoice

Rules: Normalized invoice number match; Same gross amount; Invoice dates within 30 days; Posted in two company codes
- A: vendor Vinayak Castings Ltd (V3) · invoice VI9-3489 · date 02/09/2026 · amount ₹1,60,560.29 · company code 1000 · PO 4500012345 · doc 5100000001 · open
- B: vendor Vinayak Castings Ltd (V3) · invoice VI9-3489 · date 03/09/2026 · amount ₹1,60,560.29 · company code 2000 · PO 4500012345 · doc 5100000002 · open

> Vinayak Castings Ltd billed VI9-3489 for ₹1,60,560.29 on 02/09/2026 and again on 03/09/2026, posted in company codes 1000 and 2000. InvoiceGuard has blocked the open invoice in the ERP.

## #26 · Medium risk (score 65) · suggested action: Block the open invoice

Rules: Normalized invoice number match; Amount within 1%
- A: vendor Apex Bearings Ltd (V16) · invoice AB-7712 · date 02/09/2026 · amount ₹4,67,300.00 · company code 1000 · PO 4500012345 · doc 5100000001 · open
- B: vendor Apex Bearings Ltd (V16) · invoice AB-7712 · date 12/10/2026 · amount ₹4,68,100.00 · company code 1000 · PO 4500012345 · doc 5100000002 · open

> Apex Bearings Ltd billed AB-7712 for ₹4,67,300.00 on 02/09/2026 and again on 12/10/2026. InvoiceGuard will hold the next payment run for this supplier until the analyst approves.

## #27 · Low risk (score 55) · suggested action: Check with supplier

Rules: Invoice number with a typo (swapped or extra character); Amount within 1%; Invoice dates within 30 days
- A: vendor Allied Rubber Products (V25) · invoice AR-3300 · date 02/09/2026 · amount ₹1,12,000.00 · company code 1000 · PO 4500012345 · doc 5100000001 · PAID on 18/09/2026
- B: vendor Allied Rubber Products (V25) · invoice AR-33000 · date 09/09/2026 · amount ₹1,12,600.00 · company code 1000 · PO 4500012345 · doc 5100000002 · open

> Allied Rubber Products billed AR-3300 for ₹1,12,000.00 on 02/09/2026; it was already paid on 18/09/2026. The other invoice AR-33000 for ₹1,12,600.00 is open from 09/09/2026. This pair could be legitimate due to a possible typo in the invoice number, so confirm with the supplier before paying.

## #28 · Low risk (score 55) · suggested action: Check with supplier

Rules: Invoice number with a typo (swapped or extra character); Amount within 1%; Invoice dates within 30 days
- A: vendor Vijay Auto Components (V26) · invoice VA-5612 · date 02/09/2026 · amount ₹88,000.00 · company code 1000 · PO 4500012345 · doc 5100000001 · open
- B: vendor Vijay Auto Components (V26) · invoice VA-5621 · date 04/09/2026 · amount ₹88,500.00 · company code 1000 · PO 4500012345 · doc 5100000002 · open

> Vijay Auto Components billed VA-5612 for ₹88,000.00 on 02/09/2026 and VA-5621 for ₹88,500.00 on 04/09/2026, both in company code 1000. This could be a legitimate difference in invoices, but confirm with the supplier before paying.

## #29 · High risk (score 80) · suggested action: Block the open invoice

Rules: Normalized invoice number match; Same gross amount
- A: vendor Deccan Logistics LLP (V8) · invoice DL-0412 · date 02/09/2026 · amount ₹36,900.00 · company code 1000 · PO 4500012345 · doc 5100000001 · open
- B: vendor Deccan Logistics LLP (V8) · invoice DL-0412 · date 17/10/2026 · amount ₹36,900.00 · company code 1000 · PO 4500012345 · doc 5100000002 · open

> Deccan Logistics LLP billed DL-0412 for ₹36,900.00 on 02/09/2026 and again on 17/10/2026, both in company code 1000. This looks like the same invoice entered twice.

## #30 · Low risk (score 55) · suggested action: Check with supplier

Rules: Invoice number with a typo (swapped or extra character); Amount within 1%; Invoice dates within 30 days
- A: vendor Patel Brothers Transport (V30) · invoice PB-4470 · date 02/09/2026 · amount ₹51,000.00 · company code 1000 · PO 4500012345 · doc 5100000001 · open
- B: vendor Patel Brothers Transport (V30) · invoice PB-4407 · date 23/09/2026 · amount ₹51,300.00 · company code 1000 · PO 4500012345 · doc 5100000002 · open

> Patel Brothers Transport billed PB-4470 for ₹51,000.00 on 02/09/2026 and PB-4407 for ₹51,300.00 on 23/09/2026, both in company code 1000. This pair could be legitimate due to a possible typo in the invoice number, so confirm with the supplier before paying.

## #31 · Medium risk (score 70) · suggested action: Check with supplier

Rules: Invoice number with a typo (swapped or extra character); Same gross amount; Invoice dates within 30 days
- A: vendor Shree Ganesh Forgings Works (V18) · invoice INV-4412 · date 02/09/2026 · amount ₹62,000.00 · company code 1000 · PO 4500012345 · doc 5100000001 · open
- B: vendor Shree Ganesh Forgings Works (V18) · invoice INV-412 · date 03/09/2026 · amount ₹62,000.00 · company code 1000 · PO 4500012345 · doc 5100000002 · open

> Shree Ganesh Forgings Works billed INV-4412 for ₹62,000.00 on 02/09/2026 and INV-412 for ₹62,000.00 on 03/09/2026, both in company code 1000. This looks like a duplicate invoice pair, so confirm with the supplier before paying.

## #32 · Medium risk (score 70) · suggested action: Check with supplier

Rules: Invoice number with a typo (swapped or extra character); Same gross amount; Invoice dates within 30 days
- A: vendor Surya Cables Ltd (V22) · invoice AB1234 · date 02/09/2026 · amount ₹78,400.00 · company code 1000 · PO 4500012345 · doc 5100000001 · open
- B: vendor Surya Cables Ltd (V22) · invoice AB1243 · date 06/09/2026 · amount ₹78,400.00 · company code 1000 · PO 4500012345 · doc 5100000002 · open

> Surya Cables Ltd billed AB1234 for ₹78,400.00 on 02/09/2026 and again with a similar reference AB1243 for the same amount on 06/09/2026, both in company code 1000. This looks like a duplicate, so confirm with the supplier before paying.

## #33 · Medium risk (score 75) · suggested action: Block the open invoice

Rules: Normalized invoice number match; Amount within 1%; Invoice dates within 30 days
- A: vendor Gujarat Alloys Ltd (V21) · invoice GA-1020 · date 02/09/2026 · amount ₹3,00,000.00 · company code 1000 · PO 4500012345 · doc 5100000001 · open
- B: vendor Gujarat Alloys Ltd (V21) · invoice GA-1020 · date 06/09/2026 · amount ₹3,02,900.00 · company code 1000 · PO 4500012345 · doc 5100000002 · open

> Gujarat Alloys Ltd billed GA-1020 for ₹3,00,000.00 on 02/09/2026 and again on 06/09/2026 for GA-1020 at ₹3,02,900.00, both in company code 1000. This looks like the same invoice entered twice.

## #34 · High risk (score 100) · suggested action: Check with supplier

Rules: Normalized invoice number match; Same gross amount; Invoice dates within 30 days; Same supplier under two vendor accounts (AI)
- A: vendor Hindustan Valves Pvt Ltd (V6) · invoice HV-8830 · date 02/09/2026 · amount ₹5,15,000.00 · company code 1000 · PO 4500012345 · doc 5100000001 · open
- B: vendor HINDUSTAN VALVES PRIVATE LIMITED (V7) · invoice HV-8830 · date 05/09/2026 · amount ₹5,15,000.00 · company code 1000 · PO 4500012345 · doc 5100000002 · open

> Hindustan Valves Pvt Ltd billed HV-8830 for ₹5,15,000.00 on 02/09/2026, and the same number is open again from 05/09/2026 under HINDUSTAN VALVES PRIVATE LIMITED in company code 1000. This looks like the same invoice entered twice, so confirm with the supplier before paying.

## #35 · Medium risk (score 70) · suggested action: Check with supplier

Rules: Invoice number with a typo (swapped or extra character); Same gross amount; Invoice dates within 30 days
- A: vendor Orion Lubricants Inc (V20) · invoice OL-3318 · date 02/09/2026 · amount ₹27,800.00 · company code 1000 · PO 4500012345 · doc 5100000001 · open
- B: vendor Orion Lubricants Inc (V20) · invoice OL-3381 · date 20/09/2026 · amount ₹27,800.00 · company code 2000 · PO 4500012345 · doc 5100000002 · open

> Orion Lubricants Inc billed OL-3318 for ₹27,800.00 on 02/09/2026 and again with a similar reference OL-3381 on 20/09/2026, posted in company codes 1000 and 2000. This looks like a duplicate, so confirm with them before paying.

## #36 · Medium risk (score 75) · suggested action: Block the open invoice

Rules: Normalized invoice number match; Amount within 1%; Invoice dates within 30 days
- A: vendor Tirupati Wire Products (V15) · invoice TW-2210 · date 02/09/2026 · amount ₹2,00,000.00 · company code 1000 · PO 4500012345 · doc 5100000001 · open
- B: vendor Tirupati Wire Products (V15) · invoice TW-2210 · date 04/09/2026 · amount ₹2,00,800.00 · company code 1000 · PO 4500012345 · doc 5100000002 · open

> Tirupati Wire Products billed TW-2210 for ₹2,00,000.00 on 02/09/2026 and again on 04/09/2026. The second bill carries a revised GST rate, which suggests a re-issued invoice that is likely a repeat.

## #37 · Low risk (score 55) · suggested action: Check with supplier

Rules: Invoice number with a typo (swapped or extra character); Amount within 1%; Invoice dates within 30 days
- A: vendor Delta Valves Pvt Ltd (V27) · invoice DV-7001 · date 02/09/2026 · amount ₹6,40,000.00 · company code 1000 · PO 4500012345 · doc 5100000001 · open
- B: vendor Delta Valves Pvt Ltd (V27) · invoice DV-70010 · date 18/09/2026 · amount ₹6,43,000.00 · company code 1000 · PO 4500012345 · doc 5100000002 · open

> Delta Valves Pvt Ltd billed DV-7001 for ₹6,40,000.00 on 02/09/2026 and again with a possibly typoed number DV-70010 for ₹6,43,000.00 on 18/09/2026, both in company code 1000. This looks like a duplicate, so confirm with the supplier before paying.

## #38 · High risk (score 90) · suggested action: Block the open invoice

Rules: Normalized invoice number match; Same gross amount; Invoice dates within 30 days
- A: vendor Sundaram Fasteners Pvt Ltd (V2) · invoice INV-2041 · date 02/09/2026 · amount ₹98,250.00 · company code 1000 · PO 4500012345 · doc 5100000001 · open
- B: vendor Sundaram Fasteners Pvt Ltd (V2) · invoice INV2041 · date 04/09/2026 · amount ₹98,250.00 · company code 1000 · PO 4500012345 · doc 5100000002 · open

> Sundaram Fasteners Pvt Ltd billed INV-2041 for ₹98,250.00 on 02/09/2026 and again on 04/09/2026. This looks like the same invoice entered twice, so the supplier should be asked to confirm first.

## #39 · Medium risk (score 65) · suggested action: Block the open invoice

Rules: Normalized invoice number match; Amount within 1%
- A: vendor Apex Bearings Ltd (V16) · invoice AB-7712 · date 02/09/2026 · amount ₹4,67,300.00 · company code 1000 · PO 4500012345 · doc 5100000001 · open
- B: vendor Apex Bearings Ltd (V16) · invoice AB-7712 · date 12/10/2026 · amount ₹4,68,100.00 · company code 1000 · PO 4500012345 · doc 5100000002 · open

> Apex Bearings Ltd billed AB-7712 for ₹4,67,300.00 on 02/09/2026 and again on 12/10/2026 for ₹4,68,100.00, both in company code 1000. This looks like the same invoice entered twice.

## #40 · Medium risk (score 70) · suggested action: Check with supplier

Rules: Invoice number with a typo (swapped or extra character); Same gross amount; Invoice dates within 30 days
- A: vendor Navkar Chemicals Pvt Ltd (V14) · invoice SF55 · date 02/09/2026 · amount ₹3,18,750.00 · company code 1000 · PO 4500012345 · doc 5100000001 · open
- B: vendor Navkar Chemicals Pvt Ltd (V14) · invoice SF55A · date 04/09/2026 · amount ₹3,18,750.00 · company code 1000 · PO 4500012345 · doc 5100000002 · open

> Navkar Chemicals Pvt Ltd billed SF55 for ₹3,18,750.00 on 02/09/2026 and again with a similar reference SF55A on 04/09/2026, both in company code 1000. This looks like a duplicate, so confirm with the supplier before paying because the invoice number may have a typo.
