/**
 * Medical Specialty Categories Data
 *
 * Defines the hierarchical structure of medical specialties for Victoria, BC.
 * This data will be seeded into the Convex database.
 */

export interface CategoryDefinition {
  name: string;
  slug: string;
  subcategories?: string[];
}

export const MEDICAL_CATEGORIES: CategoryDefinition[] = [
  {
    name: "Anesthesiology / Perioperative Medicine & Pain Medicine",
    slug: "anesthesiology-perioperative-medicine",
    subcategories: [
      "Anesthesiology for surgery",
      "Pain medicine",
      "Perioperative care (pre-/post-surgery)",
    ],
  },
  {
    name: "Critical Care / Intensive Care / ICU",
    slug: "critical-care-intensive-care-icu",
    subcategories: [
      "Care of critically ill patients",
      "Trauma cases",
      "ICU-level support",
    ],
  },
  {
    name: "Emergency Medicine",
    slug: "emergency-medicine",
    subcategories: [
      "Emergency Department care",
      "Acute care and trauma management",
    ],
  },
  {
    name: "General Internal Medicine (Internal Medicine / Hospitalist Medicine / General Medicine)",
    slug: "general-internal-medicine",
    subcategories: [
      "Management of adult medical illnesses",
      "Inpatient consults and general care",
    ],
  },
  {
    name: "Cardiology / Heart / Vascular Medicine & Cardiac Surgery",
    slug: "cardiology-heart-vascular-medicine",
    subcategories: [
      "Heart disease management",
      "Arrhythmia, coronary disease",
      "Vascular medicine and surgery",
      "Cardiac surgery / thoracic-cardiac surgery",
    ],
  },
  {
    name: "Nephrology (Kidney / Renal Medicine)",
    slug: "nephrology-kidney-renal-medicine",
    subcategories: [
      "Chronic kidney disease management",
      "Dialysis programs",
      "Renal inpatient and outpatient care",
    ],
  },
  {
    name: "Endocrinology & Metabolism",
    slug: "endocrinology-metabolism",
    subcategories: [
      "Hormonal disorders",
      "Diabetes and thyroid management",
      "Metabolic disorder care",
    ],
  },
  {
    name: "Gastroenterology / Digestive Medicine",
    slug: "gastroenterology-digestive-medicine",
    subcategories: [
      "Gastrointestinal disorders",
      "Liver care",
      "Endoscopy services",
    ],
  },
  {
    name: "Respiratory Medicine / Pulmonary / Lung Health",
    slug: "respiratory-medicine-pulmonary-lung-health",
    subcategories: [
      "Lung diseases",
      "Chronic respiratory illness",
      "Sleep apnea clinics",
    ],
  },
  {
    name: "Infectious Diseases / Clinical Immunology & Allergy / Microbiology",
    slug: "infectious-diseases-clinical-immunology-allergy",
    subcategories: [
      "Infectious disease diagnosis and treatment",
      "Immunology and allergy management",
    ],
  },
  {
    name: "Hematology & Medical Oncology (Cancer Care / Blood Diseases)",
    slug: "hematology-medical-oncology-cancer-care",
    subcategories: [
      "Cancer treatment",
      "Blood disorder management",
      "Tumor care",
    ],
  },
  {
    name: "Geriatric Medicine / Seniors' Health",
    slug: "geriatric-medicine-seniors-health",
    subcategories: [
      "Chronic disease management in elderly",
      "Age-related care",
    ],
  },
  {
    name: "Pediatrics",
    slug: "pediatrics",
    subcategories: [
      "Child and adolescent medicine",
      "Neonatal and perinatal care",
      "Pediatric outpatient and inpatient services",
    ],
  },
  {
    name: "Obstetrics & Gynecology / Maternity / Midwifery / Maternal-Fetal Medicine",
    slug: "obstetrics-gynecology-maternity-midwifery",
    subcategories: [
      "Pregnancy care and deliveries",
      "Women's health services",
      "Maternal-fetal medicine",
      "Midwifery services",
    ],
  },
  {
    name: "Psychiatry / Mental Health & Addiction Medicine / Substance-Use Services",
    slug: "psychiatry-mental-health-addiction-medicine",
    subcategories: [
      "Adult, child, and adolescent psychiatry",
      "Geriatric psychiatry",
      "Addiction medicine and mental health services",
    ],
  },
  {
    name: "Radiology / Imaging Medicine / Nuclear Medicine / Diagnostic Imaging / Medical Genetics & Laboratory Medicine / Pathology",
    slug: "radiology-imaging-medicine-nuclear-medicine",
    subcategories: [
      "Imaging (x-ray, CT, MRI, ultrasound)",
      "Nuclear medicine",
      "Lab diagnostics and pathology",
      "Genetic testing services",
    ],
  },
  {
    name: "Surgery — Various Surgical Specialties",
    slug: "surgery-various-surgical-specialties",
    subcategories: [
      "General Surgery",
      "Orthopedic Surgery",
      "Neurosurgery",
      "Cardiac / Cardio-thoracic / Vascular Surgery",
      "Plastic & Reconstructive Surgery",
      "Urology",
      "Otolaryngology / ENT",
      "Ophthalmology / Eye Surgery",
      "Oral & Maxillofacial Surgery / Dental-surgical",
      "Thoracic Surgery",
      "Vascular Surgery",
    ],
  },
  {
    name: "Rehabilitation / Physical Medicine / Pain Management / Wound & Burn Care / Long-term / Post-Acute Care",
    slug: "rehabilitation-physical-medicine-pain-management",
    subcategories: [
      "Burn unit and complex wound care",
      "Orthopedic rehabilitation",
      "Physical therapy",
      "Pain clinic / management",
      "Long-term / chronic care",
      "Rehabilitation & restorative care",
    ],
  },
  {
    name: "Palliative Care / End-of-Life Care & Hospice / Supportive Care",
    slug: "palliative-care-end-of-life-care-hospice",
    subcategories: [
      "End-of-life care",
      "Palliative care",
      "Hospice and supportive services",
    ],
  },
  {
    name: "Multidisciplinary & Outpatient-Clinic Based Services",
    slug: "multidisciplinary-outpatient-clinic-services",
    subcategories: [
      "Outpatient specialty clinics (wound, burn, pain, rehab, dialysis, chronic disease)",
      "Home IV therapy",
      "Transplant and specialty follow-up clinics",
    ],
  },
];

/**
 * Generate a slug from a category or subcategory name
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "") // Remove special characters
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single
    .trim();
}

