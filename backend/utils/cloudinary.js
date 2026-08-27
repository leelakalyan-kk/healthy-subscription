const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'bkqftd5a',
  api_key: process.env.CLOUDINARY_API_KEY || '238125948199368',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'wiiOcmfymsJBwcRioto83y3R6ug'
});

module.exports = cloudinary;
