// server/index.js
require('dotenv').config();          

const express = require('express'); 
const cors = require('cors');        

const app = express();              



// note: Middleware = a function that runs on every incoming request before it reaches the route
// tells the browser "requests from the React app at :5173 are allowed"
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());                            


// sample route
app.get('/api/v1/health', (req, res) => {           
  res.json({ status: 'ok', message: 'ByteBite API is ok' });
});


// to start the server
const PORT = process.env.PORT || 5000;              
app.listen(PORT, () => {                            
  console.log(`Server running on http://localhost:${PORT}`);
});



// notes:
// Port 5000 (http://localhost:5000): where Node/Express backend lives
// It waits here for requests
// Port 5173 (http://localhost:5173): where Vite frontend lives.