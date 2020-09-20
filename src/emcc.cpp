// @@@ copyright header

#include <cstdio>
#include <cstdlib>
#include <quick-lint-js/char8.h>
#include <quick-lint-js/lint.h>
#include <quick-lint-js/padded-string.h>
#include <quick-lint-js/parse.h>
#include <quick-lint-js/vim-qflist-json-error-reporter.h>
#include <sstream>
#include <string>

namespace quick_lint_js {
  // @@@ .h file
extern "C" char8 *quick_lint_js_parse_and_lint_to_json(const char8 *input);

char8 *quick_lint_js_parse_and_lint_to_json(const char8 *raw_input) {
  std::ostringstream output;
  padded_string input(raw_input);
  vim_qflist_json_error_reporter error_reporter(output);
  error_reporter.set_source(&input, "<web>");

  parser p(&input, &error_reporter);
  linter l(&error_reporter);
  p.parse_and_visit_module(l);
  error_reporter.finish();

  std::string output_string = std::move(output).str();
  char8* raw_output = reinterpret_cast<char8*>(std::malloc((output_string.size() + 1) * sizeof(char8)));
  std::memcpy(raw_output, output_string.data(), output_string.size() + 1);
  return raw_output;
}
}
