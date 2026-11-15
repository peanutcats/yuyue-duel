'use strict';
// Load the same simulation used by the static browser release, without a server checkout.
const Y = require('../js/core');
for (const name of ['roster','match','court3d','court3d-skills','court3d-skill-info','ai','court3d-ai']) require('../js/' + name);
module.exports = Y;
