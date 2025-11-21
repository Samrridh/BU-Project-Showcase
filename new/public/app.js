(async () => {
  const API = '/api';

  const map = L.map('map').setView([28.61, 77.21], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

  const socket = io();

  let userLat = null, userLng = null;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      userLat = pos.coords.latitude;
      userLng = pos.coords.longitude;
      document.getElementById('geoStatus').innerText = `Location detected: ${userLat.toFixed(4)}, ${userLng.toFixed(4)}`;
      map.setView([userLat, userLng], 15);
    },
    () => { document.getElementById('geoStatus').innerText = 'Location not available'; }
  );

  const markers = {};

  async function loadItems() {
    const res = await fetch(API + '/items');
    const items = await res.json();
    renderItems(items);
  }

  function renderItems(items) {
    const container = document.getElementById('itemsList');
    container.innerHTML = '';
    Object.values(markers).forEach(m => map.removeLayer(m));
    Object.keys(markers).forEach(k => delete markers[k]);

    items.forEach(item => {
      const lat = item.location?.lat || 0;
      const lng = item.location?.lng || 0;
      const marker = L.marker([lat, lng]).addTo(map).bindPopup(item.title || item.description || '');
      markers[item.id] = marker;

      const card = document.createElement('div');
      card.className = 'p-3 border rounded flex gap-3';

      const imgSrc = item.photo || '';
      const imgHtml = imgSrc ? `<img src="${imgSrc}" class="w-28 h-20 object-cover rounded" />` : `<div class="w-28 h-20 bg-gray-100 rounded flex items-center justify-center text-sm text-gray-400">No photo</div>`;

      card.innerHTML = `
        ${imgHtml}
        <div class="flex-1">
          <div class="font-semibold">${escapeHtml(item.title || item.description || 'Item')}</div>
          <div class="text-sm text-gray-500">Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}</div>
          <div class="mt-2 flex gap-2">
            <button class="openChatBtn bg-green-600 text-white px-3 py-1 rounded" data-id="${item.id}">Chat</button>
            <button class="focusMarkerBtn bg-gray-200 px-3 py-1 rounded" data-id="${item.id}">Locate</button>
          </div>
          <div class="mt-2 chatBox" id="chatBox-${item.id}"></div>
        </div>
      `;

      container.appendChild(card);

      // populate chat history if present
      const chatBox = document.getElementById(`chatBox-${item.id}`);
      (item.messages || []).forEach(m => {
        const p = document.createElement('div');
        p.className = 'text-sm';
        p.innerText = `${m.user}: ${m.text}`;
        chatBox.appendChild(p);
      });
    });

    document.querySelectorAll('.focusMarkerBtn').forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-id');
        const m = markers[id];
        if (m) map.setView(m.getLatLng(), 18);
      };
    });

    document.querySelectorAll('.openChatBtn').forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-id');
        openChat(id);
      };
    });
  }

  socket.on('newItem', (item) => {
    loadItems();
    console.log('New item:', item.title || item.description);
  });

  // When chatMessage is received for a room, append to that item's chatBox
  socket.on('chatMessage', ({ itemId, message }) => {
    const chatBox = document.getElementById(`chatBox-${itemId}`);
    if (chatBox) {
      const p = document.createElement('div');
      p.className = 'text-sm';
      p.innerText = `${message.user}: ${message.text}`;
      chatBox.appendChild(p);
    }
  });


  document.getElementById('postBtn').addEventListener('click', async () => {
    const title = document.getElementById('title').value.trim();
    const description = document.getElementById('description').value.trim();
    const file = document.getElementById('photo').files[0];

    if (!title || !description || !file) {
      alert('Please enter title, description and choose a photo.');
      return;
    }
    if (userLat === null) {
      alert('Please enable location.');
      return;
    }

    const form = new FormData();
    form.append('title', title);
    form.append('description', description);
    form.append('lat', userLat);
    form.append('lng', userLng);
    form.append('photo', file);

    const res = await fetch(API + '/items', { method: 'POST', body: form });
    if (!res.ok) {
      alert('Upload failed');
      return;
    }

    document.getElementById('title').value = '';
    document.getElementById('description').value = '';
    document.getElementById('photo').value = '';


  });


  document.getElementById('refreshBtn').addEventListener('click', loadItems);


  let openChatRoomId = null;
  function openChat(itemId) {
    openChatRoomId = itemId;
    const username = prompt('Enter your name (visible in chat):') || 'Anonymous';
    const chatDiv = document.querySelector('.chat') || createChatDiv();
    chatDiv.querySelector('.chatTitle').innerText = `Chat — Item ${itemId}`;
    chatDiv.querySelector('.sendBtn').onclick = () => {
      const textInput = chatDiv.querySelector('.chatInput');
      const text = textInput.value.trim();
      if (!text) return;
      socket.emit('chatMessage', { itemId, user: username, text });
      textInput.value = '';
    };


    socket.emit('joinRoom', itemId);
  }

  function createChatDiv() {
    const d = document.createElement('div');
    d.className = 'chat';
    d.innerHTML = `
      <div class="flex justify-between items-center mb-2">
        <div class="chatTitle font-semibold"></div>
        <button class="closeChatBtn text-sm">Close</button>
      </div>
      <div class="chatbox mb-2"></div>
      <div class="flex gap-2">
        <input class="chatInput flex-1 p-1 border rounded" placeholder="Message"/>
        <button class="sendBtn bg-blue-600 text-white px-3 py-1 rounded">Send</button>
      </div>
    `;
    document.body.appendChild(d);
    d.querySelector('.closeChatBtn').onclick = () => d.remove();
    return d;
  }

  function escapeHtml(s = '') {
    return s.replace(/[&<"']/g, m => ({ '&':'&amp;','<':'&lt;','"':'&quot;',"'":'&#039;'}[m]));
  }

  loadItems();
})();
