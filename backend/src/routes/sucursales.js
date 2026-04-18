// src/routes/sucursales.js
const express = require('express');
const { supabase } = require('../config/supabase');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('sucursales')
      .select('*')
      .order('id');
    
    if (error) throw error;
    
    res.json(data);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;