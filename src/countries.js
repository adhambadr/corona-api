import i18 from "i18n-iso-countries";
import _ from "lodash";
const countryCodes = {};
_.map(i18.getNames("en"), (name, cc) => (countryCodes[name] = cc));

export const convertCountryName = englishCountry =>
	i18.getName(
		countryCodes[englishCountry] ||
			_.find(
				countryCodes,
				val => _.indexOf(_.toLower(val), _.toLower(englishCountry)) > -1
			),
		"de"
	) || englishCountry;
