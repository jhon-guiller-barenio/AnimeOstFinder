module.exports = function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({error: 'Method not allowed.'});
  }

  const publishableKey = process.env.CLERK_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '';
  const secretKey = process.env.CLERK_SECRET_KEY || '';
  if (!/^pk_(test|live)_/.test(publishableKey) || !/^sk_(test|live)_/.test(secretKey)) {
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
