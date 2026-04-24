const fs = require('fs');
const https = require('https');
const path = require('path');

const baseUrl = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/';
const models = [
  'ssd_mobilenetv1_model-weights_manifest.json',
  'ssd_mobilenetv1_model-shard1',
  'ssd_mobilenetv1_model-shard2',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_recognition_model-shard2'
];

const dest = path.join(__dirname, 'public', 'models');

if (!fs.existsSync(dest)) {
  fs.mkdirSync(dest, { recursive: true });
}

function download(filename) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(path.join(dest, filename));
    https.get(baseUrl + filename, function(response) {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', function() {
          file.close(resolve);
        });
      } else {
        fs.unlink(path.join(dest, filename), () => {});
        reject(`Failed to download ${filename}: ${response.statusCode}`);
      }
    }).on('error', function(err) {
      fs.unlink(path.join(dest, filename), () => {});
      reject(err.message);
    });
  });
}

async function main() {
  console.log('Downloading face-api.js models...');
  for (const model of models) {
    try {
      await download(model);
      console.log(`Downloaded ${model}`);
    } catch (err) {
      console.error(err);
    }
  }
  console.log('Download complete.');
}

main();
