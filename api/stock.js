export default async function handler(req, res) {
  const { symbol } = req.query;
  
  if (!symbol || typeof symbol !== 'string') {
    return res.status(400).json({ error: 'Missing symbol parameter' });
  }

  try {
    const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d`;
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch from Yahoo Finance' });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
