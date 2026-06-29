const app = require('./app');
require('./cron/expiry-alerts');

// to start the server
const PORT = process.env.PORT || 5001;              
app.listen(PORT, () => {                            
  console.log(`Server running on http://localhost:${PORT}`);
});



// notes:
// Port 5001 (http://localhost:5001): where Node/Express backend lives
// It waits here for requests
// Port 5173 (http://localhost:5173): where Vite frontend lives.