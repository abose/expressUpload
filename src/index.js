const express = require('express')
const app = express()
const multer  = require('multer')
const fs = require('fs')
const port = 3000

app.use('/', express.static('www'))

var multipartUpload = multer({storage: multer.diskStorage({
        destination: function (req, file, callback) {
            let path = './www/'+req.body['path'] || './www';
            if (!fs.existsSync(path)) {
                fs.mkdirSync(path);
            }
            callback(null, path);
            },
        filename: function (req, file, callback) {
            callback(null, file.originalname);
        }})
}).array('files');

app.post('/upload', multipartUpload, function (req, res, next) {
    // req.files is array of `photos` files
    // req.body will contain the text fields, if there were any
    res.send('ok')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})
