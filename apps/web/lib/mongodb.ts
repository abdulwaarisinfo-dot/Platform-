import { MongoClient, type Db } from 'mongodb';

const dbName = process.env.MONGODB_DB_NAME ?? 'platform';

// The URI check is deferred to connection time so Next.js can complete static
// analysis and build steps without a database URI in the environment.
// Any runtime request that actually needs MongoDB will still fail immediately.
declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function createClientPromise(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI environment variable is required');
  if (process.env.NODE_ENV === 'development') {
    if (!global._mongoClientPromise) {
      global._mongoClientPromise = new MongoClient(uri).connect();
    }
    return global._mongoClientPromise;
  }
  return new MongoClient(uri).connect();
}

let _p: Promise<MongoClient> | undefined;

function ensureConnection(): Promise<MongoClient> {
  if (!_p) _p = createClientPromise();
  return _p;
}

export async function getDb(): Promise<Db> {
  const c = await ensureConnection();
  return c.db(dbName);
}

// Lazy thenable — the MongoDB adapter stores this reference and only resolves
// it when it actually needs a connection (during authentication, not at build).
export const clientPromise: Promise<MongoClient> = {
  then:    (res, rej)   => ensureConnection().then(res, rej),
  catch:   (rej)        => ensureConnection().catch(rej),
  finally: (fin)        => ensureConnection().finally(fin),
  [Symbol.toStringTag]: 'Promise',
} as Promise<MongoClient>;
