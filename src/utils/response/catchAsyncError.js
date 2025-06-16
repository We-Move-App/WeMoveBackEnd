// const catchAsyncError = (fn) => (req, res, next) => {
//   Promise.resolve(fn(req, res, next)).catch(next);
// };

// module.exports = catchAsyncError;

const {
  deleteUploadedFilesFromDisk,
} = require("../uploadFiles/images/deleteImagesFromStorage");

const catchAsyncError = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (error) {
    // Ensure `req.files` is available and contains files before deleting
    if (req.files && Object.keys(req.files).length > 0) {
      await deleteUploadedFilesFromDisk(req.files);
    }
    next(error); // Forward the error to the global error handler
  }
};

module.exports = catchAsyncError;
