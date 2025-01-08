const express = require("express");
const multer = require("multer");
const fs = require("fs");
const cloudinary = require("cloudinary").v2;
const Song = require("../models/song");
const Playlist = require("../models/playlist");
const Singer = require("../models/singer");

const router = express.Router();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/");
    },
    filename: (req, file, cb) => {
        cb(null,Date.now() + "-" + file.originalname) 
    }
});

const upload = multer({ storage });


cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});


// Add Song
router.post("/song/add", upload.single("file"), async (req, res) => {
    try {
        const { name, singer, language, playlist } = req.body;

        let singerDoc = await Singer.findOne({ name: { $regex: new RegExp("^" + singer.trim() + "$", "i") } });
        if (!singerDoc) {
            singerDoc = new Singer({ name: singer.trim() });
            await singerDoc.save();
        }


        let playlistDoc = await Playlist.findOne({ name: { $regex: new RegExp("^" + playlist + "$", "i") } });
        if (!playlistDoc) {
            playlistDoc = new Playlist({ name: playlist });
            await playlistDoc.save();
        }
        
        const result = await cloudinary.uploader.upload(req.file.path, { resource_type: "auto" });

        const newSong = new Song({
            name,
            singer: singerDoc._id,
            language,
            playlist: playlistDoc._id,
            fileLink: result.secure_url
        });

        await newSong.save();

        fs.unlinkSync(req.file.path);

        res.json({ message: "Song added successfully", song: newSong });
    } catch (error) {
        res.status(500).json({ error: "Error adding song", details: error.message });
    }
});

// Get All Songs
router.get("/song", async (req, res) => {
    try {
        const songs = await Song.find().populate("singer playlist");
        res.json(songs);
    } catch (err) {
        res.status(500).json({ error: "Error fetching songs", details: err.message });
    }
});

// Play Song & Update Count
router.post("/song/play/:id", async (req, res) => {
    try {
        const song = await Song.findById(req.params.id);
        if (!song) return res.status(404).json({ error: " Song not found" });

        song.playCount += 1;
        await song.save();

        const showAd = song.playCount % 5 === 0;
        res.json({ message: "Play count updated", showAd });
    } catch (err) {
        res.status(500).json({ error: "Error updating play count", details: err.message });
    }
});

// Update Song
router.put("/song/:id", async (req, res) => {
    const { id } = req.params;
    const { fileLink } = req.body;

    const song = await Song.findByIdAndUpdate(id, { fileLink }, { new: true });
    res.json({ message: "Song updated", song });
});

//Delete song
router.delete("/song/:id", async (req, res) => {
    const { id } = req.params;
    await Song.findByIdAndDelete(id);
    res.json({ message: "Song deleted" });
});

// Create Playlist
router.post("/playlist",upload.single("coverImage"), async (req, res) => {
    try {
        const { name, description, songs } = req.body;

        if (!name || name.trim() === "") {
            return res.status(400).json({ error: "Playlist name is required" });
        }

        let songIds = [];
        if (songs && Array.isArray(songs)) {
            for (const songName of songs) {
                const songDoc = await Song.findOne({ name: songName.trim() });
                if (songDoc) {
                    songIds.push(songDoc._id);
                }
            }
        }

        let coverImageUrl = ""

        if (req.file) {
            const result = await cloudinary.uploader.upload(req.file.path, { folder: "playlists" });
            coverImageUrl = result.secure_url;  
            fs.unlinkSync(req.file.path);
        }

        const newPlaylist = new Playlist({ 
            name, 
            description,
            songs: songIds,
            coverImage: coverImageUrl 
        });
        await newPlaylist.save();

        res.json({ message: "Playlist created", playlist: newPlaylist });
    } catch (error) {
        res.status(500).json({ error: "Error creating playlist", details: error.message });
    }
});

// Get All Playlist
router.get("/playlist", async (req, res) => {
    try {
        const playlists = await Song.find().populate("playlist");
        res.json(playlists);
    } catch (err) {
        res.status(500).json({ error: "Error fetching songs", details: err.message });
    }
});

// Update Playlist
router.put("/playlist/:id", async (req, res) => {
    const { id } = req.params;
    const { name, description, songs } = req.body;

    const playlist = await Playlist.findByIdAndUpdate(id, { name, description, songs }, { new: true });
    res.json({ message: "Playlist updated", playlist });
});

// Delete Playlist
router.delete("/playlist/:id", async (req, res) => {
    const { id } = req.params;
    await Playlist.findByIdAndDelete(id);
    res.json({ message: "Playlist deleted" });
});

// Add Singer
router.post("/singer", upload.single("picture"), async (req, res) => {
    try {
        const { name, bio } = req.body;

        if (!req.file) {
            return res.status(400).json({ error: "Picture file is required" });
        }

        const result = await cloudinary.uploader.upload(req.file.path, { folder: "singers" });

        const newSinger = new Singer({ name, bio, picture: result.secure_url });
        await newSinger.save();

        res.json({ message: "Singer added", singer: newSinger });
    } catch (error) {
        res.status(500).json({ error: "Error adding singer", details: error.message });
    }
});

module.exports = router;
