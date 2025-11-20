// server.js
const express = require('express');
const http = require('http');
const cors = require('cors');
const multer = require('multer');
const path = require('path');

// Multer memory storage (we'll keep file in RAM and convert to dataURL)
const upload = multer({ storage: multer.memoryStorage() });

const app = express();
const server = http.createServer(app);
const io = require('socket.io')(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

// Serve static frontend from "public" folder
app.use(express.static(path.join(__dirname, 'public')));

// In-memory store
const items = [];

/*
 Seeded example item — using the local uploaded file path you provided.
 Your tooling can transform this local path to a hosted URL if needed.
*/
items.push({
  id: 'seed-1',
  title: 'Seeded: Blue backpack',
  description: 'Sample seeded item',
  // <-- your uploaded path as requested (will be served as-is in the response)
  // Transform to a data URL or hosted URL during your deploy if you need it publicly accessible.
  photo: '/mnt/data/433f9e27-efa7-4eea-b25f-cdc423730e1b.png',
  location: { lat: 28.7041, lng: 77.1025 },
  messages: []
});

// GET items (returns current in-memory items)
app.get('/api/items', (req, res) => {
  res.json(items);
});

// POST item (multipart/form-data: title, description, lat, lng, photo)
app.post('/api/items', upload.single('photo'), (req, res) => {
  try {
    const { title, description, lat, lng } = req.body;

    if (!title || !description || !lat || !lng) {
      return res.status(400).json({ error: 'title, description, lat, lng required' });
    }

    let photoData = null;
    if (req.file && req.file.buffer) {
      // Convert buffer to base64 data URL and store in memory
      const mime = req.file.mimetype || 'image/jpeg';
      const base64 = req.file.buffer.toString('base64');
      photoData = `data:${mime};base64,${base64}`;
    }

    const newItem = {
      id: Date.now().toString(),
      title,
      description,
      photo: photoData, // either base64 data URL, or null
      location: { lat: Number(lat), lng: Number(lng) },
      messages: []
    };

    // Add to in-memory array
    items.unshift(newItem);

    // Broadcast to everyone
    io.emit('newItem', newItem);

    return res.status(201).json(newItem);
  } catch (err) {
    console.error('POST /api/items error:', err);
    return res.status(500).json({ error: 'server error' });
  }
});

// For convenience: get single item
app.get('/api/items/:id', (req, res) => {
  const it = items.find(i => i.id === req.params.id);
  if (!it) return res.status(404).json({ error: 'not found' });
  res.json(it);
});

// Socket.io chat & room logic
io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  socket.on('joinRoom', (itemId) => {
    if (!itemId) return;
    const room = `item_${itemId}`;
    socket.join(room);
    // (optional) send current chat history for item to the client
    const item = items.find(i => i.id === String(itemId));
    if (item) {
      socket.emit('chatHistory', { itemId, messages: item.messages || [] });
    }
  });

  socket.on('chatMessage', ({ itemId, user, text }) => {
    if (!itemId || !text) return;
    const item = items.find(i => i.id === String(itemId));
    if (!item) return;

    const msg = { id: Date.now().toString(), user: user || 'Anonymous', text, time: Date.now() };
    item.messages.push(msg);

    // Broadcast message to room
    io.to(`item_${itemId}`).emit('chatMessage', { itemId, message: msg });
  });

  socket.on('disconnect', () => {
    // console.log('Socket disconnected', socket.id);
  });
});

// Start server
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server listening on ${PORT}`));
