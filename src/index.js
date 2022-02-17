const express = require('express')
const app = express()
const multer  = require('multer')
const fs = require('fs')
const cors =require('cors');

const port = 3000

app.use(cors({
    methods: ['POST']
}));

app.use('/', express.static('userContent'))
app.use('/test', express.static('www'))

var multipartUpload = multer({storage: multer.diskStorage({
        destination: function (req, file, callback) {
            let path = './userContent/'+req.body['path'] || './userContent';
            if (!fs.existsSync(path)) {
                fs.mkdirSync(path,{ recursive: true });
            }
            callback(null, path);
            },
        filename: function (req, file, callback) {
            let path = `./userContent/${req.body['path']}/${file.originalname}` ;
            console.log(`Update file(${req.files.length}): ${path}`);
            callback(null, file.originalname);
        }})})
    .array('files');

app.post('/upload', multipartUpload, function (req, res, next) {
    // req.files is array of `photos` files
    // req.body will contain the text fields, if there were any
    res.send('ok')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})
