const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors")

const app = express();
app.use(cors());
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", // allow all (change in production)
    methods: ["GET", "POST"],
  },
});

// Map: userId -> socket.id
const users = new Map();

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // User registers with a chosen ID (username, number, etc.)
  socket.on("register", (userId) => {
    if ([...users.values()].includes(socket.id)) {
      // If this socket is already registered with a different userId, remove old entry
      for (let [key, value] of users.entries()) {
        if (value === socket.id) {
          users.delete(key);
        }
      }
    }
    users.set(userId, socket.id);
    socket.userId = userId; // keep for cleanup
    console.log(`User registered: ${userId} -> ${socket.id}`);
    console.log("Current users:", Object.fromEntries(users));
  });

  // Disconnect cleanup
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    if (socket.userId) {
      users.delete(socket.userId);
      console.log(`User unregistered: ${socket.userId}`);
      console.log("Current users:", Object.fromEntries(users));
    }
    // UPDATED: Removed this line. Broadcasting `callEnded` on disconnect
    // can terminate unrelated active calls. It's more robust for the
    // client's `oniceconnectionstatechange` to handle unexpected drops.
    // socket.broadcast.emit("callEnded"); // <-- REMOVED
  });

  // Caller -> send offer to recipient
  socket.on("callUser", ({ to, offer }) => {
    const targetSocketId = users.get(to);
    if (targetSocketId) {
      console.log(`Forwarding call from ${socket.userId} to ${to}`);
      io.to(targetSocketId).emit("incomingCall", {
        from: socket.userId,
        offer,
      });
    } else {
      console.log(`Call failed: User ${to} not found.`);
      io.to(socket.id).emit("noRecipient");
    }
  });

  // --- ALL OTHER SOCKET HANDLERS ARE UNCHANGED ---

  // Recipient -> send answer back to caller
  socket.on("answerCall", ({ to, answer }) => {
    const targetSocketId = users.get(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit("callAnswered", {
        from: socket.userId,
        answer,
      });
    }
  });

  // Recipient rejects
  socket.on("rejectCall", ({ to }) => {
    const targetSocketId = users.get(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit("callRejected", { from: socket.userId });
    }
  });

  // ICE candidate exchange
  socket.on("iceCandidate", ({ to, candidate }) => {
    const targetSocketId = users.get(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit("iceCandidate", {
        from: socket.userId,
        candidate,
      });
    }
  });
  
  // End call
  socket.on("endCall", ({ to }) => {
    const targetSocketId = users.get(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit("callEnded");
    }
  });
  
  // Renegotiation handlers
  socket.on("renegotiateOffer", ({ to, offer }) => {
      const targetSocketId = users.get(to);
      if (targetSocketId) {
          io.to(targetSocketId).emit("renegotiateOffer", { from: socket.userId, offer });
      }
  });

  socket.on("renegotiateAnswer", ({ to, answer }) => {
      const targetSocketId = users.get(to);
      if (targetSocketId) {
          io.to(targetSocketId).emit("renegotiateAnswer", { from: socket.userId, answer });
      }
  });
});

// Run server
const PORT = 4000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));