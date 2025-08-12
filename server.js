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

api.use(cors());
api.use(express.json()); 

api.get('/', (req, res) => {
    res.send("Conexión exitosa");
});

io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);

    socket.on('ubicacion_repartidor', (data) => {
        console.log('Evento ubicacion_repartidor recibido');
        console.log('Ubicación recibida del deliveryId:', data.deliveryId);
        console.log('Datos completos recibidos:', data);
        repartidoresUbicaciones[data.deliveryId] = { ...data.ubicacion, socketId: socket.id };
        io.emit('ubicacion_repartidor', data);
    });


  socket.on('obtener_ubicaciones', () => {
    socket.emit('ubicaciones_actuales', repartidoresUbicaciones);
  });

  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
    for (const [id, ubicacion] of Object.entries(repartidoresUbicaciones)) {
      if (ubicacion.socketId === socket.id) {
        delete repartidoresUbicaciones[id];
      }
    }
  });
});

api.get('/delivery', async (req, res) => {
    try {
        const usuarios = await sql`
            SELECT * FROM usuarios WHERE role = 'delivery'
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