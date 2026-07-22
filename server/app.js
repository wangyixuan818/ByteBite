// defines the app
require('dotenv').config();          

const pool = require('./db');

const express = require('express'); 
const cors = require('cors');        

const app = express();              

const authRoutes = require('./routes/auth');
const itemsRoutes = require('./routes/items');
const foodTypesRoutes = require('./routes/foodTypes');
const notificationsRoutes = require('./routes/notifications');
const categoriesRoutes = require('./routes/categories');
const recipesRoutes = require('./routes/recipes');
const brandProductsRoutes = require('./routes/brandProducts');
const fridgesRoutes = require('./routes/fridges');
const storageSectionsRoutes = require('./routes/storageSections');

// note: Middleware = a function that runs on every incoming request before it reaches the route
// make cors origin configurable via env var, default to localhost:5173 for dev
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());                            

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/items', itemsRoutes);
app.use('/api/v1/food-types', foodTypesRoutes);
app.use('/api/v1/notifications', notificationsRoutes);
app.use('/api/v1/categories', categoriesRoutes);
app.use('/api/v1/recipes', recipesRoutes);
app.use('/api/v1/brand-products', brandProductsRoutes);
app.use('/api/v1/fridges', fridgesRoutes);
app.use('/api/v1/storage-sections', storageSectionsRoutes);

// sample route
app.get('/api/v1/health', (req, res) => {           
  res.json({ status: 'ok', message: 'ByteBite API is ok' });
});


app.get('/api/v1/db-check', async (req, res) => {    
  try {
    const result = await pool.query('SELECT now()');
    res.json({ connected: true, time: result.rows[0].now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ connected: false, error: err.message });
  }
});
 
// export the app
module.exports = app;
