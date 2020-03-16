import "@babel/polyfill";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import history from "./historicData.js";
import corona from "./corona.js";

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.set("port", process.env.PORT || 2019);

app.get("/status", (req, res) => {
	res.status(200).json({ status: 1 });
});

app.post("/current", corona.queryCountry);
app.get("/current", corona.queryCountry);

app.get("/", corona.queryWorld);
app.post("/current/location", corona.queryLocation);

app.get("/historic", history.queryCountry);

app.get("/countries", corona.getAllCountries);

const server = app.listen(app.get("port"), () => {
	console.log(`Corona Server running → on PORT ${server.address().port}`);
});
