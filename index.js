// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let users = {};

io.on("connection", (socket) => {
  socket.on("register", (number) => {
    users[number] = socket.id;
    io.emit("updateUsers", users);
  });

  socket.on("offer", ({ to, from, offer }) => {
    io.to(users[to]).emit("offer", { from, offer });
  });

  socket.on("answer", ({ to, answer }) => {
    io.to(users[to]).emit("answer", { answer });
  });

  socket.on("ice-candidate", ({ to, candidate }) => {
    io.to(users[to]).emit("ice-candidate", { candidate });
  });

  socket.on("disconnect", () => {
    for (let num in users) {
      if (users[num] === socket.id) delete users[num];
    }
    io.emit("updateUsers", users);
  });
});

server.listen(5000, () => console.log("Server running on 5000"));
