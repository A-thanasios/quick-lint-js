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

import assert from "assert";
import jsdom from "jsdom";
import {getEditorText, markEditorText, sanitizeMarks} from "./editor.mjs";

let dom = new jsdom.JSDOM("");

let tests = {
  "text of pre with <br> for newlines": () => {
    let editor = dom.window.document.createElement("pre");
    editor.innerHTML = "hello<br>world";
    let text = getEditorText(editor, dom.window);
    assert.strictEqual(text, "hello\nworld");
  },
  "text of pre with LF for newlines": () => {
    let editor = dom.window.document.createElement("pre");
    editor.innerHTML = "hello\nworld";
    let text = getEditorText(editor, dom.window);
    assert.strictEqual(text, "hello\nworld");
  },
  "text of pre with consecutive LF for newlines": () => {
    let editor = dom.window.document.createElement("pre");
    editor.innerHTML = "hello\n\n\nworld";
    let text = getEditorText(editor, dom.window);
    assert.strictEqual(text, "hello\n\n\nworld");
  },
  "text of pre with separate LF text nodes for newlines": () => {
    let editor = dom.window.document.createElement("pre");
    for (let nodeText of ["one", "\n", "two", "\n", "\n", "three"]) {
      editor.appendChild(dom.window.document.createTextNode(nodeText));
    }
    let text = getEditorText(editor, dom.window);
    assert.strictEqual(text, "one\ntwo\n\nthree");
  },
  "text of pre with text nodes with trailing LF": () => {
    let editor = dom.window.document.createElement("pre");
    for (let nodeText of ["one", "two\n", "\n", "three\n", "four"]) {
      editor.appendChild(dom.window.document.createTextNode(nodeText));
    }
    let text = getEditorText(editor, dom.window);
    assert.strictEqual(text, "onetwo\n\nthree\nfour");
  },
  "text of pre with <mark>": () => {
    let editor = dom.window.document.createElement("pre");
    editor.innerHTML = "hello<mark>world</mark>!";
    let text = getEditorText(editor, dom.window);
    assert.strictEqual(text, "helloworld!");
  },
  "text of pre with LF in <mark>": () => {
    let editor = dom.window.document.createElement("pre");
    editor.innerHTML = "one<mark>two\nthree</mark>";
    let text = getEditorText(editor, dom.window);
    assert.strictEqual(text, "onetwo\nthree");
  },

  "mark first word on line": () => {
    let editor = dom.window.document.createElement("pre");
    editor.innerHTML = "hello world";
    markEditorText(editor, dom.window, [{begin: 0, end: 5}]);
    assert.strictEqual(editor.innerHTML, "<mark>hello</mark> world");
  },

  "mark last word on line": () => {
    let editor = dom.window.document.createElement("pre");
    editor.innerHTML = "hello world";
    markEditorText(editor, dom.window, [{begin: 6, end: 11}]);
    assert.strictEqual(editor.innerHTML, "hello <mark>world</mark>");
  },

  "mark across two text nodes": () => {
    let editor = dom.window.document.createElement("pre");
    editor.appendChild(dom.window.document.createTextNode("hello"));
    editor.appendChild(dom.window.document.createTextNode("world"));
    markEditorText(editor, dom.window, [{begin: 3, end: 8}]);
    assert.strictEqual(editor.innerHTML, "hel<mark>lowor</mark>ld");
  },

  "marking deletes existing non-overlapping marks": () => {
    let editor = dom.window.document.createElement("pre");
    editor.innerHTML = "<mark>hello</mark> world";
    markEditorText(editor, dom.window, [{begin: 6, end: 11}]);
    assert.strictEqual(editor.innerHTML, "hello <mark>world</mark>");
  },

  "marking with no marks deletes existing marks": () => {
    let editor = dom.window.document.createElement("pre");
    editor.innerHTML = "<mark>hello</mark> <mark>world</mark>";
    markEditorText(editor, dom.window, []);
    assert.strictEqual(editor.innerHTML, "hello world");
  },

  "multiple new marks": () => {
    let editor = dom.window.document.createElement("pre");
    editor.innerHTML = "hello world";
    markEditorText(editor, dom.window, [{begin: 0, end: 5}, {begin: 6, end: 11}]);
    assert.strictEqual(editor.innerHTML, "<mark>hello</mark> <mark>world</mark>");
  },

  "marking preserves fully-contained selection": () => {
    let editor = dom.window.document.createElement("pre");
    editor.innerHTML = "oneTWOthree";
    let selectionRange = dom.window.document.createRange();
    selectionRange.setStart(editor.firstChild, 3);
    selectionRange.setEnd(editor.firstChild, 6);
    assert.strictEqual(selectionRange.toString(), "TWO");

    markEditorText(editor, dom.window, [{begin: 0, end: "oneTWOthree".length}], selectionRange);

    assert.strictEqual(selectionRange.toString(), "TWO");
  },

  "marking preserves fully-contained selection if text is split": () => {
    let editor = dom.window.document.createElement("pre");
    editor.innerHTML = "abcde";
    let selectionRange = dom.window.document.createRange();
    selectionRange.setStart(editor.firstChild, 2);
    selectionRange.setEnd(editor.firstChild, 3);
    assert.strictEqual(selectionRange.toString(), "c");

    markEditorText(editor, dom.window, [{begin: 1, end: 4}], selectionRange);

    assert.strictEqual(editor.innerHTML, "a<mark>bcd</mark>e");
    assert.strictEqual(selectionRange.toString(), "c");
  },

  "marking preserves selection contained in removed <mark> text node": () => {
    let editor = dom.window.document.createElement("pre");
    editor.innerHTML = "<mark>hello</mark> world";
    let selectionRange = dom.window.document.createRange();
    selectionRange.setStart(editor.firstChild.firstChild, 1);
    selectionRange.setEnd(editor.firstChild.firstChild, 4);
    assert.strictEqual(selectionRange.toString(), "ell");

    markEditorText(editor, dom.window, [{begin: 6, end: 11}], selectionRange);

    assert.strictEqual(editor.innerHTML, "hello <mark>world</mark>");
    assert.strictEqual(selectionRange.toString(), "ell");
  },

  "marking preserves selection contained in removed <mark>": () => {
    // <pre><mark>abcdefg</mark> world</pre>
    let editor = dom.window.document.createElement("pre");
    let markElement = dom.window.document.createElement("mark");
    for (let nodeText of ["a", "b", "c", "d", "e", "f", "g"]) {
      markElement.appendChild(dom.window.document.createTextNode(nodeText));
    }
    editor.appendChild(markElement);
    editor.appendChild(dom.window.document.createTextNode(" world"));

    let selectionRange = dom.window.document.createRange();
    selectionRange.setStart(editor.firstChild, 2);
    selectionRange.setEnd(editor.firstChild, 5);
    assert.strictEqual(selectionRange.toString(), "cde");

    markEditorText(editor, dom.window, [{begin: 8, end: 13}], selectionRange);

    assert.strictEqual(editor.innerHTML, "abcdefg <mark>world</mark>");
    assert.strictEqual(selectionRange.toString(), "cde");
  },

  "marking removes empty <mark>": () => {
    let editor = dom.window.document.createElement("pre");
    editor.innerHTML = "<mark></mark> world";
    markEditorText(editor, dom.window, [{begin: 1, end: 6}]);
    assert.strictEqual(editor.innerHTML, " <mark>world</mark>");
  },

  "marking preserves removed entirely-selected <mark>": () => {
    // <pre><mark>hello</mark> world</pre>
    let editor = dom.window.document.createElement("pre");
    let markElement = dom.window.document.createElement("mark");
    for (let nodeText of ["h", "e", "l", "l", "o"]) {
      markElement.appendChild(dom.window.document.createTextNode(nodeText));
    }
    editor.appendChild(markElement);
    editor.appendChild(dom.window.document.createTextNode(" world"));

    let selectionRange = dom.window.document.createRange();
    selectionRange.setStart(editor.firstChild, 0);
    selectionRange.setEnd(editor.firstChild, 5);
    assert.strictEqual(selectionRange.toString(), "hello");

    markEditorText(editor, dom.window, [{begin: 6, end: 11}], selectionRange);

    assert.strictEqual(editor.innerHTML, "hello <mark>world</mark>");
    assert.strictEqual(selectionRange.toString(), "hello");
  },

  "marking preserves selection starting with end of <mark>": () => {
    let editor = dom.window.document.createElement("pre");
    editor.innerHTML = "<mark>hello</mark> big world";

    let selectionRange = dom.window.document.createRange();
    selectionRange.setStart(editor.firstChild, 1); // After "hello" inside <mark>.
    selectionRange.setEnd(editor.firstChild.nextSibling, 4); // End of " big".
    assert.strictEqual(selectionRange.toString(), " big");

    markEditorText(editor, dom.window, [{begin: 10, end: 15}], selectionRange);

    assert.strictEqual(editor.innerHTML, "hello big <mark>world</mark>");
    assert.strictEqual(selectionRange.toString(), " big");
  },

  "marking preserves selection starting with end of <mark> containing <br>": () => {
    let editor = dom.window.document.createElement("pre");
    editor.innerHTML = "<mark>hello<br></mark>big world";

    let selectionRange = dom.window.document.createRange();
    selectionRange.setStart(editor.firstChild, 2); // After <br> inside <mark>.
    selectionRange.setEnd(editor.firstChild.nextSibling, 3); // End of "big".
    assert.strictEqual(selectionRange.toString(), "big");

    markEditorText(editor, dom.window, [{begin: 10, end: 15}], selectionRange);

    assert.strictEqual(editor.innerHTML, "hello<br>big <mark>world</mark>");
    assert.strictEqual(selectionRange.toString(), "big");

    let brElement = editor.querySelector("br");
    // TODO(strager): Permit startContainer==<pre> startOffset==indexOf(<br>)+1.
    let bigTextNode = brElement.nextSibling;
    assert.strictEqual(selectionRange.startContainer, bigTextNode);
    assert.strictEqual(selectionRange.startOffset, 0);
  },

  "marking preserves selection inside <mark> starting with <br>": () => {
    let editor = dom.window.document.createElement("pre");
    editor.innerHTML = "<mark>a<br>b</mark>";

    let selectionRange = dom.window.document.createRange();
    selectionRange.setStart(editor.firstChild, 1); // <br>
    selectionRange.setEnd(editor.firstChild, 3); // After "b".
    assert.strictEqual(selectionRange.toString(), "b");

    markEditorText(editor, dom.window, [], selectionRange);

    assert.strictEqual(editor.innerHTML, "a<br>b");
    assert.strictEqual(selectionRange.toString(), "b");

    assert.strictEqual(selectionRange.startContainer, editor);
    assert.strictEqual(selectionRange.startOffset, 1); // Index of <br>.
  },

  "marking preserves <br> immediately after mark": () => {
    let editor = dom.window.document.createElement("pre");
    editor.innerHTML = "hello<br>world";
    markEditorText(editor, dom.window, [{begin: 0, end: 5}]);
    assert.strictEqual(editor.innerHTML, "<mark>hello</mark><br>world");
  },

  "marking preserves <br> before inserted mark": () => {
    let editor = dom.window.document.createElement("pre");
    editor.innerHTML = "one<br>twothree";
    markEditorText(editor, dom.window, [{begin: 7, end: 7 + "three".length}]);
    assert.strictEqual(editor.innerHTML, "one<br>two<mark>three</mark>");
  },

  "marking preserves <br> after inserted mark": () => {
    let editor = dom.window.document.createElement("pre");
    editor.innerHTML = "onetwo<br>three";
    markEditorText(editor, dom.window, [{begin: 0, end: 3}]);
    assert.strictEqual(editor.innerHTML, "<mark>one</mark>two<br>three");
  },

  "mark exactly over existing <mark>": () => {
    let editor = dom.window.document.createElement("pre");
    editor.innerHTML = "<mark>hello</mark> world";
    markEditorText(editor, dom.window, [{begin: 0, end: 5}]);
    assert.strictEqual(editor.innerHTML, "<mark>hello</mark> world");
  },

  "mark starts at end of existing <mark>": () => {
    let editor = dom.window.document.createElement("pre");
    editor.innerHTML = "<mark>hello</mark>world";
    markEditorText(editor, dom.window, [{begin: 5, end: 10}]);
    assert.strictEqual(editor.innerHTML, "hello<mark>world</mark>");
  },

  "identical marks are merged": () => {
    let editor = dom.window.document.createElement("pre");
    editor.innerHTML = "helloworld";
    markEditorText(editor, dom.window, [{begin: 0, end: 5}, {begin: 0, end: 5}]);
    assert.strictEqual(editor.innerHTML, "<mark>hello</mark>world");
  },

  "marks are sorted before processing": () => {
    let marks = [{begin: 6, end: 11}, {begin: 0, end: 5}];
    assert.deepStrictEqual(sanitizeMarks(marks), [{begin: 0, end: 5}, {begin: 6, end: 11}]);
  },
};

for (let testName in tests) {
  if (Object.prototype.hasOwnProperty.call(tests, testName)) {
    let test = tests[testName];
    console.log(`Running ${testName} ...`);
    test();
  }
}
console.log('All tests passed');
