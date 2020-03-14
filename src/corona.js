import axios from "axios";
import _ from "lodash";
import cj from "csvjson";
import fs from "fs";
const importInterval = 15 * 60 * 1000;

export default class CoronaData {
	static currentUrl =
		"https://interaktiv.morgenpost.de/corona-virus-karte-infektionen-deutschland-weltweit/data/Coronavirus.current.v2.csv";
	static historicData =
		"https://interaktiv.morgenpost.de/corona-virus-karte-infektionen-deutschland-weltweit/data/Coronavirus.history.v2.csv";
	static lastImport = 0;

	static data = {};

	static shouldRefresh = () =>
		!this.lastImport ||
		new Date().getTime() - this.lastImport >= importInterval;

	static getData = async () => {
		if (!this.data || this.shouldRefresh()) return this.queryData();
		return this.data;
	};

	static queryData = async () => {
		const { data } = await axios.get(this.currentUrl);
		const json = cj.toObject(data);
		fs.writeFileSync(
			`data-${new Date().getTime()}.json`,
			JSON.stringify(json)
		);
		this.data = _.groupBy(json, "parent");
		return this.data;
	};

	static getCountryCurrent = async country => {
		console.log(country);
		const data = await this.getData();
		const globalPoint = _.find(
			data["global"],
			({ label }) => _.indexOf(country, label) > -1
		);
		if (globalPoint)
			return {
				...result,
				statesData: []
			};
		const result = {
			confirmed: 0,
			recovered: 0,
			deaths: 0
		};
		const statesData = _.get(data, country, []);
		_.map(statesData, ({ confirmed, deaths, recovered }) => {
			result.confirmed += parseInt(confirmed);
			result.deaths += parseInt(deaths);
			result.recovered += parseInt(recovered);
		});
		return {
			...result,
			statesData
		};
	};
}
