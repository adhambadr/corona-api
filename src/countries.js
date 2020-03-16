import i18 from "i18n-iso-countries";
import _ from "lodash";

const alphaCodes = i18.getNames("de");
const alphaCodes_en = i18.getNames("en");
const englishCountries = _.invert(alphaCodes_en);
const germanCountries = _.invert(alphaCodes);

export const convertCountryName = country =>
	germanCountries[country]
		? country
		: i18.getName(
				englishCountries[country] ||
					_.find(englishCountries, (val, key) =>
						compareCountries(key, country)
					),
				"de"
		  ) || country;

const compareCountries = (val = "", country = "") =>
	val.toLowerCase().indexOf(country.toLowerCase()) > -1;

export const convertGermanToEnglish = germanName =>
	alphaCodes_en[germanCountries[germanName]] || germanName;
