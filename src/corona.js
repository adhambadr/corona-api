import axios from "axios";
import _ from "lodash";
import cj from "csvjson";
import fs from "fs";
import i18 from "i18n-iso-countries";
import { findNearest } from "geolib";

const importInterval = 15 * 60 * 1000; // Responsible querying, only refresh data every 15 minutes since most data worldwide refreshes maximum once an hour hour

const countryCodes = {};
_.map(i18.getNames("en"), (name, cc) => (countryCodes[name] = cc));
const convertCountryName = englishCountry =>
	i18.getName(
		countryCodes[englishCountry] ||
			_.find(
				countryCodes,
				val => _.indexOf(_.toLower(val), _.toLower(englishCountry)) > -1
			),
		"de"
	) || englishCountry;

const dataDumpLocation = "./datadumps/data.json";

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
		if (process.env.NODE_ENV !== "production") return this.loadLocalData();
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
		this.rawData = _.map(json, convertData);
		this.data = _.groupBy(this.rawData, "parent");
		return this.data;
	};

	static queryLocation = async (params = {}) => {
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
		const keys = ["confirmed", "recovered", "deaths"];
		const result = {};
		const statesData = _.get(data, country, []);
		_.map(statesData, data =>
			_.map(keys, key => {
				result[key] = data[key] + (result[key] || 0);
			})
		);
		return {
			...result,
			statesData
		};
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
}

const convertData = obj => ({
	...obj,
	lat: Number(obj.lat),
	lon: Number(obj.lon),
	updated: Number(obj.updated),
	confirmed: Number(obj.confirmed),
	recovered: Number(obj.recovered),
	deaths: Number(obj.deaths),
	date: new Date(obj.date)
});
