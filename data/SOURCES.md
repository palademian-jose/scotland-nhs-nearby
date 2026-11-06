# Data sources

All NHS Scotland datasets come from the Scottish public health open data portal
(https://www.opendata.nhs.scot) and are published under the
[Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/).
Contains public sector information licensed under the Open Government Licence v3.0.

Raw files are downloaded to `data/raw/` (gitignored, treated as untrusted input and read only with
`csv.DictReader`). `nhs-ingest download` fetches them again.

| Category | Dataset | Resource used | Downloaded | Rows parsed |
|---|---|---|---|---|
| gp | [GP Practice Contact Details and List Sizes](https://www.opendata.nhs.scot/dataset/gp-practice-contact-details-and-list-sizes) | `practice_contact_details_20261001_opendata.csv` (1 Oct 2026) | 2026-11-07 | 879 |
| pharmacy | [Dispenser Location Contact Details](https://www.opendata.nhs.scot/dataset/dispenser-location-contact-details) | `dispenser_contactdetails_202607.csv` (July 2026) | 2026-11-07 | 1343 |
| dentist | [Dental Practices and Patient Registrations](https://www.opendata.nhs.scot/dataset/dental-practices-and-patient-registrations) | `nhs-dental-practices-and-nhs-dental-registrations-as-at-31-mar-2026.csv` | 2026-11-07 | 989 |
| hospital | [Hospital Codes](https://www.opendata.nhs.scot/dataset/hospital-codes) | `hospitals.csv` | 2026-11-07 | 244 |
| ae | [NHS Scotland Accident & Emergency Sites](https://www.opendata.nhs.scot/dataset/nhs-scotland-accident-emergency-sites) | `ae_hospital_site_list_09_09_2025.csv` (open Type 1 sites only) | 2026-11-07 | 30 |

Full resource URLs are in `services/api/src/nhs_nearby/ingest/sources.py`. The portal publishes
one resource per release, so newer releases may exist; bump the URL there and re-run
`make ingest`.

Notes on the datasets:

- The dispenser list names the pharmacy contractor (for example "Boots UK Ltd"), not the shop,
  so pharmacy names are contractor names and the address identifies the branch.
- The dispenser list also contains a few cross-border (English) contractors with no Scottish
  health board; ingest drops them.
- The A&E list has no address; ingest takes the address from the matching hospital code.
- Dental addresses are upper case in the source and are title-cased at ingest.

## Geocoding

The NHS files carry postcodes, not coordinates. Postcodes are resolved once, at ingest, with the
free [postcodes.io](https://postcodes.io) bulk endpoint (`POST /postcodes`, 100 per request, no
key). postcodes.io serves Ordnance Survey / ONS postcode data under the Open Government Licence;
see https://postcodes.io for its attribution terms. The postcode to coordinate map is committed
as `data/geocode_cache.json` (looked up 2026-11-07, 2764 postcodes), so ingest is reproducible
offline once the raw CSVs are present. Postcodes that postcodes.io could not resolve (terminated
postcodes) are cached as `null` and their rows are dropped; counts per category are in
`reports/ingest.json`.

## Committed sample

`data/sample/*.csv` (230 rows, about 43 KB) is an evenly spaced subset of the built table plus all
30 open A&E sites, with coordinates already attached. The tests, the demo and the golden set run
against it, so no download is needed to try the project.

## Place names

`data/gazetteer.json` is a hand-written list of Scottish towns and city districts with approximate
centre coordinates (public geographic knowledge, no third-party file), used to resolve questions
such as "nearest pharmacy to Partick".

## Map tiles

The web map uses OpenStreetMap tiles. Map data copyright OpenStreetMap contributors (ODbL).
