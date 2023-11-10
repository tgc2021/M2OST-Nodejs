const mysql = require("mysql2");

var mysqlConnection = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "Tgc@12345",
  database: "PYPdb",
});
var connection = mysqlConnection.connect((err) => {
  if (err) {
    console.log("Error in Db connection: " + JSON.stringify(err, undefined, 2));
  } else {
    console.log("Db connected successfully");
  }
});
module.exports = connection;
