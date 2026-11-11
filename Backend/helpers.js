// Small helper functions shared by the route files.

// An error that carries an HTTP status code, e.g. throw new HttpError(409, 'Out of stock.')
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Turns "5" into 5. Returns null if the value is not a whole number of at least 1.
function parseId(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 2147483647) {
    return null;
  }
  return number;
}

// Sends the right answer for an error caught in a route.
function sendError(res, err) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong.' });
}

// Prices are kept in paise (whole numbers) while adding up, so there are no rounding surprises.
function toCents(price) {
  return Math.round(Number(price) * 100);
}

module.exports = { HttpError, parseId, sendError, toCents };
