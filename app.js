require("dotenv").config();
const express = require("express");
const multer = require("multer");
const mysql = require("mysql2");
const fs = require("fs");

const app = express();
const port = process.env.PORT;

app.use(express.json());

// Define storage for file uploads with a 10MB limit (you can adjust this limit)
const fileStorage = multer.memoryStorage();
const fileUpload = multer({
  storage: fileStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit (you can adjust this limit)
});

// Create a MySQL database connection
const db = mysql.createConnection({
  host: "15.207.42.176",
  user: "pypdbuser",
  password: "Tgc@12345",
  database: "pypdb",
});

// Define the directory where uploaded files are stored
app.use("/uploads", express.static("uploads"));

// Define a route to post user details to tbl_user with auto-generated updated_datetime
app.post("/postUserDetails", (req, res) => {
  const { org_id, user_id, source } = req.body;

  if (!org_id || !user_id || !source) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Check if the user already exists in tbl_user
  db.query(
    "SELECT * FROM tbl_user WHERE org_id = ? AND user_id = ?",
    [org_id, user_id],
    (error, results) => {
      if (error) {
        console.error(error);
        return res.status(500).json({ error: "Error checking user existence" });
      }

      if (results.length > 0) {
        // User already exists in tbl_user, return an error
        return res.status(400).json({ error: "User already exists" });
      }

      // User does not exist, create a new user
      db.query(
        "INSERT INTO tbl_user (org_id, user_id, source, updated_datetime) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
        [org_id, user_id, source],
        (error, results) => {
          if (error) {
            console.error(error);
            res.status(500).json({ error: "Error posting user details" });
          } else {
            res.json({
              message: "User details posted successfully",
              userId: results.insertId,
            });
          }
        }
      );
    }
  );
});

// Create a route for inserting values into tbl_uploadfile_master
app.post("/insertUploadFileMaster", (req, res) => {
  const { file_type, file_size, file_duration, org_id } = req.body;

  if (!file_type || !file_size || !file_duration || !org_id) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  db.query(
    "INSERT INTO tbl_uploadfile_master (file_type, file_size, file_duration, org_id) VALUES (?, ?, ?, ?)",
    [file_type, file_size, file_duration, org_id],
    (error, results) => {
      if (error) {
        console.error(error);
        res
          .status(500)
          .json({ error: "Error inserting into tbl_uploadfile_master" });
      } else {
        res.json({
          message: "Values inserted successfully",
          fileId: results.insertId,
        });
      }
    }
  );
});

// Create a route for uploading files with different types
app.post("/insertFileContext", (req, res) => {
  const { org_id, context, subtype, call_to_action } = req.body;

  if (!org_id || !context || !subtype || !call_to_action) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  db.query(
    "INSERT INTO tbl_filecontext_master (org_id, context, subtype, call_to_action) VALUES (?, ?, ?, ?)",
    [org_id, context, subtype, call_to_action],
    (error, results) => {
      if (error) {
        console.error(error);
        res.status(500).json({ error: "Error inserting values" });
      } else {
        res.json({
          message: "Values inserted successfully",
          fileId: results.insertId,
        });
      }
    }
  );
});

// Create a route to get contexts without subtypes based on org_id
app.get("/getAllContexts/:org_id", (req, res) => {
  const org_id = req.params.org_id;

  db.query(
    "SELECT id_filecontext, context, subtype, call_to_action FROM tbl_filecontext_master WHERE org_id = ?",
    [org_id],
    (error, results) => {
      if (error) {
        console.error(error);
        res.status(500).json({
          error: "Error retrieving contexts for the specified org_id",
        });
      } else {
        res.json(results);
      }
    }
  );
});

// Create a route to get subtypes based on context
app.get("/getSubtypesByContext/:context", (req, res) => {
  const context = req.params.context;

  db.query(
    "SELECT DISTINCT subtype FROM tbl_filecontext_master WHERE context = ?",
    [context],
    (error, results) => {
      if (error) {
        console.error(error);
        res.status(500).json({
          error: "Error retrieving subtypes for the specified context",
        });
      } else {
        res.json(results);
      }
    }
  );
});

