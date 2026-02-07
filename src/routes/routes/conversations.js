const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// Listar mensagens (inbound + outbound)
router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(50);

    if (error) throw error;

    return res.json({
      count: data.length,
      messages: data
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
