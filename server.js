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