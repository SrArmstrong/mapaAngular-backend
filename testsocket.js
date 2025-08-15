import { io } from "socket.io-client";

/*
const socket = io("https://72.60.31.237/proyecto1/api", {
  path: "/proyecto1/api/socket.io",
  transports: ["websocket", "polling"],
  rejectUnauthorized: false // Solo si tienes certificado self-signed
});
*/

const socket = io("https://72.60.31.237", {
  path: "/proyecto1/api/socket.io/",
  transports: ["websocket", "polling"],
  rejectUnauthorized: false
});

socket.on("connect", () => {
  console.log("✅ Conectado al servidor:", socket.id);

  // Enviar un mensaje de prueba
  socket.emit("ubicacion_repartidor", {
    deliveryId: 123,
    ubicacion: { lat: 10.123, lng: -84.123 }
  });
});

socket.on("connect_error", (err) => {
  console.error("❌ Error de conexión:", err.message);
});

socket.on("disconnect", () => {
  console.log("🔌 Desconectado del servidor");
});
