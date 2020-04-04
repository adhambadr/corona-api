import axios from "axios";
import _ from "lodash";
import cj from "csvtojson";
import fs from "fs";
import { findNearest } from "geolib";
import path from "path";

const importInterval = 15 * 60 * 1000; // Responsible querying, only refresh data every 15 minutes since most data worldwide refreshes maximum once an hour hour

const dataDumpLocation =
	process.env.NODE_ENV !== "production"
		? "./datadumps/data.json"
		: path.resolve(__dirname, "./datadumps/data.json");

export default class CoronaData {
	static currentUrl = "https://funkeinteraktiv.b-cdn.net/current.v4.csv";
	static historicDataUrl =
		"https://funkeinteraktiv.b-cdn.net/history.v4.csv" +
		new Date().getTime();
	static lastImport = 0;

	static groupingKey = "label_parent_en";

	static data = {};

	static shouldRefresh = () =>
		process.env.NODE_ENV !== "production" ||
		!this.lastImport ||
		new Date().getTime() - this.lastImport >= importInterval;

	static getData = async () => {
		//if (process.env.NODE_ENV !== "production") return this.loadLocalData();
		if (!this.data || this.shouldRefresh()) return this.queryData();
		return this.data;
	};

	static loadLocalData = async () => {
		if (!fs.existsSync(dataDumpLocation)) {
			await this.queryData();
			fs.writeFileSync(dataDumpLocation, JSON.stringify(this.rawData));
			return this.data;
		}
		this.rawData = JSON.parse(fs.readFileSync(dataDumpLocation));
		this.data = _.groupBy(this.rawData, this.groupingKey);
		return this.data;
	};

	static queryData = async () => {
		const { data } = await axios.get(this.currentUrl);
		const json = await cj({ output: "json" }).fromString(data);

		console.log("querying ", new Date().getTime());
		this.lastImport = new Date().getTime();
		this.rawData = _.map(json, this.convertData);
		this.data = _.groupBy(this.rawData, this.groupingKey);
		return this.data;
	};

	static getClosest = async (params = {}) => {
		await this.getData();
		let minDistance = 0;
		const point = findNearest(
			params,
			_.map(
				_.filter(this.rawData, ({ lat, lon }) => lat && lon),
				({ lat, lon }) => ({
					latitude: lat,
					longitude: lon
				})
			)
		);
		if (!point) return;
		const result = _.find(
			this.rawData,
			({ lat, lon, label }) =>
				_.eq(lat, point.latitude) && _.eq(lon, point.longitude)
		);
		return result;
	};

	static getCountryCurrent = async country => {
		const data = await this.getData();
		let globalPoint = _.find(data["null"], ({ label_en }) =>
			_.eq(country, label_en)
		);

		const statesData = _.get(data, country, []);
		const result = this.aggregateStateData(statesData);

		return {
			...result,
			statesData,
			...globalPoint
		};
	};

	static isFrance = country =>
		!["france", "frankreich"].includes(country.toLowerCase());

	static aggregateStateData = statesData => {
		const keys = ["confirmed", "recovered", "deaths"];
		const result = {};
		_.map(statesData, data =>
			_.map(keys, key => {
				result[key] = data[key] + (result[key] || 0);
			})
		);
		return result;
	};

	static queryCountry = async (req, res) => {
		const country = req.query.country || req.body.country;
		try {
			res.status(200).json(await this.getCountryCurrent(country));
		} catch (e) {
			console.log(e);
			res.status(500).json({ err: e });
		}
	};

	static getWorldNow = () =>
		_.reduce(
			_.filter(this.rawData, ({ parent }) => _.eq(parent, "null")),
			(sum, { confirmed, recovered, deaths }) => ({
				confirmed: (confirmed || 0) + (sum.confirmed || 0),
				recovered: (recovered || 0) + (sum.recovered || 0),
				deaths: (deaths || 0) + (sum.deaths || 0)
			}),
			{}
		);

	static queryWorld = async (req, res) => {
		await this.getData();
		res.status(200).json(this.getWorldNow());
	};
	static queryLocation = async (req, res) => {
		const result = await this.getClosest({ ...req.body });
		if (!result)
			return res.json({
				err: "Parameters malformed or location not found"
			});
		if (result[this.groupingKey] === "null") return res.json(result);

		const statesData = this.data[result[this.groupingKey]];
		const countryData = this.aggregateStateData(statesData);
		res.json({
			...result,
			countryData: {
				...countryData,
				statesData
			}
		});
	};
	static getAllCountries = async (req, res) => {
		await this.getData();
		res.json([
			"World",
			..._.uniq(
				_.map([
					..._.keys(this.data),
					..._.uniq(_.map(this.data["null"], "label_en"))
				])
			)
		]);
	};

	static convertData = obj => ({
		...obj,
		lat: Number(obj.lat),
		lon: Number(obj.lon),
		updated: Number(obj.updated),
		confirmed: Number(obj.confirmed),
		recovered: Number(obj.recovered),
		deaths: Number(obj.deaths),
		date: new Date(obj.date)
	});
}