// Create a route for uploading files with different types using query parameters
app.post("/useruploadapi", fileUpload.single("file"), (req, res) => {
  const id_user = req.query.id_user;
  const org_id = req.query.org_id;
  const user_id = req.query.user_id;

  if (!id_user || !org_id || !user_id) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  // Check if the user exists in tbl_users
  db.query(
    "SELECT * FROM tbl_user WHERE id_user = ? AND org_id = ? AND user_id = ?",
    [id_user, org_id, user_id],
    (error, userResults) => {
      if (error) {
        console.error(error);
        return res.status(500).json({ error: "Error checking user existence" });
      }

      if (userResults.length === 0) {
        // User does not exist in tbl_users, return an error
        return res.status(400).json({ error: "User does not exist" });
      }

      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: "No file provided" });
      }

      // Calculate the file size in bytes
      const fileSize = file.buffer.byteLength;

      // Check for file size error
      if (fileSize > 10 * 1024 * 1024) {
        return res
          .status(400)
          .json({ error: "File size exceeds the 10MB limit" });
      }

      const { originalname, mimetype, buffer } = file;

      // Define a variable to store the file type based on the MIME type
      let fileType;

      // Determine the file type and create a folder accordingly
      if (mimetype.startsWith("video/")) {
        fileType = "video";
      } else if (mimetype.startsWith("audio/")) {
        fileType = "audio";
      } else if (
        mimetype === "application/msword" ||
        mimetype ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        fileType = "docx";
      } else if (mimetype === "application/pdf") {
        fileType = "pdf";
      } else if (
        mimetype.startsWith("application/vnd.ms-powerpoint") ||
        mimetype ===
          "application/vnd.openxmlformats-officedocument.presentationml.presentation"
      ) {
        fileType = "ppt"; // Correct MIME types for PPT and PPTX files
      } else if (mimetype.startsWith("image/")) {
        fileType = "image"; // Detect images based on MIME type
      } else {
        fileType = "unknown"; // You can handle other file types as needed
      }

      // Create a folder for the specific file type if it doesn't exist
      const fileTypeDirectory = `uploads/${id_user}/${fileType}`;
      if (!fs.existsSync(fileTypeDirectory)) {
        fs.mkdirSync(fileTypeDirectory, { recursive: true });
      }

      // Generate a unique file name to avoid conflicts
      const uniqueFileName = `${Date.now()}-${originalname}`;

      // Save the file within the user's subdirectory and the file type subdirectory
      const filePath = `${fileTypeDirectory}/${uniqueFileName}`;
      fs.writeFileSync(filePath, buffer);

      // Insert the file information into tbl_userupload_details
      db.query(
        "INSERT INTO tbl_userupload_details (id_user, org_id, user_id, file_type, file_name, file_path, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          id_user,
          org_id,
          user_id,
          fileType,
          originalname,
          filePath,
          "uploaded",
        ],
        (error, results) => {
          if (error) {
            console.error(error);
            res.status(500).json({ error: "Error uploading the file" });
          } else {
            // After successfully inserting into tbl_userupload_details, insert into tbl_uploadfile_master
            res.json({
              message: "File uploaded successfully",
              fileId: results.insertId,
            });
          }
        }
      );
    }
  );
});

// Create a route to retrieve uploaded files for a particular user using the id_user
app.get("/getuserupload/:id_user", (req, res) => {
  const id_user = req.params.id_user;

  db.query(
    "SELECT id_userdetailslog, file_type, file_name, file_path FROM tbl_userupload_details WHERE id_user = ?",
    [id_user],
    (error, results) => {
      if (error) {
        console.error(error);
        res.status(500).json({ error: "Error retrieving uploaded files" });
      } else {
        // Modify the results to include the file paths relative to the "uploads" directory
        const files = results.map((file) => {
          return {
            id_userdetailslog: file.id_userdetailslog,
            file_type: file.file_type,
            file_name: file.file_name,
            file_path: `${file.file_path}`, // Adjust the path as needed
          };
        });

        res.json(files);
      }
    }
  );
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
