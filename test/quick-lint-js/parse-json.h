// quick-lint-js finds bugs in JavaScript programs.
// Copyright (C) 2020  Matthew Glazar
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

#ifndef QUICK_LINT_JS_PARSE_JSON_H
#define QUICK_LINT_JS_PARSE_JSON_H

#include <iosfwd>
#include <json/value.h>
#include <simdjson.h>
#include <string>

namespace quick_lint_js {
::Json::Value parse_json(std::stringstream &);
::Json::Value parse_json(const std::string &);
bool parse_json(std::string_view json, ::Json::Value *result,
                ::Json::String *errors);
#if QLJS_HAVE_CHAR8_T
bool parse_json(string8_view json, ::Json::Value *result,
                ::Json::String *errors);
#endif

::Json::Value simdjson_to_jsoncpp(const ::simdjson::dom::element &);
::Json::Value simdjson_to_jsoncpp(
    ::simdjson::simdjson_result<::simdjson::dom::element> &&);
}

#endif
