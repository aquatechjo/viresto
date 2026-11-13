// Preloaded by `npm run test:unit` (--import), before any test module.
//
// @prisma/client loads the developer's .env into process.env when it is
// first imported, so a local sandbox setting would leak into unit tests.
// Prisma (dotenv) never overrides a variable that is already set, so
// setting these to "" here keeps them out. Tests that need one pass it
// explicitly (e.g. tests/unit/polar-products.test.ts).
//
// POLAR_PRODUCT_IDS: the sandbox product map (src/lib/polar-products.ts);
// with it, billing route tests would run on sandbox product ids.
process.env.POLAR_PRODUCT_IDS = "";
