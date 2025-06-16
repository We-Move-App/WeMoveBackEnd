const { deleteFileFromDisk } = require("../multer");

const deleteUploadedFilesFromDisk = async (files) => {
  if (!files) return;

  const keys = Object.keys(files);

  await Promise.all(
    keys.map(async (key) => {
      const filesArray = files[key]; // Get array of files
      if (Array.isArray(filesArray)) {
        await Promise.all(
          filesArray.map(async (file) => {
            if (file.path) {
              try {
                await deleteFileFromDisk(file.path);
              } catch (err) {
                console.error(
                  `Error deleting file (${file.path}): ${err.message}`
                );
              }
            }
          })
        );
      }
    })
  );
};

module.exports = {deleteUploadedFilesFromDisk };
