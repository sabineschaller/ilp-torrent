# ILP Torrent

This repository holds a demo implementation of a private tracker that only communicates a list of peers if a license fee for the file to be torrented has been paid. It makes use of [STREAM receipt verifier](https://github.com/coilhq/receipt-verifier) for the verification of payment.

## Environment Variables

To be set in an .env file

| Name | Example | Description
| -- | -- | -- |
APP_PORT | 8080 | port of torrent app
SERVER_PORT | 8081 | port of torrent deamon
VERIFIER_APP_PORT | 8082 | port of verifier service app
VERIFIER_PORT | 4001 | port of verifier (service) balance api
SPSP_PROXY_PORT | 4002 | port of verifier (service) spsp proxy
PROXY_API_PORT | 4003 | port of verifier service proxy api
TRACKER | ws://localhost:8000 | tracker endpoint
VERIFIER | http://localhost:4001 | balances api endpoint, used by verifier service app
SPSP_PROXY | http://localhost:4002 | spsp proxy endpoint, used by verifier service app
PROXY_API | http://localhost:4003 | proxy api endpoint, used by verifier service app
VERIFIER_APP | http://localhost:8082 | verifier app endpoint, used by torrent app
SERVER_SECRET | supersecret | password to protect torrent deamon


## Run
```
$ npm install
```

Start the receiver
```
$ npm run start:receiver
```
In a second terminal, start the verifier
```
$ npm run start:verifier
```
**or** start the verifier-service
```
$npm run build:verifier-service && npm run start:verifier-service
```
In a third terminal, start the private torrent tracker
```
$ npm run start:tracker
```
Finally, in a fourth terminal, build and start the demo app
```
$ npm run build:app && npm run start:app
```

To run the API and not the browser version, run
```
$ npm run start:server
```
To run the verifier service app, run
```
$ npm run build:verifier-app && npm run start:verifier-app
```

### Configuring Extension

To connect to the STREAM server you must build the extension to use the local btp endpoint rather than Coil.

Clone the [web-monetization-projects](https://github.com/coilhq/web-monetization-projects) repository, and install it
```sh
$ yarn install
```

Then, build the extension
```sh
$ cd packages/coil-extension/
$ export BTP_ENDPOINT=btp+ws://localhost:3000
# build in development mode
$ yarn dev-chrome-prod
```

## Try it out in the browser
Load the extension build into Chrome, then open the app on http://localhost:8080.

| Variable | Value |
| -- | -- |
| Proxy Payment Pointer | http://localhost:4001/spsp/~niq |
| Verifier Endpoint | http://localhost:4002 |
| Price | variable, *Note: choose something small for demo purposes such that you don't have to wait long for the file to load* |
| Currency | USD |
| File | variable, e.g. image or video file |
| Name | OPTIONAL and variable, e.g. 'vacation-2020', *Note: no extension required, will be derived from original file name* |

To leech, open an incognito tab of Chrome and navigate to http://localhost:8080. Paste the magnet URI that was just generated and wait until enough funds have been streamed via web monetization and the file loads.

## Seed using the server API

Make a POST request to the API, making sure to provide your password
```
$ curl -u admin:supersecret -X POST http://localhost:8081/seed -F 'paymentPointer=http://localhost:4001/spsp/~niq' -F 'verifier=http://localhost:4002' -F 'amount=0.00002' -F 'asset=USD' -F 'file=@/path/to/your/file.png'
```
It responds with the magnet:
```
magnet:?xt=urn:btih:db848ee06597d3bf410ce25ab7319cacd8c6c031&dn=file.png&tr=ws%3A%2F%2Flocalhost%3A8000&pp=http%3A%2F%2Flocalhost%3A4001%2Fspsp%2F~niq&vr=http%3A%2F%2Flocalhost%3A4002
```

## Todo's

- [ ] only include metatag with payment pointer into apps, not empty content
- [ ] deal with asset code and asset scale conversion
- [ ] incremental license fee payments, not everything up front
- [ ] additional payments to peers to incentivize seeding
