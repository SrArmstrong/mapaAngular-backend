import express from 'express';
import sql from './db.js'; // Importando la conexión a la base de datos
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';

const PORT = 3001;
const api = express();
const server = http.createServer(api);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:4200"], // Añade aquí tu URL de desarrollo
    methods: ["GET", "POST"],
    credentials: true
  }
});

const repartidoresUbicaciones = {};
const deliverySockets = {}; 

api.use(cors());
api.use(express.json()); 

api.get('/', (req, res) => {
    res.send("Conexión exitosa");
});

io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);
  
  // Manejar autenticación/identificación del repartidor
  socket.on('identificar_repartidor', (deliveryId) => {
    if (!deliveryId) return;
    
    // Guardar referencia del socket por deliveryId
    deliverySockets[deliveryId] = socket.id;
    
    console.log(`Repartidor ${deliveryId} identificado con socket ${socket.id}`);
    
    // Notificar a otros clientes sobre nuevo repartidor conectado
    socket.broadcast.emit('repartidor_conectado', deliveryId);
  });

  // Manejar actualizaciones de ubicación
  socket.on('ubicacion_repartidor', (data) => {
    if (!data.deliveryId || !data.ubicacion) {
      return console.warn('Datos incompletos recibidos:', data);
    }

    // Validar coordenadas
    if (!isValidCoordinate(data.ubicacion.lat) || !isValidCoordinate(data.ubicacion.lng)) {
      return console.warn('Coordenadas inválidas:', data.ubicacion);
    }

    console.log(`Actualización ubicación repartidor ${data.deliveryId}:`, data.ubicacion);
    
    // Actualizar ubicación con timestamp
    repartidoresUbicaciones[data.deliveryId] = { 
      ...data.ubicacion, 
      socketId: socket.id,
      lastUpdated: new Date().toISOString()
    };
    
    // Emitir a todos los clientes excepto al emisor
    socket.broadcast.emit('ubicacion_repartidor', {
      deliveryId: data.deliveryId,
      ubicacion: data.ubicacion
    });
  });

  // Proporcionar ubicaciones actuales cuando se soliciten
  socket.on('obtener_ubicaciones', (callback) => {
    // Usar callback para respuesta directa
    if (typeof callback === 'function') {
      callback(repartidoresUbicaciones);
    }
  });

  // Manejar desconexiones
  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
    
    // Encontrar y limpiar repartidor desconectado
    for (const [deliveryId, ubicacion] of Object.entries(repartidoresUbicaciones)) {
      if (ubicacion.socketId === socket.id) {
        delete repartidoresUbicaciones[deliveryId];
        
        // Notificar a otros clientes
        io.emit('repartidor_desconectado', Number(deliveryId));
        console.log(`Repartidor ${deliveryId} marcado como desconectado`);
        break;
      }
    }
    
    // Limpiar de deliverySockets
    for (const [id, sockId] of Object.entries(deliverySockets)) {
      if (sockId === socket.id) {
        delete deliverySockets[id];
        break;
      }
    }
  });

  // Heartbeat para conexiones activas
  const heartbeatInterval = setInterval(() => {
    if (socket.connected) {
      socket.emit('heartbeat');
    } else {
      clearInterval(heartbeatInterval);
    }
  }, 30000);

  socket.on('pong', () => {
    console.log(`Heartbeat recibido de ${socket.id}`);
  });
});

// Función de validación de coordenadas
function isValidCoordinate(coord) {
  return typeof coord === 'number' && !isNaN(coord) && Math.abs(coord) <= 90;
}

