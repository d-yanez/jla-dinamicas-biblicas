// Entry point loaded by index.html. Kept separate from app.js so every other module
// can be imported in a plain Node process (tests, smoke checks) without touching
// the document.

import { bootstrap } from "./app.js";

void bootstrap();
