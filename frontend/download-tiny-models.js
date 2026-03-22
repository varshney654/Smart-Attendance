import https from 'https';
import fs from 'fs';
import path from 'path';

const urlBase = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/';
const files = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1'
];

const destDir = path.resolve('public/models');

async function downloadFile(file) {
  const destPath = path.join(destDir, file);
  if (fs.existsSync(destPath)) {
    console.log(`Exists: ${file}`);
    return;
  }
  
  return new Promise((resolve, reject) => {
    console.log(`Downloading ${file}...`);
    const fileStream = fs.createWriteStream(destPath);
    https.get(`${urlBase}${file}`, (res) => {
      if (res.statusCode !== 200) {
        fs.unlinkSync(destPath);
        return reject(`Failed: ${res.statusCode} for ${file}`);
      }
      res.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlinkSync(destPath);
      reject(err.message);
    });
  });
}

async function main() {
  try {
    for (const file of files) {
      await downloadFile(file);
    }
    console.log('Tiny models downloaded successfully!');
  } catch (err) {
    console.error('Download error:', err);
  }
}

main();
