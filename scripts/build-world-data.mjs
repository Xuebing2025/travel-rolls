import fs from "node:fs";

const [citiesPath, countriesPath, outputPath] = process.argv.slice(2);
if (!citiesPath || !countriesPath || !outputPath) {
  throw new Error("Usage: node build-world-data.mjs <cities15000.txt> <countryInfo.txt> <output.js>");
}

const continentCodes = new Set(["AF", "AN", "AS", "EU", "NA", "OC", "SA"]);
const obsoleteCountryCodes = new Set(["AN", "CS"]);
const countries = fs.readFileSync(countriesPath, "utf8")
  .split(/\r?\n/)
  .filter((line) => line && !line.startsWith("#"))
  .map((line) => line.split("\t"))
  .filter((fields) =>
    /^[A-Z]{2}$/.test(fields[0])
    && continentCodes.has(fields[8])
    && !obsoleteCountryCodes.has(fields[0])
  )
  .map((fields) => [fields[0], fields[8]]);

const knownCountries = new Set(countries.map(([countryCode]) => countryCode));
const citiesByCountry = Object.fromEntries(countries.map(([countryCode]) => [countryCode, []]));

for (const line of fs.readFileSync(citiesPath, "utf8").split(/\r?\n/)) {
  if (!line) continue;
  const fields = line.split("\t");
  const countryCode = fields[8];
  if (countryCode === "CN" || !knownCountries.has(countryCode) || fields[6] !== "P") continue;
  const latitude = Number(fields[4]);
  const longitude = Number(fields[5]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
  citiesByCountry[countryCode].push([
    fields[0],
    fields[1],
    fields[2] || fields[1],
    latitude,
    longitude,
    fields[10] || "",
    Number(fields[14] || 0),
  ]);
}

for (const cities of Object.values(citiesByCountry)) {
  cities.sort((left, right) => left[2].localeCompare(right[2], "en") || Number(right[6]) - Number(left[6]));
}

const payload = {
  source: "GeoNames cities15000",
  license: "CC BY 4.0",
  generatedAt: new Date().toISOString(),
  countries,
  cities: Object.fromEntries(Object.entries(citiesByCountry).filter(([, cities]) => cities.length)),
};

const header = [
  "// Generated from GeoNames cities15000 and countryInfo.",
  "// Source: https://download.geonames.org/export/dump/",
  "// License: https://creativecommons.org/licenses/by/4.0/",
];
fs.writeFileSync(
  outputPath,
  `${header.join("\n")}\nwindow.TRAVEL_ROLLS_WORLD_DATA=Object.freeze(${JSON.stringify(payload)});\n`,
  "utf8"
);

const cityCount = Object.values(citiesByCountry).reduce((sum, cities) => sum + cities.length, 0);
process.stdout.write(JSON.stringify({ countries: countries.length, cities: cityCount, outputPath }, null, 2));
