// 🔥 IMPORTANT: Replace with your Render backend URL
const API = "https://bu-project-showcase.onrender.com";

async function submitItem() {
  const form = new FormData();
  form.append("title", document.getElementById("title").value);
  form.append("description", document.getElementById("description").value);
  form.append("lat", document.getElementById("lat").value);
  form.append("lng", document.getElementById("lng").value);
  form.append("photo", document.getElementById("photo").files[0]);

  const res = await fetch(API + "/items", { method: "POST", body: form });
  alert("Item posted!");
  loadItems();
}

// MAP
let map = L.map("map").setView([28.61, 77.21], 13);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

// LOAD ITEMS
async function loadItems() {
  const res = await fetch(API + "/items");
  const data = await res.json();
  document.getElementById("items").innerHTML = "";

  data.forEach(item => {
    let card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <h4>${item.title}</h4>
      <img src="https://your-backend-name.onrender.com${item.photo}" width="150">
      <p>${item.description}</p>
      <button onclick="openChat(${item.id})">Chat</button>
    `;

    document.getElementById("items").appendChild(card);

    L.marker([item.location.lat, item.location.lng])
      .addTo(map)
      .bindPopup(item.title);
  });
}

loadItems();


// ---------------- CHAT ----------------
let currentSocket = null;

function openChat(id) {
  const username = prompt("Enter your name:");
  if (!username) return;

  if (currentSocket) currentSocket.disconnect();

  // Connect to Render WebSocket backend
  currentSocket = io("https://your-backend-name.onrender.com");
  currentSocket.emit("joinRoom", id);

  const chatDiv = document.createElement("div");
  chatDiv.className = "chat";
  chatDiv.innerHTML = `
    <h3>Chat for Item ${id}</h3>
    <div id="chatBox" class="chatbox"></div>
    <input id="chatInput" placeholder="Message">
    <button onclick="sendChat(${id}, '${username}')">Send</button>
  `;
  document.body.appendChild(chatDiv);

  currentSocket.on("chatMessage", msg => {
    const box = document.getElementById("chatBox");
    box.innerHTML += `<p><b>${msg.user}:</b> ${msg.text}</p>`;
    box.scrollTop = box.scrollHeight;
  });
}

function sendChat(id, user) {
  const text = document.getElementById("chatInput").value;
  currentSocket.emit("chatMessage", { itemId: id, user, text });
  document.getElementById("chatInput").value = "";
}