api.get('/delivery', async (req, res) => {
    try {
        const usuarios = await sql`
            SELECT * FROM usuarios WHERE role = 'delivery' ORDER BY id
        `;

        if (usuarios.length > 0) {
            res.json({ mensaje: 'Usuarios encontrados', usuarios});
        } else {
            res.status(404).json({ mensaje: 'No se encontraron deliverys' });
        }

    } catch (error) {
        console.error("Error con la consulta:", error);
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

// Endpoint para actualizar el estado de un delivery
api.put('/updateDeliveryState/:deliveryId', async (req, res) => {
    try {
        const { deliveryId } = req.params;
        const { state } = req.body;

        if (!state) {
            return res.status(400).json({ error: 'El estado es obligatorio' });
        }

        const updatedDelivery = await sql`
            UPDATE usuarios 
            SET state = ${state} 
            WHERE id = ${deliveryId} AND role = 'delivery'
            RETURNING id, username, role, state
        `;

        if (updatedDelivery.length === 0) {
            return res.status(404).json({ error: 'Delivery no encontrado o no es un repartidor' });
        }

        res.json({ delivery: updatedDelivery[0] });
    } catch (error) {
        console.error("Error al actualizar estado del delivery:", error);
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

// Endpoint para obtener paquetes sin asignar
api.get('/packages', async (req, res) => {
    try {
        const paquetes = await sql`
            SELECT * FROM paquetes WHERE deliveryid IS NULL
        `;
        res.json({ paquetes });
    } catch (error) {
        console.error("Error al obtener paquetes:", error);
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

// Obtener paquetes asignados a un delivery específico
api.get('/packages/delivery/:deliveryId', async (req, res) => {
    try {
        const { deliveryId } = req.params;
        const paquetes = await sql`
            SELECT * FROM paquetes WHERE deliveryid = ${deliveryId}
        `;
        res.json({ paquetes });
    } catch (error) {
        console.error("Error al obtener paquetes del delivery:", error);
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

api.put('/updatePackageStatus/:packageId', async (req, res) => {
    try {
        const { packageId } = req.params;
        const { estatus } = req.body;
        
        const updatedPackage = await sql`
            UPDATE paquetes 
            SET estatus = ${estatus} 
            WHERE id = ${packageId}
            RETURNING *
        `;
        
        res.json({ paquete: updatedPackage[0] });
    } catch (error) {
        console.error("Error al actualizar paquete:", error);
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

// Endpoint para crear paquetes
api.post('/addPackages', async (req, res) => {
    try {
        const { direccion } = req.body;

        if (!direccion) {
            return res.status(400).json({ error: 'La dirección es obligatoria' });
        }

        const result = await sql`
            INSERT INTO paquetes (id, direccion, estatus)
            VALUES (DEFAULT, ${direccion}, 'En espera')
            RETURNING id, direccion, estatus, deliveryid
        `;

        res.status(201).json({ paquete: result[0] });
    } catch (error) {
        console.error("Error al crear paquete:", error);
        res.status(500).json({ error: 'Error al crear paquete' });
    }
});

// Endpoint para asignar paquete a repartidor
api.put('/assignPackage/:packageId', async (req, res) => {
    try {
        const { packageId } = req.params;
        const { delivery_id } = req.body;

        if (!delivery_id) {
            return res.status(400).json({ error: 'El ID del repartidor es obligatorio' });
        }

        const result = await sql`
            UPDATE paquetes
            SET deliveryid = ${delivery_id}, estatus = 'En camino'
            WHERE id = ${packageId} AND deliveryid IS NULL
            RETURNING id, direccion, estatus, deliveryid
        `;

        if (result.length === 0) {
            return res.status(404).json({ error: 'Paquete no encontrado o ya asignado' });
        }

        res.json({ paquete: result[0] });
    } catch (error) {
        console.error("Error al asignar paquete:", error);
        res.status(500).json({ error: 'Error al asignar paquete' });
    }
});

api.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const usuario = await sql`
            SELECT * FROM usuarios WHERE username = ${username} AND password = ${password}
        `; // Consulta a realizar para verificar usuario

        if (usuario.length > 0) {
            res.json({ mensaje: 'Login exitoso', usuario: usuario[0] });
        } else {
            res.status(401).json({ mensaje: 'Credenciales incorrectas' });
        }

    } catch (error) {
        console.error("Error en login:", error);
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

server.listen(3000, () => {
  console.log('Servidor corriendo en http://localhost:3000');
});