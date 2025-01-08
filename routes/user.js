const express = require("express");
const Song = require("../models/song");
const Playlist = require("../models/playlist");

const router = express.Router();

// Search Song by Name
router.get("/song", async (req, res) => {
    const { name } = req.query;
    const song = await Song.find({ name: new RegExp(name, "i") }).populate("singer playlist");
    res.json(song);
});

// Get Playlist by ID
router.get("/playlist/:id", async (req, res) => {
    const { id } = req.params;
    const playlist = await Playlist.findById(id).populate("songs");
    res.json(playlist);
});

// Increment Play Count and Show Ads
router.post("/song/play/:id", async (req, res) => {
    const { id } = req.params;
    const song = await Song.findById(id);

    if (!song) return res.status(404).json({ error: "Song not found" });

    song.playCount += 1;
    await song.save();

    const showAd = song.playCount % 5 === 0;
    res.json({ message: "Play count updated", showAd });
});

module.exports = router;
