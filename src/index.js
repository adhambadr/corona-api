import "@babel/polyfill";
import express from "express";
import bodyParser from "body-parser";

import corona from "./corona.js";

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.set("port", process.env.PORT || 2019);

app.get("/status", (req, res) => {
	res.status(200).json({ status: 1 });
});

app.post("/current", async (req, res) => {
	try {
		res.status(200).json(await corona.getCountryCurrent(req.body.country));
	} catch (e) {
		console.log(e);
		res.status(500).json({ err: e });
	}
});

const server = app.listen(app.get("port"), () => {
	console.log(`Corona Server running → on PORT ${server.address().port}`);
});
