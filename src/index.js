import express from 'express';
const app = express()
import multer  from 'multer';
import fs from 'fs';
import process from 'process';
import path from 'path';
import cors from 'cors'
import { mkdtemp, rm , mkdir} from 'fs/promises';
import scrape from 'website-scraper';
import zipper from 'zip-local';
import fetch from 'node-fetch';
import crypto from'crypto';

const downloadFile = (async (url, path) => {
    const res = await fetch(url);
    const fileStream = fs.createWriteStream(path);
    await new Promise((resolve, reject) => {
        res.body.pipe(fileStream);
        res.body.on("error", reject);
        fileStream.on("finish", resolve);
    });
});

const port = 3000;
const TEMP_DIR = "./temp";
const TEMP_GITHUB_DIR = "./temp/GitHub";

app.use(cors({
    methods: ['POST', 'GET', 'OPTIONS']
}));

app.use('/p', express.static('userContent'))
app.use('/test', express.static('www'))


function redirectToPhcode(req, res) {
    res.sendFile(path.join(process.cwd(), '/www/index.html'));
}

app.get('/', redirectToPhcode);
app.get('/index.html', redirectToPhcode);
app.get('/index.htm', redirectToPhcode);

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
    console.log(`${clientIP}: upload`);
    res.send('ok')
})

async function _ensureTempDirs() {
    if(!fs.existsSync(TEMP_DIR)){
        await mkdir(TEMP_DIR, {recursive: true});
    }
    if(!fs.existsSync(TEMP_GITHUB_DIR)){
        await mkdir(TEMP_GITHUB_DIR, {recursive: true});
    }
}

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
        await _ensureTempDirs();
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

app.get('/getGitHubZip', async function (req, res, next) {
    try {
        let downloadOrg = req.query.org;
        let downloadRepo = req.query.repo;
        let clientIP= req.headers["x-real-ip"] || req.headers['X-Forwarded-For'] || req.socket.remoteAddress;
        console.log(`${clientIP}: Downloading github: ${downloadOrg}/${downloadRepo}`);
        if(!downloadOrg || !downloadRepo){
            res.status(400);
            res.send("missing `org` or `repo` parameter");
            return;
        }
        await _ensureTempDirs();
        let zipURL = `https://api.github.com/repos/${downloadOrg}/${downloadRepo}/zipball`;
        let tempFilePath = `${TEMP_DIR}/GitHub/${downloadOrg}-${downloadRepo}-${crypto.randomBytes(4).readUInt32LE(0)}.zip`;
        await downloadFile(zipURL, tempFilePath);

        // GiHub does not put content size during zip file download, so we check size post download
        var stats = fs.statSync(tempFilePath)
        var fileSizeInBytes = stats.size;
        var fileSizeInMegabytes = fileSizeInBytes / (1024*1024);
        if(fileSizeInMegabytes > 25){
            res.status(413);
            res.send("File size too large. Phoenix services only support 25MB file size for non logged in users");
            return;
        }

        res.set('Content-Length', String(fileSizeInBytes));
        let readStream = fs.createReadStream(tempFilePath);
        readStream.pipe(res);

        await _silentDeleteDir(tempFilePath);
    } catch (err) {
        console.error(err);
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
