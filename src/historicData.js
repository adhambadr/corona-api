import Corona from "./corona.js";
import axios from "axios";
import _ from "lodash";
import cj from "csvjson";
import fs from "fs";
import path from "path";
export default class historicData extends Corona {
	static cache = process.env.HISTORIC_DATA
		? path.join(process.env.HISTORIC_DATA, "history.json")
		: "./datadumps/history.json";

	static cleanData = () => {
		this.timeline = _.groupBy(this.timelineRawData, this.groupingKey);
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
	static equalPoints(point1, point2) {
		const equ =
			_.eq(_.get(point1, "confirmed"), _.get(point2, "confirmed")) &&
			_.eq(_.get(point1, "deaths"), _.get(point2, "deaths")) &&
			_.eq(_.get(point1, "recovered"), _.get(point2, "recovered"));

		return equ;
	}
	static historyQuery = async (country, city) => {
		await this.loadHistory();

		if (
			!country ||
			["global", "world", "international"].includes(country.toLowerCase())
		) {
			const globalPoints = this.timeline["null"];
			// Other countries are not included
			const total = _.concat(
				globalPoints,
				..._.map(_.keys(this.timeline), key =>
					key === "null" ? [] : this.timeline[key]
				)
			);
			const byKey = _.groupBy(total, "date");
			const today = await this.getWorldNow();
			return {
				federal: _.concat(
					..._.map(byKey, (data, key) =>
						this.reduceDataNumbers(data)
					),
					today
				)
			};
		}

		const current = (await this.getCountryCurrent(country)) || {};
		const countryData = this.timeline[country] || [];
		const globalPoint = _.sortBy(
			_.filter(this.timeline["null"], _.matches({ label_en: country })),
			"date"
		);
		if (!_.size(countryData))
			return {
				federal: _.concat(
					...globalPoint,
					this.equalPoints(current, _.last(globalPoint))
						? []
						: current
				)
			};
		let result = {};
		const stateData = _.concat(
			countryData,
			_.get(current, "statesData", [])
		);
		if (city)
			result = _.sortBy(
				_.filter(stateData, _.matches({ label_en: city })),
				"date"
			);
		else
			_.map(_.groupBy(stateData, "label_en"), (stateData, stateName) => {
				result[stateName] = _.sortBy(stateData, "date");
			});

		const timeSeries = _.groupBy(countryData, "date");

		result.federal = _.size(globalPoint)
			? globalPoint
			: _.map(timeSeries, (data, timestamp) =>
					this.reduceDataNumbers(data)
			  );
		if (
			this.equalPoints(current, _.last(result.federal))
			//this.isFrance(country)
		) {
			result.federal.push(current);
		}
		return result;
	};

	static reduceDataNumbers(data) {
		return _.reduce(
			data,
			(sum, { date, confirmed, recovered, deaths }) => ({
				date,
				confirmed: (confirmed || 0) + (sum.confirmed || 0),
				recovered: (recovered || 0) + (sum.recovered || 0),
				deaths: (deaths || 0) + (sum.deaths || 0)
			}),
			{}
		);
	}

	static queryCountry = async (req, res) => {
		const country = req.query.country;

		const city = req.query.city;
		try {
			res.status(200).json(await this.historyQuery(country, city));
		} catch (e) {
			console.log(e);
			res.status(500).json({ err: e });
		}
	};
}
