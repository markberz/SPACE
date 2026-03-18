require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from parent directory
app.use(express.static(path.join(__dirname, '..')));

const PORT = process.env.PORT || 3000;
const OPENROUTER_KEY = process.env.OPENROUTER_KEY;

if (!OPENROUTER_KEY) {
  console.error('ERROR: OPENROUTER_KEY not found in .env file');
  console.error('Create a .env file in the server folder with: OPENROUTER_KEY=your_key_here');
  process.exit(1);
}

app.post('/api/openrouter', async (req, res) => {
  const { prompt } = req.body;
  
  if (!prompt) {
    return res.status(400).json({ error: 'Missing prompt' });
  }

  try {
    console.log('Calling OpenRouter API with prompt:', prompt.substring(0, 50) + '...');
    
    const response = await axios.post(
      'https://api.openrouter.ai/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 512
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'SPACE Scheduler'
        },
        timeout: 10000
      }
    );

    console.log('OpenRouter response received');
    res.json(response.data);
  } catch (error) {
    console.error('OpenRouter Error Details:', {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });
    
    // Return actual error to client for debugging
    return res.status(500).json({ 
      error: `API Error: ${error.message}`,
      details: error.response?.data || error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Local OpenRouter proxy running on http://localhost:${PORT}`);
  console.log(`📤 Chat will call: http://localhost:${PORT}/api/openrouter`);
  console.log(`🌐 Open your site at: http://localhost:${PORT}`);
});
