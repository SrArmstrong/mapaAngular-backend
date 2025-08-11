import express from 'express';
import sql from './db.js'; // Importando la conexión a la base de datos
import cors from 'cors';

const PORT = 3001;
const api = express();

api.use(cors());
api.use(express.json()); 

api.get('/', (req, res) => {
    res.send("Conexión exitosa");
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

api.get('/paquetes', async (req, res) => {
    try{
        const paquetes = await sql`
            SELECT * FROM paquetes
        `;

        if (paquetes.length > 0) {
            res.json({ mensaje: 'Paquetes encontrados', paquetes });
        } else {
            res.status(404).json({ mensaje: 'No se encontraron paquetes' });
        }
    } catch (error) {
        console.error("Error con la consulta:", error);
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

api.post('/addPaquetes', async (req, res) => {
  try {
    const { direccion, estatus, delivery_id } = req.body;

    if (!direccion || !estatus) {
      return res.status(400).json({ mensaje: 'Faltan datos obligatorios' });
    }

    const result = await sql`
      INSERT INTO entregas (direccion, estatus, delivery_id)
      VALUES (${direccion}, ${estatus}, ${delivery_id})
      RETURNING *;
    `;

    res.status(201).json({ mensaje: 'Paquete creado', paquete: result[0] });
  } catch (error) {
    console.error("Error al crear paquete:", error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// PUT - Actualizar solo el estatus del paquete
api.put('/paquetes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { estatus } = req.body;

    const estadosValidos = ['En camino', 'Entregado', 'Cancelado'];

    if (!estatus || !estadosValidos.includes(estatus)) {
      return res.status(400).json({ mensaje: 'Estatus inválido. Debe ser uno de: "En camino", "Entregado", "Cancelado"' });
    }

    const result = await sql`
      UPDATE entregas
      SET estatus = ${estatus}
      WHERE id = ${id}
      RETURNING *;
    `;

    if (result.length === 0) {
      return res.status(404).json({ mensaje: 'Paquete no encontrado' });
    }

    res.json({ mensaje: 'Estatus actualizado', paquete: result[0] });
  } catch (error) {
    console.error("Error al actualizar estatus:", error);
    res.status(500).json({ error: 'Error en el servidor' });
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

api.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});