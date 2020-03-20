import Corona from "./corona.js";
import axios from "axios";
import _ from "lodash";
import cj from "csvjson";
import fs from "fs";
import { convertCountryName } from "./countries.js";

export default class historicData extends Corona {
	static cache = process.env.HISTORIC_DATA || "./datadumps/history.json";

	static cleanData = () => {
		this.timeline = _.groupBy(this.timelineRawData, "parent");
	};
	static queryHistoricData = async () => {
		const { data } = await axios.get(this.historicDataUrl);
		const json = cj.toObject(data);
		this.timelineRawData = _.map(json, this.convertData);
		this.lastImport = new Date().getTime();
		await this.getData();
		this.cleanData();
	};

	static shouldRefresh = () =>
		!this.timelineRawData ||
		!this.lastImport ||
		new Date().getTime() - this.lastImport > 1000 * 60 * 60 * 5; // 5 hours

	static loadHistory = async () => {
		if (this.shouldRefresh() || !fs.existsSync(this.cache)) {
			await this.queryHistoricData();
			return fs.writeFileSync(
				this.cache,
				JSON.stringify(this.timelineRawData)
			);
		}
		this.timelineRawData = JSON.parse(fs.readFileSync(this.cache));
		this.cleanData();
	};
	static historyQuery = async (country, city) => {
		await this.loadHistory();
		const current = (await this.getCountryCurrent(country)) || {};
		const countryData = this.timeline[country] || [];
		if (!_.size(countryData))
			return {
				federal: [
					..._.sortBy(
						_.filter(
							this.timeline.global,
							_.matches({ label: country })
						),
						"date"
					),
					current
				]
			};
		let result = {};
		const stateData = _.concat(
			countryData,
			_.get(current, "statesData", [])
		);
		if (city)
			result = _.sortBy(
				_.filter(stateData, _.matches({ label: city })),
				"date"
			);
		else
			_.map(_.groupBy(stateData, "label"), (stateData, stateName) => {
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
		result.federal.push(current);
		return result;
	};

	static queryCountry = async (req, res) => {
		const country = convertCountryName(req.query.country);

		const city = req.query.city;
		try {
			res.status(200).json(await this.historyQuery(country, city));
		} catch (e) {
			console.log(e);
			res.status(500).json({ err: e });
		}
	};
}
