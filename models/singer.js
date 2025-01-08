const mongoose = require("mongoose");

const singerSchema = mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    bio: {
        type: String
    },
    picture: {
        type: String
    }
});

module.exports = mongoose.model("Singer",singerSchema);