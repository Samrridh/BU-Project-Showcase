const express = require('express');
const fs = require('fs-extra');
const multer = require('multer');
const path = require('path');
const http = require('http');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

const io = require('socket.io')(server, {
  cors: { origin: "*" }
});

app.use(cors());
app.use(express.json());

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

// Serve uploaded photos
app.use('/uploads', express.static(uploadsDir));

// JSON file for items
const itemsFile = path.join(__dirname, 'items.json');
fs.ensureFileSync(itemsFile);

let items = [];
if (fs.existsSync(itemsFile)) {
  items = JSON.parse(fs.readFileSync(itemsFile, 'utf8') || "[]");
}

// Multer upload setup
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (req, file, cb) =>
      cb(null, Date.now() + path.extname(file.originalname))
  })
});

// POST item
app.post('/api/items', upload.single('photo'), (req, res) => {
  const { title, description, lat, lng } = req.body;

  const newItem = {
    id: Date.now(),
    title,
    description,
    photo: req.file ? `/uploads/${req.file.filename}` : null,
    location: { lat: Number(lat), lng: Number(lng) },
    messages: []
  };

  items.push(newItem);
  fs.writeFileSync(itemsFile, JSON.stringify(items, null, 2));

  res.json(newItem);
});

// GET all items
app.get('/api/items', (req, res) => {
  res.json(items);
});

// GET single item
app.get('/api/items/:id', (req, res) => {
  const item = items.find(i => i.id == req.params.id);
  res.json(item || {});
});

// SOCKET.IO chat
io.on("connection", socket => {
  console.log("Client connected");

  socket.on("joinRoom", (itemId) => {
    socket.join("room_" + itemId);
  });

  socket.on("chatMessage", ({ itemId, user, text }) => {
    const item = items.find(i => i.id == itemId);
    if (!item) return;

    const msg = { user, text, time: Date.now() };
    item.messages.push(msg);

    fs.writeFileSync(itemsFile, JSON.stringify(items, null, 2));

    io.to("room_" + itemId).emit("chatMessage", msg);
  });
});

// Render gives PORT env variable
const PORT = process.env.PORT || 4000;

server.listen(PORT, () => console.log("Backend running on " + PORT));
