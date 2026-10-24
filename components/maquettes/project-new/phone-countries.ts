import { getCountries, getCountryCallingCode } from "libphonenumber-js/max";

// Same list as the real creation form (createProjectForm).
const countryNames = new Intl.DisplayNames(["fr"], { type: "region" });

export const PHONE_COUNTRIES = getCountries()
  .map((code) => ({
    code,
    name: countryNames.of(code) ?? code,
    callingCode: getCountryCallingCode(code),
  }))
  .sort((a, b) => a.name.localeCompare(b.name, "fr"));
