const {neon} = require('@neondatabase/serverless');

let sqlClient;
function getSql() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured.');
  if (!sqlClient) sqlClient = neon(process.env.DATABASE_URL);
  return sqlClient;
}

module.exports = {getSql};
