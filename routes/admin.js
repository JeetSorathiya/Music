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

// Function to Upload File to Cloudinary
const uploadToCloudinary = async (filePath, folder) => {
    const result = await cloudinary.uploader.upload(filePath, {
        folder,
        resource_type: "image"
    });
    fs.unlinkSync(filePath); 
    return result.secure_url;
};

// Function to Upload URL to Cloudinary (for artwork & images)
const uploadUrlToCloudinary = async (url, folder) => {
    if (url.includes("cloudinary")) return url;
    const result = await cloudinary.uploader.upload(url, { 
        folder,
        resource_type: "image" 
    });
    return result.secure_url;
};

// Function to Upload Audio Files to Cloudinary
const uploadAudioToCloudinary = async (filePath) => {
    const result = await cloudinary.uploader.upload(filePath, {
        resource_type: "video",
        folder: "audio"
    })
    fs.unlinkSync(filePath);
    return result.secure_url;
}

// Function to Upload Audio URL to Cloudinary
const uploadAudioUrlToCloudinary = async (url) => {
    if (url.includes("cloudinary")) return url;
    const result = await cloudinary.uploader.upload(url, {
        resource_type: "video",
        folder: "audio"
    });
    return result.secure_url;
};

// Add Song
router.post("/song/add", upload.single("file"), async (req, res) => {
    try {
        const songsData = req.body;
        
        if (!Array.isArray(songsData)) {
            return res.status(400).json({ error: "Input must be an array of songs" });
        }

        const importedSongs = [];

        for (const songData of songsData) {

            // Upload Song File
            // let fileLink = songData.url; 
            let fileLink;
            if (req.file) {
                fileLink = await uploadAudioToCloudinary(req.file.path);
            } else if (songData.url) {
                fileLink = await uploadAudioUrlToCloudinary(songData.url);
            } else {
                continue; // Skip if no audio source
            }

            // Upload Song Artwork
            let artworkUrl = await uploadUrlToCloudinary(songData.artwork, "artworks");
            
            // Find or create singer
            let singer = await Singer.findOne({ 
                name: { $regex: new RegExp(`^${songData.artist}$`, "i") }
            });
            
            if (!singer) {
                let pictureUrl = await uploadUrlToCloudinary(songData.artwork, "singers");
                singer = new Singer({ 
                    name: songData.artist,
                    picture: pictureUrl
                });
                await singer.save();
            }

            // Process playlists
            const playlistIds = [];
            for (const playlistName of songData.playlist) {
                let playlist = await Playlist.findOne({
                    name: { $regex: new RegExp(`^${playlistName}$`, "i") }
                });

                if (!playlist) {
                    let coverImageUrl = await uploadUrlToCloudinary(songData.artwork, "playlists");
                    playlist = new Playlist({ 
                        name: playlistName,
                        coverImage: coverImageUrl
                    });
                    await playlist.save();
                }
                playlistIds.push(playlist._id);
            }

            // Check for existing song to avoid duplicates
            let existingSong = await Song.findOne({ 
                url: songData.url,
                name: songData.title 
            });

            if (!existingSong) {
                const newSong = new Song({
                    name: songData.title,
                    singer: singer._id,
                    fileLink,
                    artwork: artworkUrl,
                    url: songData.url,
                    rating: songData.rating || 0,
                    playlist: playlistIds[0], // Primary playlist
                    playCount: 0
                });

                await newSong.save();

                // Add song to all specified playlists
                await Playlist.updateMany(
                    { _id: { $in: playlistIds } },
                    { $addToSet: { songs: newSong._id } }
                );

                importedSongs.push(newSong);
            }
        }

        res.json({
            message: "Songs imported successfully",
            count: importedSongs.length,
            songs: importedSongs
        });
    } catch (error) {
        console.error("Import error:", error);
        res.status(500).json({
            error: "Error importing songs",
            details: error.message
        });
    }
});

// Get All Songs
router.get("/song", async (req, res) => {
    try {
        const songs = await Song.find().populate("singer").populate("playlist");
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
    try {
        const song = await Song.findById(req.params.id);
        if (!song) return res.status(404).json({ error: "Song not found" });

        // Delete file from Cloudinary
        if (song.fileLink.includes("res.cloudinary.com")) {
            const publicId = song.fileLink.split("/").pop().split(".")[0]; // Extract public_id
            await cloudinary.uploader.destroy(publicId, { resource_type: "video" });
        }

        await Song.findByIdAndDelete(req.params.id);
        res.json({ message: "Song deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: "Error deleting song", details: error.message });
    }
});

// Create Playlist

router.post("/playlist", upload.single("coverImage"), async (req, res) => {
    try {
        const { name, description, songs } = req.body;
        if (!name || name.trim() === "") return res.status(400).json({ error: "Playlist name is required" });

        let coverImageUrl = req.file ? await uploadToCloudinary(req.file.path, "playlists") : "";
        
        const newPlaylist = new Playlist({ name, description, songs, coverImage: coverImageUrl });
        await newPlaylist.save();

        res.json({ message: "Playlist created", playlist: newPlaylist });
    } catch (error) {
        res.status(500).json({ error: "Error creating playlist", details: error.message });
    }
});

// Get All Playlist
router.get("/playlist", async (req, res) => {
    try {
        const playlists = await Playlist.find().populate({path: "songs", populate: {path: "singer"}});
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
    try {
        const playlist = await Playlist.findById(req.params.id);
        if (!playlist) return res.status(404).json({ error: "Playlist not found" });

        // Delete cover image from Cloudinary
        if (playlist.coverImage.includes("res.cloudinary.com")) {
            const publicId = playlist.coverImage.split("/").pop().split(".")[0];
            await cloudinary.uploader.destroy(publicId);
        }

        await Playlist.findByIdAndDelete(req.params.id);
        res.json({ message: "Playlist deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: "Error deleting playlist", details: error.message });
    }
});

// Add Singer
router.post("/singer", upload.single("picture"), async (req, res) => {
    try {
        const { name, bio } = req.body;
        if (!req.file) return res.status(400).json({ error: "Picture file is required" });

        const pictureUrl = await uploadToCloudinary(req.file.path, "singers");
        const newSinger = new Singer({ name, bio, picture: pictureUrl });
        await newSinger.save();

        res.json({ message: "Singer added", singer: newSinger });
    } catch (error) {
        res.status(500).json({ error: "Error adding singer", details: error.message });
    }
});

module.exports = router;