export const INSURANCE_TYPES = ['Life', 'Health', 'General'] as const;

/**
 * Product categories available inside each insurance type. These must stay in
 * sync with the "Product Category" choices on the Add/Edit Policy screens.
 */
export const PRODUCT_CATEGORIES: Record<string, string[]> = {
  Life: [
    'Term Plan',
    'Return of Premium',
    'Annuity',
    'Savings',
    'ULIP',
    'Pension',
    'Group Term Life Insurance(GTLI)',
  ],
  Health: ['Personal Health', 'GMC', 'Travel', 'Personal Accident', 'Topup', 'GPA'],
  General: [
    'Engineering',
    'Fire',
    'Health',
    'Liability',
    'Marine Cargo',
    'Marine Hull',
    'Miscellaneous',
    'Motor',
  ],
};
