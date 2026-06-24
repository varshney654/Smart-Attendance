import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import * as faceapi from '@vladmandic/face-api';

let faceLandmarker = null;

export const initMediaPipe = async () => {
  if (faceLandmarker) return faceLandmarker;
  
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
  );
  
  faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
      delegate: "GPU"
    },
    outputFaceBlendshapes: true,
    runningMode: "VIDEO",
    numFaces: 1
  });
  
  return faceLandmarker;
};

export const initFaceAPI = async () => {
  await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
  await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
  await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
};

// Check for natural micro-movements to avoid static photo attacks
export const checkLiveness = (recentLandmarks) => {
  if (recentLandmarks.length < 15) return false; // Need around 0.5s of frames (at 30fps)
  
  // Calculate variance in a specific landmark (e.g. nose tip) over the recent frames
  let noseX = recentLandmarks.map(l => l[1].x);
  let noseY = recentLandmarks.map(l => l[1].y);
  
  let avgX = noseX.reduce((a, b) => a + b) / noseX.length;
  let avgY = noseY.reduce((a, b) => a + b) / noseY.length;
  
  let varX = noseX.reduce((a, b) => a + Math.pow(b - avgX, 2), 0) / noseX.length;
  let varY = noseY.reduce((a, b) => a + Math.pow(b - avgY, 2), 0) / noseY.length;
  
  const movement = varX + varY;
  
  // Should have slight movement (real person), but not huge erratic movement
  // Very low movement means static image.
  return movement > 0.000005 && movement < 0.05;
};

export const getFaceDescriptor = async (videoElement) => {
  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.5 });
  const detection = await faceapi.detectSingleFace(videoElement, options)
    .withFaceLandmarks()
    .withFaceDescriptor();
    
  return detection ? Array.from(detection.descriptor) : null;
};

export const matchFace = (descriptor, cachedUsers) => {
  let minDistance = Number.MAX_VALUE;
  let bestMatch = null;

  for (const user of cachedUsers) {
    if (!user.faceData) continue;
    
    for (const cachedDesc of user.faceData) {
      const distance = faceapi.euclideanDistance(descriptor, cachedDesc);
      if (distance < minDistance) {
        minDistance = distance;
        bestMatch = user;
      }
    }
  }

  // 0.55 is a good threshold for face-api
  if (minDistance <= 0.55) {
    const confidence = Math.max(0, (1 - minDistance) * 100);
    return { user: bestMatch, confidence, distance: minDistance };
  }

  return null;
};
