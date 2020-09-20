let qljs = require("./build-emscripten/src/quick-lint-js-emcc.js");

qljs().then((qljs) => {
  let hello = qljs.cwrap('quick_lint_js_parse_and_lint_to_json', 'string', ['string']);
  let json = hello("input");
  console.log(JSON.parse(json));
});
