// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
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
    // Check if userId is already taken
    if ([...users.keys()].includes(userId)) {
        // You might want to emit an error back to the client
        console.log(`User ID ${userId} is already taken.`);
        return;
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
    // Inform the other user in a call that the call has ended
    socket.broadcast.emit("callEnded");
  });

  // Caller -> send offer to recipient
  socket.on("callUser", ({ to, offer }) => {
    const targetSocketId = users.get(to);
    if (targetSocketId) {
      console.log(`Forwarding call from ${socket.userId} to ${to}`);
      // 1. Tell recipient about the incoming call
      io.to(targetSocketId).emit("incomingCall", {
        from: socket.userId,
        offer,
      });
      // **FIX**: 2. Tell the caller that the call is ringing the intended recipient
      io.to(socket.id).emit("callRinging", { to: to });
    } else {
      console.log(`Call failed: User ${to} not found.`);
      io.to(socket.id).emit("noRecipient");
    }
  });

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
      // Inform the specific user that the call has ended
      io.to(targetSocketId).emit("callEnded");
    }
  });
  
  // Renegotiation handlers are fine, no changes needed
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