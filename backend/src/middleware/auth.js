/**
 * Simple API key middleware.
 * All requests must include: x-api-key: <API_KEY>
 */
function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!key || key !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

module.exports = { requireApiKey };
