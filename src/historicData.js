import Corona from "./corona.js";
import axios from "axios";
import _ from "lodash";
import cj from "csvjson";
import fs from "fs";

export default class historicData extends Corona {
	static cache = process.env.HISTORIC_DATA || "./datadumps/history.json";

	static cleanData = () => {
		this.data = _.groupBy(this.rawData, "parent");
	};
	static queryData = async () => {
		const { data } = await axios.get(this.historicDataUrl);
		const json = cj.toObject(data);
		this.rawData = _.map(json, this.convertData);
		this.cleanData();
	};

	static loadData = async () => {
		if (this.rawData) return;

		if (!fs.existsSync(this.cache)) {
			await this.queryData();
			return fs.writeFileSync(this.cache, JSON.stringify(this.rawData));
		}
		this.rawData = JSON.parse(fs.readFileSync(this.cache));
		this.cleanData();
	};
	static historyQuery = async (country, city) => {
		await this.loadData();
		const countryData = this.data[country] || [];
		if (!_.size(countryData))
			return {
				federal: _.sortBy(
					_.filter(this.data.global, _.matches({ label: country })),
					"date"
				)
			};
		let result = {};
		if (city)
			result = _.sortBy(
				_.filter(countryData, _.matches({ label: city })),
				"date"
			);
		else
			_.map(_.groupBy(countryData, "label"), (stateData, stateName) => {
				result[stateName] = _.sortBy(stateData, "date");
			});

		const timeSeries = _.groupBy(countryData, "date");

		result.federal = _.map(timeSeries, (data, timestamp) =>
			_.reduce(
				data,
				(sum, { date, confirmed, recovered, deaths }) => ({
					date,
					confirmed: (confirmed || 0) + (sum.confirmed || 0),
					recovered: (recovered || 0) + (sum.recovered || 0),
					deaths: (deaths || 0) + (sum.deaths || 0)
				}),
				{}
			)
		);
		return result;
	};
}
