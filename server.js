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

api.get('/usuarios', async (req, res) => {
    try{
        const usuarios = await sql`SELECT * FROM usuarios`;
        res.json(usuarios); 
    } catch (error) {
        console.error("Error al obtener usuarios:", error);
        res.status(500).json({ error: 'Error al obtener usuarios' })
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