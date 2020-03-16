import axios from "axios";
import _ from "lodash";
import cj from "csvjson";
import fs from "fs";
import { convertCountryName, convertGermanToEnglish } from "./countries.js";
import { findNearest } from "geolib";
import path from "path";

const importInterval = 15 * 60 * 1000; // Responsible querying, only refresh data every 15 minutes since most data worldwide refreshes maximum once an hour hour

const dataDumpLocation =
	process.env.NODE_ENV !== "production"
		? "./datadumps/data.json"
		: path.resolve(__dirname, "./datadumps/data.json");

export default class CoronaData {
	static currentUrl =
		"https://interaktiv.morgenpost.de/corona-virus-karte-infektionen-deutschland-weltweit/data/Coronavirus.current.v2.csv";
	static historicDataUrl =
		"https://interaktiv.morgenpost.de/corona-virus-karte-infektionen-deutschland-weltweit/data/Coronavirus.history.v2.csv?" +
		new Date().getTime();
	static lastImport = 0;

	static data = {};

	static shouldRefresh = () =>
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
		this.data = _.groupBy(this.rawData, "parent");
		return this.data;
	};

	static queryData = async () => {
		const { data } = await axios.get(this.currentUrl);
		const json = cj.toObject(data);
		console.log("querying ", new Date().getTime());
		this.lastImport = new Date().getTime();
		this.rawData = _.map(json, this.convertData);
		this.data = _.groupBy(this.rawData, "parent");
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
			({ lat, lon, parent, label }) =>
				_.eq(lat, point.latitude) && _.eq(lon, point.longitude)
		);
		return result;
	};

	static getCountryCurrent = async country => {
		country = convertCountryName(country);
		const data = await this.getData();
		const globalPoint = _.find(data["global"], ({ label }) =>
			_.eq(country, label)
		);
		if (globalPoint)
			return {
				...globalPoint,
				statesData: []
			};

		const statesData = _.get(data, country, []);
		const result = this.aggregateStateData(statesData);

		return {
			...result,
			statesData
		};
	};

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

	static queryWorld = async (req, res) => {
		await this.getData();
		res.status(200).json(
			_.reduce(
				this.rawData,
				(sum, { confirmed, recovered, deaths }) => ({
					confirmed: (confirmed || 0) + (sum.confirmed || 0),
					recovered: (recovered || 0) + (sum.recovered || 0),
					deaths: (deaths || 0) + (sum.deaths || 0)
				}),
				{}
			)
		);
	};
	static queryLocation = async (req, res) => {
		const result = await this.getClosest({ ...req.body });
		if (!result)
			return res.json({
				err: "Parameters malformed or location not found"
			});
		if (result.parent === "global") return res.json(result);

		const statesData = this.data[result.parent];
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
		res.json(
			_.map(
				[
					..._.keys(this.data),
					..._.uniq(_.map(this.data.global, "label"))
				],
				convertGermanToEnglish
			)
		);
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
