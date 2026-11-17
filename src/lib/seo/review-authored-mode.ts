import { AUTHORED_MODE_ENV } from "./publish";

/*
 * A side-effect import: put it FIRST in a script or a test that imports review-manifest.ts, so the page copy is evaluated
 * in authored mode (every link present) before anything reads it. See publish.ts, isLinkable.
 */
process.env[AUTHORED_MODE_ENV] = "authored";
