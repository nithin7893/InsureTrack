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

/**
 * Standard sub-category catalogue for General insurance. These values are used
 * both as the policy sub-category and, when no product-master entry exists for
 * the selected category, as the policy "product" on the Add/Edit Policy
 * screens.
 */
export const GENERAL_SUB_CATEGORIES: Record<string, string[]> = {
  Engineering: [
    "Contractor's All Risks (CAR)",
    "Erection All Risks (EAR)",
    'Advance Loss of Profits (ALOP) / Delay in Start-Up (DSU)',
    'Machinery Breakdown (MBD)',
    "Contractor's Plant & Machinery (CPM)",
    'Boiler and Pressure Plant (BPP)',
    'Electronic Equipment (EEI)',
    'Machinery Loss of Profits (MLOP) / Business Interruption',
    'Deterioration of Stocks (DOS)',
    'Civil Engineering Completed Risks (CECR)',
  ],
  Fire: [
    'Bharat Griha Raksha',
    'Bharat Sookshma Udyam Suraksha',
    'Bharat Laghu Udyam Suraksha',
    'Standard Fire and Special Perils (SFSP)',
    'Floating Fire Policy',
    'Declaration Policy',
    'Consequential Loss (Fire) / Business Interruption',
    'Reinstatement / Replacement Value Policy',
  ],
  Health: [
    'Individual', 'Floater', 'GMC', 'Personal Accident', 'Travel', 'Topup', 'GPA',
  ],
  Liability: [
    'Public Liability (Act)',
    'Public Liability (Industrial / Non-Industrial)',
    'Product Liability',
    'Directors and Officers (D&O)',
    'Professional Indemnity (PI) / Errors & Omissions (E&O)',
    'Employment Practices Liability (EPLI)',
    'Cyber Liability',
    'Commercial Crime',
    'Commercial General Liability (CGL)',
    'Third-Party (TP) Liability',
  ],
  'Marine Cargo': [
    'Marine Open Policy',
    'Marine Sales Turnover (STOP)',
    'Specific Voyage Policy',
    'Marine Open Cover',
    'Inland Marine / Domestic Transit',
    'Export & Import Cargo',
    'ICC (A) - All Risks',
    'ICC (B) / ICC (C)',
    'ICC (Air)',
    'Marine DSU / Marine ALOP',
  ],
  'Marine Hull': [
    'Hull and Machinery (H&M)',
    'Freight & Disbursement',
    'Protection and Indemnity (P&I) - Restricted',
    'Time Hull Policy',
    'Voyage Hull Policy',
    'Fleet Insurance',
    "Builder's Risk / Ship Repairers Liability",
    'Port Risk Policy',
    'Blue-Water Hull',
    'Brown-Water / Inland Marine Hull',
    'Specialized Vessel',
  ],
  Miscellaneous: [
    'Burglary and Housebreaking',
    'Money in Transit / Money in Safe',
    'Fidelity Guarantee',
    'Plate Glass',
    'Neon Sign / Glow Sign',
    'Baggage',
    'Trade Credit',
    "Banker's Indemnity",
    "Jewellers' Block",
    'Cattle & Livestock',
    'Poultry',
    'Agricultural Pump Set',
    'Weather-Based Crop (Non-PMFBY)',
  ],
  Motor: [
    'Private Cars',
    'Two-Wheelers',
    'Commercial Vehicles - Goods Carrying',
    'Commercial Vehicles - Passenger Carrying',
    'Commercial Vehicles - Miscellaneous Class D',
    'Own Damage (OD)',
    'Comprehensive / Package Policy',
    'Bundled Policy (New Vehicles)',
    'Stand-Alone OD',
    'Pay-As-You-Drive / Telematics',
  ],
};
