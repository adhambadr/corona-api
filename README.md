# corona-api
https://corona.blloc.com

used in : https://corona-visuals.now.sh/ (https://github.com/adhambadr/corona-visual-tool)


### Simple REST api for getting live Covid-19 confirmed, recovered and deaths. 
Data is piggybacked from morgenpost.de live tracker, which runs a web scraper scraps from Johns Hopkins University CSSE, WHO, CDC (USA), ECDC (Europa), NHC, DXY (China) and the official German Health ministry (Robert-Koch-Institut and German Federal Health Institute).

_To avoid bashing ther servers data is updated only every 15 minutes and cached localy. Most institutes update records within a 3-6 hour window so no need for any higher frequency of querying_ 

### API
Method | Path | Query | Result
---- | --- | --- | ---
GET | / | | Data for world numbers (confirmed , recovered, deaths)
GET | /current | ?country=Spain | data for country (obj description below)
POST | /current/location | {longitude : 5.1232 , latitude : -7.2321 } | simple geo nearest data point for given location
GET | /historic | ?country=USA | historic data points up till now |

### Result object

#### ```/``` 
```json
{
    "confirmed": 157002,
    "recovered": 73971,
    "deaths": 5833
}
```

### ```/current?country=Mexico```
```json
{
    "parent": "global",
    "label": "Mexiko",
    "updated": 1584219182000,
    "date": "2020-03-14T20:53:02.000Z",
    "confirmed": 26,
    "recovered": 4,
    "deaths": 0,
    "lon": -102.5528,
    "lat": 23.6345,
    "source": "Coronavirus COVID-19 Global Cases by Johns Hopkins CSSE",
    "source_url": "https://www.arcgis.com/apps/opsdashboard/index.html#/bda7594740fd40299423467b48e9ecf6",
    "scraper": "hopkins.arcgis",
    "statesData": [] 
}
```
_Few countries have state based data (Germany, China, USA, Italy) i reckon_

### ```/current/location```
Returns either same  country object as ```/current``` result or if it finds a state level data point it will return : 
```json
{
    "parent": "Deutschland",
    "label": "Berlin",
    "updated": 1584259200000,
    "date": "2020-03-15T08:00:00.000Z",
    "confirmed": 263,
    "recovered": 0,
    "deaths": 0,
    "lon": 13.40732,
    "lat": 52.52045,
    "source": "RKI/eigene",
    "source_url": "https://www.rki.de/DE/Content/InfAZ/N/Neuartiges_Coronavirus/Fallzahlen.html",
    "scraper": "rki.spreadsheet",
    "countryData": {
        "confirmed": 5178,
        "recovered": 48,
        "deaths": 9,
        "statesData": []
      }
     }
     ...
```
### ```/history?country=France```
returns keyed object with all the datapoints since cases tracking, key being State name + a federal key for a combined list of data points
```javascript 
{
 "Saint Barthélemy" : [...] , /* Same result object as above */
 "federal": [
        {
            "date": "2020-03-04T00:00:00.000Z",
            "confirmed": 3,
            "recovered": 0,
            "deaths": 0
        },
        ...
   ]
}
```
## Development

#### Install 
```
yarn 
```
#### Run
```
yarn start
```

Happy data playing. 
