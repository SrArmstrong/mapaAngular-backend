const express = require('express');
const api = express();

const PORT = 3001;

api.get('/', (req, res) => {
    res.send("Conexión exitosa");
});

api.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});