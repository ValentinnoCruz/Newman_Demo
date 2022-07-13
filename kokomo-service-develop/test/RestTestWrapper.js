const express = require('express')
const path = require('path');
const app = express()
const port = 3001
const sqlite3 = require('sqlite3');
const bodyParser = require("express");
const db = new sqlite3.Database(path.join(__dirname, '..', 'kokomo.sqlite'));

app.use(bodyParser.text());

app.post('/sql', async (req, res) => {
  const query = req.body;
  db.all(query, function(err, rows) {
    if(err)
    {
      res.status(400).send({
        'error': err.message,
        'num': err.errno,
        'code': err.code
      });
    } else {
      res.send(rows);
    }
  });
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
