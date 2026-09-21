// Map a country name (as returned by the AI nationality lookup) to a flag emoji.
// Flag emoji are two regional-indicator letters made from the ISO 3166-1 alpha-2
// code, so we only need a name -> code table plus a few common aliases.

const NAME_TO_CODE: Record<string, string> = {
  "afghanistan": "AF", "albania": "AL", "algeria": "DZ", "argentina": "AR",
  "armenia": "AM", "australia": "AU", "austria": "AT", "azerbaijan": "AZ",
  "bangladesh": "BD", "belarus": "BY", "belgium": "BE", "bolivia": "BO",
  "bosnia and herzegovina": "BA", "brazil": "BR", "bulgaria": "BG",
  "cambodia": "KH", "cameroon": "CM", "canada": "CA", "chile": "CL",
  "china": "CN", "colombia": "CO", "croatia": "HR", "cuba": "CU",
  "cyprus": "CY", "czech republic": "CZ", "czechia": "CZ", "denmark": "DK",
  "dominican republic": "DO", "ecuador": "EC", "egypt": "EG", "estonia": "EE",
  "ethiopia": "ET", "finland": "FI", "france": "FR", "georgia": "GE",
  "germany": "DE", "ghana": "GH", "greece": "GR", "guatemala": "GT",
  "haiti": "HT", "hungary": "HU", "iceland": "IS", "india": "IN",
  "indonesia": "ID", "iran": "IR", "iraq": "IQ", "ireland": "IE",
  "israel": "IL", "italy": "IT", "ivory coast": "CI", "jamaica": "JM",
  "japan": "JP", "jordan": "JO", "kazakhstan": "KZ", "kenya": "KE",
  "kuwait": "KW", "latvia": "LV", "lebanon": "LB", "libya": "LY",
  "lithuania": "LT", "luxembourg": "LU", "malaysia": "MY", "mali": "ML",
  "malta": "MT", "mexico": "MX", "moldova": "MD", "mongolia": "MN",
  "morocco": "MA", "mozambique": "MZ", "myanmar": "MM", "nepal": "NP",
  "netherlands": "NL", "the netherlands": "NL", "new zealand": "NZ",
  "nicaragua": "NI", "nigeria": "NG", "north korea": "KP", "norway": "NO",
  "pakistan": "PK", "palestine": "PS", "panama": "PA", "paraguay": "PY",
  "peru": "PE", "philippines": "PH", "the philippines": "PH", "poland": "PL",
  "portugal": "PT", "qatar": "QA", "romania": "RO", "russia": "RU",
  "saudi arabia": "SA", "senegal": "SN", "serbia": "RS", "singapore": "SG",
  "slovakia": "SK", "slovenia": "SI", "somalia": "SO", "south africa": "ZA",
  "south korea": "KR", "korea": "KR", "spain": "ES", "sri lanka": "LK",
  "sudan": "SD", "sweden": "SE", "switzerland": "CH", "syria": "SY",
  "taiwan": "TW", "tanzania": "TZ", "thailand": "TH", "trinidad and tobago": "TT",
  "tunisia": "TN", "turkey": "TR", "türkiye": "TR", "uganda": "UG",
  "ukraine": "UA", "united arab emirates": "AE", "uae": "AE",
  "united kingdom": "GB", "uk": "GB", "great britain": "GB", "britain": "GB",
  "england": "GB", "scotland": "GB", "wales": "GB", "northern ireland": "GB",
  "united states": "US", "united states of america": "US", "usa": "US",
  "america": "US", "uruguay": "UY", "uzbekistan": "UZ", "venezuela": "VE",
  "vietnam": "VN", "yemen": "YE", "zambia": "ZM", "zimbabwe": "ZW",
};

export function countryFlag(name: string | null | undefined): string {
  if (!name) return "";
  const code = NAME_TO_CODE[name.trim().toLowerCase()];
  if (!code) return "";
  return String.fromCodePoint(
    ...code.split("").map((c) => 0x1f1e6 + (c.charCodeAt(0) - 65))
  );
}
