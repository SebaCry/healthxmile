// Clinic data. Anything still in [brackets] is waiting on the client —
// fill it here once and every page picks it up.
export const clinic = {
  name: "Healthy Xmile",
  tagline: "A reason to smile!",
  domain: "https://healthyxmile.com",
  phone: "[Phone number]",
  whatsapp: "[WhatsApp number]",
  email: "[email address]",
  street: "[Street address]",
  city: "Miami",
  region: "FL",
  zip: "[ZIP]",
  hours: [
    ["Monday to Friday", "[hours]"],
    ["Saturday", "[hours]"],
    ["Sunday", "Closed"],
  ],
  dentist: "Dr. [Name]",
  smiles: "[N]",
  instagram: "",
  facebook: "",
};

// Home page before/after slider. Real patient photos only, same framing, in public/img.
// The section stays hidden while "before" is in brackets.
export const beforeAfter = {
  before: "[/img/before.webp]",
  after: "/img/hero-smile.webp",
};

export const testimonials = [
  { quote: "[Patient quote]", name: "[First name]", treatment: "Porcelain, 8 teeth" },
  { quote: "[Patient quote]", name: "[First name]", treatment: "Composite, 6 teeth" },
  { quote: "[Patient quote]", name: "[First name]", treatment: "Porcelain, 10 teeth" },
  { quote: "[Patient quote]", name: "[First name]", treatment: "Composite, 4 teeth" },
  { quote: "[Patient quote]", name: "[First name]", treatment: "Porcelain, 6 teeth" },
  { quote: "[Patient quote]", name: "[First name]", treatment: "Composite, 8 teeth" },
];

export const price = {
  compositeTooth: "$[X]",
  porcelainTooth: "$[X]",
  compositeCase: "$[X]",
  porcelainCase: "$[X]",
  consultation: "$[X]",
  monthly: "$[X]",
  lender: "[CareCredit / Cherry / Sunbit]",
};

// Appointment form. Paste a Formspree / Web3Forms endpoint here and the form
// on /contact replaces the call-and-WhatsApp block.
export const form = {
  endpoint: "",
};

// A value is still a placeholder while it carries brackets.
export const pending = (value: string) => value.includes("[");

export const nav = [
  ["/porcelain-veneers-miami", "Porcelain veneers"],
  ["/composite-veneers-miami", "Composite veneers"],
  ["/smile-design", "Smile design"],
  ["/veneers-cost-miami", "Pricing"],
  ["/contact", "Contact"],
];
