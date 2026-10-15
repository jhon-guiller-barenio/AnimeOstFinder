module.exports = function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({error: 'Method not allowed.'});
  }

  const publishableKeys = [
    process.env.CLERK_PUBLISHABLE_KEY,
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  ].map(key => (key || '').trim());
  const secretKey = (process.env.CLERK_SECRET_KEY || '').trim();
  const secretMode = /^sk_(test|live)_/.exec(secretKey)?.[1];
  const publishableKey = publishableKeys.find(key => {
    const publishableMode = /^pk_(test|live)_/.exec(key)?.[1];
    return publishableMode && publishableMode === secretMode;
  });
  if (!publishableKey || !secretMode) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).json({configured: false});
  }

  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(200).json({
    configured: true,
    publishableKey,
    proxyUrl: process.env.CLERK_PROXY_URL || 'https://sakurasound.vercel.app/__clerk'
  });
};
