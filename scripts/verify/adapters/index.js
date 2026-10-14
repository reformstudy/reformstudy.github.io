import kjv from './kjv.js';
import bsb from './bsb.js';
import wcf from './wcf.js';
import { greek, hebrew } from './strongs.js';

/** Resources with a verification adapter. Henry has no reachable witness yet. */
export const ADAPTERS = Object.fromEntries([kjv, bsb, wcf, greek, hebrew].map(a => [a.resource, a]));
