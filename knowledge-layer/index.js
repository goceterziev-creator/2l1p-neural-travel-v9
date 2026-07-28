"use strict";

module.exports = {
  ...require("./contracts/knowledge-types"),
  ...require("./contracts/knowledge-metadata"),
  ...require("./contracts/canonical-entities"),
  ...require("./mappers/knowledge-mappers"),
  ...require("./shadow/proposal-input-shadow"),
  ...require("./runtime/destination-display-resolver")
};
