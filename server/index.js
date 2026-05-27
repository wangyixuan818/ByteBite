require('dotenv').config();          

const pool = require('./db');

const express = require('express'); 
const cors = require('cors');        

const app = express();              

const authRoutes = require('./routes/auth');
const itemsRoutes = require('./routes/items');


// note: Middleware = a function that runs on every incoming request before it reaches the route
// tells the browser "requests from the React app at :5173 are allowed"
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());                            

app.use('/api/v1/auth', authRoutes);

app.use('/api/v1/items', itemsRoutes);


// sample route
app.get('/api/v1/health', (req, res) => {           
  res.json({ status: 'ok', message: 'ByteBite API is ok' });
});


app.get('/api/v1/db-check', async (req, res) => {     // ← ADD THIS WHOLE ROUTE
  try {
    const result = await pool.query('SELECT now()');
    res.json({ connected: true, time: result.rows[0].now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ connected: false, error: err.message });
  }
});
 


// to start the server
const PORT = process.env.PORT || 5001;              
app.listen(PORT, () => {                            
  console.log(`Server running on http://localhost:${PORT}`);
});



// notes:
// Port 5001 (http://localhost:5001): where Node/Express backend lives
// It waits here for requests
// Port 5173 (http://localhost:5173): where Vite frontend lives.