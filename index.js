const cool = require('cool-ascii-faces');
const express = require('express');
const path = require('path');
const PORT = process.env.PORT || 5555;
const https = require("https");
const webhook = require('./modules/line')
process.env.TZ = "Asia/Tokyo";

express()
  .use(express.static(path.join(__dirname, 'public')))
  .use(express.json())
  .use(express.urlencoded({extended: true}))
  .set('views', path.join(__dirname, 'views'))
  .set('view engine', 'ejs')
  .get('/', (req, res) => res.render('pages/index'))
  .use('/webhook', webhook)
  .listen(PORT, () => console.log(`Listening on ${ PORT }`));