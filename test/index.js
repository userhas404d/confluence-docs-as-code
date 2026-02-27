import dotenv from 'dotenv';
import path from 'node:path';
import { use, should, expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import nock from 'nock';

// extends Chai with a fluent language for asserting facts about promises.
use(chaiAsPromised);

// add should style assertions to global scope
should();
expect();

// load env variables from fixtures 
dotenv.config({ path: path.resolve('test/fixtures/.env.test') });

// disable real HTTP request
nock.disableNetConnect();
