import i18 from "i18n-iso-countries";
import _ from "lodash";

const englishCountries = _.invert(i18.getNames("en"));
const germanCountries = _.invert(i18.getNames("de"));

const alphaCodes = i18.getNames("de");

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
