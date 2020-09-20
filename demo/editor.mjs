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

export function markEditorText(editor, window, marks, rangeToPreserve = null) {
  let marker = new EditorMarker(editor, window, sanitizeMarks(marks), rangeToPreserve);
  marker.markNodes();
}

export function sanitizeMarks(marks) {
  let result = [];
  for (let mark of marks) {
    if (!result.some(resultMark => resultMark.begin === mark.begin && resultMark.end == mark.end)) {
      result.push(mark);
    }
  }
  result.sort((a, b) => {
    if (a.begin < b.begin) {
      return -1;
    }
    if (a.begin > b.begin) {
      return +1;
    }
    return 0;
  });
  return result;
}

class EditorMarker {
  constructor(editor, window, marks, rangeToPreserve) {
    this._editor = editor;
    this._window = window;
    this._marks = marks;

    this._rangePreserver = rangeToPreserve === null ? new NullRangePreserver() : new RangePreserver(rangeToPreserve);

    this._currentOffset = 0;
    this._currentMarkIndex = 0;

    this._markBeginNode = null;
    this._markEndNode = null;
  }

  markNodes() {
    let currentNode = this._editor.firstChild;
    while (currentNode !== null) {
      switch (currentNode.nodeType) {
        case this._window.Node.ELEMENT_NODE:
          currentNode = this.handleElement(currentNode);
          break;
        case this._window.Node.TEXT_NODE:
          currentNode = this.handleTextNode(currentNode);
          break;
        default:
          throw new Error("Unsupported node type");
      }
    }
  }

  handleElement(currentNode) {
    if (currentNode.tagName === "BR") {
      this._currentOffset += 1; // "\n"
      return currentNode.nextSibling;
    } else {
      return this.handleElementWithChildren(currentNode);
    }
  }

  handleElementWithChildren(currentNode) {
    let currentNodeIndex = indexOfChildNode(this._editor, currentNode);
    let previousSibling = currentNode.previousSibling;
    let childNodes = [...currentNode.childNodes];
    currentNode.replaceWith(...childNodes);

    this._rangePreserver.update((container, offset) => {
      if (container === currentNode) {
        return {container: this._editor, offset: currentNodeIndex + offset};
      } else {
        return {container: container, offset: offset};
      }
    });

    if (previousSibling === null) {
      return this._editor.firstChild;
    } else {
      return previousSibling.nextSibling;
    }
  }

  handleTextNode(currentNode) {
    let self = this;

    let currentMark = this._currentMarkIndex < this._marks.length ? this._marks[this._currentMarkIndex] : null;
    if (currentMark !== null) {
      if (currentNodeContainsOffset(currentMark.begin)) {
        let splitIndex = currentMark.begin - self._currentOffset;
        this._markBeginNode = splitNodeAtMarkBegin(splitIndex);
      }

      if (currentNodeContainsOffset(currentMark.end)) {
        let splitIndex = currentMark.end - this._currentOffset;
        this._markEndNode = splitNodeAtMarkEnd(splitIndex);

        let mark = this._window.document.createElement('mark');
        wrapNodes(mark, this._markBeginNode, this._markEndNode);
        this._rangePreserver.restore();

        this._currentMarkIndex += 1;
        this._currentOffset += splitIndex;
        return mark.nextSibling;
      }
    }

    this._currentOffset += currentNode.textContent.length;
    return currentNode.nextSibling;

    function currentNodeContainsOffset(offset) {
      let currentNodeBeginOffset = self._currentOffset;
      let currentNodeEndOffset = currentNodeBeginOffset + currentNode.length;
      return currentNodeBeginOffset <= offset && offset <= currentNodeEndOffset;
    }

    function splitNodeAtMarkBegin(splitIndex) {
      if (splitIndex === 0) {
        return currentNode;
      } else if (splitIndex === currentNode.textContent.length) {
        if (currentNode.nextSibling === null) {
          throw new Error("Can't happen");
        } else {
          return currentNode.nextSibling;
        }
      } else {
        let nextNode = splitTextNode(currentNode, splitIndex, self._window, self._rangePreserver);
        return nextNode;
      }
    }

    function splitNodeAtMarkEnd(splitIndex) {
      if (splitIndex === 0) {
        throw new Error("Can't happen");
      } else if (splitIndex === currentNode.textContent.length) {
        return currentNode;
      } else {
        let nextNode = splitTextNode(currentNode, splitIndex, self._window, self._rangePreserver);
        return currentNode;
      }
    }
  }
}

