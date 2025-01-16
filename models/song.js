const mongoose = require("mongoose");

const songSchema = mongoose.Schema({
    name: {
        type: String
    },
    singer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Singer"
    },
    language: {
        type: String
    },
    fileLink: {
        type: String
    },
    artwork: {
        type: String
    },
    url: {
        type: String
    },
    rating: {
        type: Number,
        default: 0
    },
    playlist: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Playlist"
    },
    playCount: {
        type: Number,
        default: 0
    }
});

module.exports = mongoose.model("Song",songSchema);