// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let users = {}; // { number: socketId }

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  socket.on("register", (number) => {
    users[number] = socket.id;
    io.emit("users", Object.keys(users)); // send updated list
  });

  socket.on("call-user", ({ from, to }) => {
    if (users[to]) {
      io.to(users[to]).emit("incoming-call", { from });
    } else {
      io.to(users[from]).emit("user-unavailable", { to });
    }
  });

  socket.on("call-response", ({ from, to, accepted }) => {
    if (users[to]) {
      io.to(users[to]).emit("call-response", { from, accepted });
    }
  });

  socket.on("offer", ({ to, offer }) => {
    if (users[to]) {
      io.to(users[to]).emit("offer", { offer, from: socket.id });
    }
  });

  socket.on("answer", ({ to, answer }) => {
    if (users[to]) {
      io.to(users[to]).emit("answer", { answer, from: socket.id });
    }
  });

  socket.on("ice-candidate", ({ to, candidate }) => {
    if (users[to]) {
      io.to(users[to]).emit("ice-candidate", { candidate });
    }
  });

  socket.on("disconnect", () => {
    for (let number in users) {
      if (users[number] === socket.id) {
        delete users[number];
        break;
      }
    }
    io.emit("users", Object.keys(users));
  });
});

server.listen(5000, () => console.log("Server running on :5000"));
