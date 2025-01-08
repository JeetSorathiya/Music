const mongoose = require("mongoose");

const playlistSchema = mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    description: {
        type: String
    },
    coverImage: { 
        type: String 
    },
    songs: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Song"
    }],
    createdBy: {
        type: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Playlist", playlistSchema);