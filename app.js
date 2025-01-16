const express = require("express");
const path = require("path");
require("dotenv").config();
const app = express();
const cors = require("cors");
const bodyParser = require("body-parser");
require("./config/mongoose-connection");
const PORT = process.env.PORT || 3000;

const adminRouter = require("./routes/admin");
const userRouter = require("./routes/user");

app.use(express.json());
app.use(bodyParser.json());
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.set("view engine","ejs");
app.use(express.static(path.join(__dirname, "public")));

app.use("/admin", adminRouter);
app.use("/user", userRouter);

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});