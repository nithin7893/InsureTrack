"""Standard General-insurance sub-category catalogue.

Keep in sync with ``GENERAL_SUB_CATEGORIES`` in
``frontend/src/constants/insurance.ts``. General policies use these values as
their "product" when no Product Master entry exists for the selected category,
so riders may be scoped to them as well as to real product names.
"""

GENERAL_SUB_CATEGORIES = {
    'Engineering': [
        "Contractor's All Risks (CAR)",
        'Erection All Risks (EAR)',
        'Advance Loss of Profits (ALOP) / Delay in Start-Up (DSU)',
        'Machinery Breakdown (MBD)',
        "Contractor's Plant & Machinery (CPM)",
        'Boiler and Pressure Plant (BPP)',
        'Electronic Equipment (EEI)',
        'Machinery Loss of Profits (MLOP) / Business Interruption',
        'Deterioration of Stocks (DOS)',
        'Civil Engineering Completed Risks (CECR)',
    ],
    'Fire': [
        'Bharat Griha Raksha',
        'Bharat Sookshma Udyam Suraksha',
        'Bharat Laghu Udyam Suraksha',
        'Standard Fire and Special Perils (SFSP)',
        'Floating Fire Policy',
        'Declaration Policy',
        'Consequential Loss (Fire) / Business Interruption',
        'Reinstatement / Replacement Value Policy',
    ],
    'Health': [
        'Individual', 'Floater', 'GMC', 'Personal Accident', 'Travel',
        'Topup', 'GPA',
    ],
    'Liability': [
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
    'Miscellaneous': [
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
    'Motor': [
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
}

GENERAL_SUB_CATEGORY_NAMES = frozenset(
    name
    for names in GENERAL_SUB_CATEGORIES.values()
    for name in names
)
