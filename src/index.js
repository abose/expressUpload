import express from 'express';
const app = express()
import multer  from 'multer';
import fs from 'fs';
import path from 'path';
import cors from 'cors'
import { mkdtemp, rm } from 'fs/promises';
import scrape from 'website-scraper';
import zipper from 'zip-local';

const port = 3000;
const TEMP_DIR = "./temp";

app.use(cors({
    methods: ['POST', 'GET', 'OPTIONS']
}));

app.use('/p', express.static('userContent'))
app.use('/test', express.static('www'))

var multipartUpload = multer({storage: multer.diskStorage({
        destination: function (req, file, callback) {
            let uploadPath = './userContent/'+req.body['path'] || './userContent';
            if (!fs.existsSync(uploadPath)) {
                fs.mkdirSync(uploadPath,{ recursive: true });
            }
            callback(null, uploadPath);
            },
        filename: function (req, file, callback) {
            let uploadPath = `./userContent/${req.body['path']}/${file.originalname}` ;
            console.log(`Update file(${req.files.length}): ${uploadPath}`);
            callback(null, file.originalname);
        }})})
    .array('files');

app.post('/upload', multipartUpload, function (req, res, next) {
    // req.files is array of `photos` files
    // req.body will contain the text fields, if there were any
    let clientIP= req.headers["x-real-ip"] || req.headers['X-Forwarded-For'] || req.socket.remoteAddress;
    console.log(`${clientIP}: Downloading Site: ${downloadURL}`);
    res.send('ok')
})

async function _silentDeleteDir(uploadPath) {
    try {
        await rm(uploadPath,{recursive: true});
    } catch (e) {
        // do nothing
    }
}

app.get('/getWebsiteCode', async function (req, res, next) {
    // req.files is array of `photos` files
    // req.body will contain the text fields, if there were any
    let tempDir;
    try {
        let downloadURL = req.query.url;
        let clientIP= req.headers["x-real-ip"] || req.headers['X-Forwarded-For'] || req.socket.remoteAddress;
        if(!downloadURL){
            res.status(400);
            res.send("missing `url` parameter");
            return;
        }

        console.log(`${clientIP}: Downloading Site: ${downloadURL}`);
        let siteName = new URL(downloadURL).hostname;
        tempDir = path.join(TEMP_DIR, `${siteName}-`);
        tempDir = await mkdtemp(tempDir);

        console.log(`${clientIP}: temp dir: ${tempDir}`);
        let siteDownloadDir = `${tempDir}/site`;
        const options = {
            urls: [downloadURL],
            directory: siteDownloadDir
        };
        await scrape(options);

        let zipFilePath = `${tempDir}/${siteName}.zip`;
        zipper.sync.zip(siteDownloadDir).compress().save(zipFilePath);

        let filename = path.basename(zipFilePath);
        res.download(zipFilePath, filename, ()=>{
            _silentDeleteDir(tempDir);
        });
    } catch (err) {
        console.error(err);
        await _silentDeleteDir(tempDir);
        res.status(500);
        res.send("something went wrong.");
        return;
    }
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})

process.on('uncaughtException', function(err){
    console.error("uncaught ERR, silently swallowing hoping for the best!!!!",err);
});
