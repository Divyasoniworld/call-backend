// server.js

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let users = {}; // Stores { 'phoneNumber': 'socketId' }

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on("register", (number) => {
    console.log(`Registering ${number} to ${socket.id}`);
    users[number] = socket.id;
    io.emit("updateUsers", Object.keys(users)); // Send only online numbers
  });

  socket.on("offer", ({ to, from, offer }) => {
    console.log(`Offer from ${from} to ${to}`);
    io.to(users[to]).emit("offer", { from, offer });
  });

  socket.on("answer", ({ to, answer }) => {
    console.log(`Answer to ${to}`);
    io.to(users[to]).emit("answer", { answer });
  });

  socket.on("ice-candidate", ({ to, candidate }) => {
    if (users[to]) {
      io.to(users[to]).emit("ice-candidate", { candidate });
    }
  });

  socket.on("endCall", (to) => {
    if (users[to]) {
      io.to(users[to]).emit("callEnded");
    }
  });

  socket.on("rejectCall", (to) => {
    if (users[to]) {
      io.to(users[to]).emit("callRejected");
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    for (let num in users) {
      if (users[num] === socket.id) {
        delete users[num];
      }
    }
    io.emit("updateUsers", Object.keys(users));
  });
});

server.listen(5000, () => console.log("Server running on port 5000"));