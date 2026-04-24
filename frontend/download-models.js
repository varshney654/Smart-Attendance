import https from 'https';
import fs from 'fs';
import path from 'path';

const urlBase = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/';
const files = [
  'ssd_mobilenetv1_model-weights_manifest.json',
  'ssd_mobilenetv1_model-shard1',
  'ssd_mobilenetv1_model-shard2',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_recognition_model-shard2'
];

const destDir = path.resolve('public/models');
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

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
    console.log('All models downloaded successfully!');
  } catch (err) {
    console.error('Download error:', err);
  }
}

main();
