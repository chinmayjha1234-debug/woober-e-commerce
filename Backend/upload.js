// Product image upload settings (using the multer library).
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// Uploaded images are saved in this folder.
const UPLOADS = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOADS, { recursive: true });

// Only these image types are allowed, and the extension we save them with.
const ALLOWED = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp'
};

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS,
    // Random file name, so two products can both use "photo.png" without clashing.
    filename: function (req, file, cb) {
      cb(null, crypto.randomBytes(16).toString('hex') + ALLOWED[file.mimetype]);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: function (req, file, cb) {
    if (ALLOWED[file.mimetype]) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, GIF or WebP images are allowed.'));
    }
  }
});

// Middleware: reads one file from the form field called "image" and puts it in req.file.
function uploadImage(req, res, next) {
  upload.single('image')(req, res, function (err) {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE' ? 'Image is too large (max 5 MB).' : err.message;
      return res.status(400).json({ error: message });
    }
    next();
  });
}

// Deletes a saved image from the uploads folder.
function deleteFile(fileName) {
  if (fileName) {
    fs.unlink(path.join(UPLOADS, fileName), function () {});
  }
}

module.exports = { uploadImage, deleteFile, UPLOADS };
