// This script sets up a simple backend proxy server using Node.js and Express to handle CORS issues.
// It fetches data from a target URL and makes it available to the frontend.

const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Enable CORS for all requests
app.use(cors());

// Define a route to proxy the request
app.get('/proxy', async (req, res) => {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).send('Missing URL parameter');
  }

  try {
    const response = await axios.get(targetUrl);
    res.send(response.data);
  } catch (error) {
    console.error('Error fetching data:', error.message);
    res.status(500).send('Error fetching data');
  }
});

app.listen(PORT, () => {
  console.log(`Proxy server is running on http://localhost:${PORT}`);
});

// Usage:
// Start this server and use it as a proxy by making requests to:
// http://localhost:3000/proxy?url=<target_url>
// Replace <target_url> with the URL you want to fetch, such as the NRW business map website.