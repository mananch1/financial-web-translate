// Master list of every hard-coded English UI string used across the app.
//
// On a language switch, the entire array is POSTed to translate-api in ONE
// batch. The response becomes a Map<EN, translated> stored in React context;
// components look up strings via the `useT()` hook.
//
// Rules for adding entries:
//   * Keep them short and complete (no fragments stitched at runtime).
//   * Do not interpolate variables here — translate the static template and
//     stitch values after (`${t("Showing X to Y of Z entries")}` won't work).
//   * Brand/proper nouns (NSE, NIFTY, SEBI, RELIANCE) translate to themselves
//     because of the prompt rule, but cheap to include anyway.

export const UI_STRINGS = [
  // --- Top utility bar
  "Font Size",
  "Reset",
  "Contrast",
  "High Contrast",

  // --- Header / nav
  "LOGIN",
  "Login to",
  "You will be redirected to another link to complete the login",
  "Search for company, security, mutual fund, ETF…",
  "MARKET DATA",
  "MARKET INDICES",
  "MARKET TURNOVER",
  "PRODUCTS & SERVICES",
  "RESOURCES",
  "COMPANIES LISTING",
  "INVEST",
  "REGULATIONS",
  "Live Market",
  "Pre-Open Market",
  "After Market",
  "Most Active",
  "Top Gainers / Losers",
  "Broad Indices",
  "Sectoral Indices",
  "Thematic Indices",
  "Strategy Indices",
  "Equity",
  "Derivatives",
  "Currency",
  "Commodity",
  "Mutual Funds",
  "ETF",
  "Reports",
  "Circulars",
  "Bye-Laws & Regulations",
  "Holiday Calendar",
  "Trading Calendar",
  "Corporate Filings",
  "Corporate Information",
  "Initial Public Offerings",
  "Listing on NSE",
  "Annual Reports",
  "Right Issues",
  "Bonds",
  "ETFs",
  "SEBI Regulations",
  "NSE Regulations",
  "Code of Conduct",
  "Member Portal",
  "NEAPS Portal",
  "Investor Service Centre",
  "NSE NMF II",
  "NSE Pathshala",

  // --- Market ticker
  "Streaming",
  "Open",
  "Closed",
  "on",
  "off",
  "Streaming Speed",
  "Slow",
  "Medium",
  "Fast",
  "View All",
  "Futures",
  "USD-INR",
  "Market Capitalization",

  // --- Breadcrumb
  "Home",
  "Companies & Listing",
  "Announcements",

  // --- Tab labels (mirrors TABS in types.ts)
  "Voting Results",
  "SME",
  "Debt",
  "MF",
  "REIT/InvIT",
  "Municipal Bond",
  "SSE",
  "DT Disclosures",

  // --- Filter bar
  "Announcements XBRL",
  "Convert XBRL into Excel",
  "Company",
  "Subject",
  "Type symbol or company",
  "e.g. Board Meeting, Dividend",
  "Debenture Trustee",
  "ISIN",
  "Search By",
  "All",
  "Symbol",
  "Select F&O Securities",
  "Select Date Period",
  "Custom",
  "From",
  "To",
  "GO",

  // --- Table
  "Show",
  "entries",
  "Search:",
  "Download CSV",
  "Loading announcements…",
  "No announcements found for the selected filters.",
  "Company Name",
  "Industry",
  "Details",
  "Broadcast Date/Time",
  "Receipt Date/Time",
  "Difference",
  "Attachment",
  "Previous",
  "Next",
  "Showing entries",
  "of",
  "to",

  // --- Page chrome
  "Last refreshed:",
  "Refresh",
  "Refreshing…",
  "Could not reach NSE. The backend may be warming up — please try again.",

  // --- Page-level nav (between Market and About in our app)
  "Market",
  "About NSE",
  "ABOUT NSE",
  "About NSE Company",

  // --- About page body
  "Our Company",
  "Our Vision",
  "Our Mission",
  "National Stock Exchange of India Limited (NSE) is the leading stock exchange in India and ranks among the largest exchanges in the world by trading volume. Established in 1992 and headquartered in Mumbai, NSE pioneered the introduction of fully electronic, screen-based trading and a dematerialised settlement system in India.",
  "NSE offers a comprehensive range of products and services across the equity, derivatives, debt, currency, and mutual fund segments. The exchange operates one of the most sophisticated electronic trading platforms, with state-of-the-art risk management, clearing, and settlement infrastructure that serves millions of investors every trading day.",
  "Through its flagship index, the NIFTY 50, NSE provides the benchmark for the Indian capital markets and is widely tracked by domestic and international investors. The exchange also runs technology and indices businesses, financial education programmes, and a regulated marketplace for SMEs, debt instruments, REITs, InvITs, and social enterprises.",
  "Continually innovating to meet the evolving needs of the market, NSE remains committed to transparency, investor protection, and the development of a robust, world-class capital market for India.",
  "To be a globally competitive stock exchange that contributes to building a transparent, inclusive, and resilient capital market in India.",
  "To provide a world-class, technology-driven trading platform that promotes fair, transparent, and efficient price discovery, while empowering investors and contributing to nation-building.",

  // --- Footer
  "Quick Links",
  "About Us",
  "Overview",
  "Board of Directors",
  "Awards & Recognitions",
  "Careers",
  "Media Centre",
  "Investor Services",
  "Investor Charter",
  "Investor Grievance",
  "Investor Education",
  "Investor Protection Fund",
  "Trade",
  "Listing",
  "Sovereign Gold Bond",
  "Bye-Laws",
  "Connect",
  "Contact Us",
  "Branch Offices",
  "Help & FAQs",
  "Sitemap",
  "Copyright © National Stock Exchange of India Ltd. All rights reserved. Best viewed in Chrome and 1366 × 768 resolution. Recommended to use latest browser versions.",
  "GIGW Compliant",
] as const;

export type UiString = (typeof UI_STRINGS)[number];

// Language metadata moved to ./languages.ts so middleware can import it
// without dragging UI_STRINGS into the edge bundle. Re-exported here so
// any existing `import { SUPPORTED_LANGUAGES } from "./strings"` keeps working.
export { SUPPORTED_LANGUAGES } from "./languages";