function indexOfChildNode(parentNode, childNode) {
  let i = 0;
  let n = parentNode.firstChild;
  for (;;) {
    if (n === null) {
      return null;
    }
    if (n === childNode) {
      return i;
    }
    n = n.nextSibling;
    ++i;
  }
}

class NullRangePreserver {
  update(_updater) {
    // Do nothing.
  }

  restore() {
    // Do nothing.
  }
}

class RangePreserver {
  constructor(range) {
    this._range = range;
    this._reloadStart();
    this._reloadEnd();
  }

  update(updater) {
    let newStart = updater(this._startContainer, this._startOffset);
    let newEnd = updater(this._endContainer, this._endOffset);
    if (newStart === null) {
      this._reloadStart();
    } else {
      this._range.setStart(newStart.container, newStart.offset);
      this._startContainer = newStart.container;
      this._startOffset = newStart.offset;
    }
    if (newEnd === null) {
      this._reloadEnd();
    } else {
      this._range.setEnd(newEnd.container, newEnd.offset);
      this._endContainer = newEnd.container;
      this._endOffset = newEnd.offset;
    }
  }

  restore() {
    this.update((container, offset) => ({container, offset}));
  }

  _reloadStart() {
    this._startContainer = this._range.startContainer;
    this._startOffset = this._range.startOffset;
  }

  _reloadEnd() {
    this._endContainer = this._range.endContainer;
    this._endOffset = this._range.endOffset;
  }
}

function splitTextNode(node, index, window, rangePreserver) {
  let text = node.textContent;
  let leftText = text.substr(0, index);
  if (leftText === '') {
    throw new Error("Cannot split node at beginning");
  }
  let rightText = text.substr(index);
  if (rightText === '') {
    throw new Error("Cannot split node at end");
  }
  let rightNode = window.document.createTextNode(rightText);

  node.parentNode.insertBefore(rightNode, node.nextSibling);
  node.textContent = leftText;

  if (rangePreserver !== null) {
    rangePreserver.update((container, offset) => {
      if (container === node) {
        if (offset > index) {
          return {container: rightNode, offset: offset - index};
        } else {
          return {container: node, offset: offset};
        }
      }
      return null;
    });
  }

  return rightNode;
}

function wrapNodes(wrapperElement, firstChildNode, lastChildNode) {
  lastChildNode.parentNode.insertBefore(wrapperElement, lastChildNode.nextSibling);
  for (let n = firstChildNode; n !== null; ) {
    let next = n.nextSibling;
    wrapperElement.appendChild(n);
    if (n === lastChildNode) {
      break;
    }
    n = next;
  }
}

export function getEditorText(editorElement, window) {
  let textifier = new Textifier(window);
  textifier.accumulate(editorElement);
  return textifier._pieces.join("");
}

class Textifier {
  constructor(window) {
    this._addNewlineAtText = false;
    this._pieces = [];
    this._window = window;
  }

  accumulate(node) {
    switch (node.nodeType) {
      case this._window.Node.ELEMENT_NODE:
        switch (node.tagName) {
          case "BR":
            this._pieces.push("\n");
            break;
          default:
            for (let childNode of node.childNodes) {
              this.accumulate(childNode);
            }
            break;
        }
        break;
      case this._window.Node.TEXT_NODE:
        this._pieces.push(node.textContent);
        break;
    }
  }
}
