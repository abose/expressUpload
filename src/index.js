const express = require('express')
const app = express()
const multer  = require('multer')
const upload = multer({ dest: 'www/' })
const port = 3000

app.use('/', express.static('www'))

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})
