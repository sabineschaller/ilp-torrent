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

## Try it out
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
