require('dotenv').config();

// swaps database url to testing database
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;


// to swap jwt secret to testing one
if (process.env.TEST_JWT_SECRET) {
    process.env.JWT_SECRET = process.env.TEST_JWT_SECRET;
}
