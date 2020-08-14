const Express = require('express')

const app = new Express()

app.use(Express.static('src/app/build'))

app.listen(8080, () => {
  console.log('Listening on port 8080...')
})
