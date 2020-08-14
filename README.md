# ILP Torrent

This repository holds a demo implementation of a private tracker that only communicates a list of peers if a license fee for the file to be torrented has been paid. It makes use of [STREAM receipt verifier](https://github.com/coilhq/receipt-verifier) for the verification of payment.

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
In a third terminal, start the private torrent tracker
```
$ npm run start:tracker
```
Finally, in a fourth terminal, build and start the demo app
```
$ npm run app:build && npm run start:app
```

To run the API and not the browser version, run
```
$npm run start:server
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

Make a POST request to the API
```
$ curl -X POST http://localhost:8081/seed -F 'paymentPointer=http://localhost:4001/spsp/~niq' -F 'verifier=http://localhost:4002' -F 'amount=0.00002' -F 'asset=USD' -F 'file=@/path/to/your/file.png'
```
It responds with the magnet:
```
magnet:?xt=urn:btih:db848ee06597d3bf410ce25ab7319cacd8c6c031&dn=file.png&tr=ws%3A%2F%2Flocalhost%3A8000&pp=http%3A%2F%2Flocalhost%3A4001%2Fspsp%2F~niq&vr=http%3A%2F%2Flocalhost%3A4002
```

## Immediate Todo's

- [ ] allow for different asset code and asset scale
- [ ] incremental license fee payments, not everything up front
- [ ] additional payments to peers to incentivize seeding
