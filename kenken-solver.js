angular.module('kenkenApp')
  .service('KenkenSolver', function() {

    //
    // MARK: solver variables
    //
    var $scope;           // TODO use injection for this

    var board;            // the grid
    var boardSize;        // size of grid

    var rows;             // the grid rows
    var columns;          // the grid columns
    var rowsAndColumns;   // = rows.concat(columns)

    var cages;            // math cages in the board, plus new ones we'll make
    var cageExists;       // check this to avoid duplicates when we make new cages

    var rowTotal;         // sum of cells in each row
    var rowProduct;       // product of cells in each row

    // var ruleNames = ["singletons", "addition", "division", "multiplication!", "pigeonhole", "subtraction", "three", "two pair", "line sum", "line product"];
    var ruleNames = ["singleton", "addition", "division", "multiplication!", "pigeonhole", "subtraction", "two pair",
      "three"];

    //
    // MARK: test
    //
    this.test = function() {
      var cells = [{},{}];
      cells[0].possible = new Possibles(8).setOnly([1,4]);
      cells[1].possible = new Possibles(8).setOnly([1,4]);
      var cage = { op: 'x', total: 4, cells: cells };
    };

    //
    // MARK: main
    //

    // TODO solver should be an object, with puzzle ($scope) as constructor parameter
    // the main routine
    this.solve = function*(puzzle) {
      initialize(puzzle);
      var maxPasses = 50;
      for (var numPasses = 1; numPasses < maxPasses; numPasses++) {
        var previousBoard = copyPossibles();
        for (var ruleIndex = 0; ruleIndex < ruleNames.length; ruleIndex++) {
          var rule = ruleNames[ruleIndex];
          console.log("APPLYING RULE:", rule);
          yield *rules[rule]();
        }
        console.log("Finished pass", numPasses, "through rules");
        if (possiblesMatch(previousBoard)) break;
      }
      console.log("DONE!!!");
    };

    // initialize the solver
    function initialize(puzzle) {
      $scope = puzzle;
      board = puzzle.board;
      boardSize = board.length;
      rowTotal = (boardSize + 1) * boardSize / 2;
      rowProduct = factorial(boardSize);

      // make convenience collections rows, columns, rowsAndColumns
      rows = board;
      columns = [];
      for (var j = 0; j < boardSize; j++) {
        columns[j] = [];
        for (var i = 0; i < boardSize; i++) {
          columns[j].push(board[i][j]);
        }
      }
      rowsAndColumns = rows.concat(columns);

      // in each cell, reset solution, guess, and possible values
      rows.forEach(function(cells) { cells.forEach(function(cell) {
        cell.possible = new Possibles(boardSize);
        delete cell.solution;
        delete cell.guess;
      })});

      // reset cages
      cages = [];
      cageExists = {};

      // copy puzzle cages to our solver's cage list, with real cells inside instead of coordinates
      puzzle.cages.forEach(function(c) {
        var cage = angular.copy(c);
        cage.cells.forEach(function(coords, i) { cage.cells[i] = cellAt(coords); });
        addCage(cage);
      });

    }

    //
    // MARK: managing possible values in cells (also see Possibles datatype below)
    //

    // make a copy of all possible values in the grid
    function copyPossibles() {
      var possibles = [];
      rows.forEach(function(cells) { cells.forEach(function(cell) {
        possibles.push(cell.possible.copy());
      })});
      return possibles;
    }

    // check old possible values against current board
    function possiblesMatch(oldPossibles) {
      for (var i = 0; i < boardSize; i++) {
        for (var j = 0; j < boardSize; j++) {
          var a = board[i][j].possible;
          var b = oldPossibles[i * boardSize + j];
          if (!a.equals(b)) return false;
        }
      }
      return true;
    }

    // eliminate a possible value in a cell
    function *clear(cell, n, why) {
      if (cell.possible.includes(n)) {
        cell.possible.clear(n);
        console.log("(%d,%d) clear %s: %s", cell.i, cell.j, n, why);
        if (cell.possible.count() == 1) {
          solveCell(cell, cell.possible.values()[0]);
        }
        $scope.setCursor(cell.i, cell.j); // why doesn't this work?
        $scope.highlight = cell;
        yield null;
      }
    }

    // eliminate several possible values in a cell
    function *clearValues(cell, values, why) {
      yield *values.yieldEach(function*(n) { yield *clear(cell, n, why); });
    }

    // set a single value as the only possibility in a cell
    function *setOnly(cell, n, why) {
      if (cell.solution != n) {
        cell.possible.setOnly(n);
        console.log("(%d,%d) set %d: %s", cell.i, cell.j, n, why);
        solveCell(cell, n);
        $scope.setCursor(cell.i, cell.j); // why doesn't this work?
        $scope.highlight = cell;
        yield null;
      }
    }

    // set a cell to a particular value, and clear that value from other cells in its row and column
    // if the cell lives in a cage of 3 or more cells, make a smaller cage with the remaining cells
    function solveCell(cell, n) {
      if (cell.ans != n) console.log("!!!!! WRONG");
      console.log("SOLVED " + cellName(cell) + " = " + n);
      cell.solution = n;
      cell.guess = cell.solution;
      var cage = cages[cell.cage];

      // clear row & column
      rows[cell.i].forEach(function(otherCell) {
        if (otherCell != cell) {
          var it = clear(otherCell, n, "no dups allowed in row");
          while (!it.next().done) {}
        }
      });
      columns[cell.j].forEach(function(otherCell) {
        if (otherCell != cell) {
          var it = clear(otherCell, n, "no dups allowed in column");
          while (!it.next().done) {}
        }
      });

      /*
      // if in a cage of 3 or more cells, make a smaller cage with the remaining cells
      if ((cage.op == '+' || cage.op == 'x') && cage.cells.length > 1) {
        var otherCells = arraySubtract(cage.cells, [cell]);
        var newTotal = cage.op == '+' ? cage.total - n : cage.total / n;
        if (otherCells.length == 1) {
          // solve other cell
          yield *setOnly(otherCells[0], newTotal, "last cell left in " + cage.op + " cage");
        } else {
          // new cage
          var newCage = { op: cage.op, total: newTotal, cells: otherCells };
          addCage(newCage, "leftovers after solving " + cellName(cell) + " = " + n);
        }
      }
      */
    }

    //
    // MARK: managing cages
    //

    // add a cage to the cage list
    function addCage(cage, why) {
      var key = cage.op;
      cage.cells.forEach(function(cell) { key += ";" + cell.i + "," + cell.j; });
      if (!cageExists[key]) {
        if (why) console.log("NEW CAGE " + cageName(cage) + ": " + why);
        cages.push(cage);
        cageExists[key] = true;
        cage.inLine = cellsInLine(cage.cells);
      }
    }

    // if cells are all in the same row or column, return the line number
    // if they're not in line, return -1
    // line number = row number for rows, boardSize + column number for columns
    function cellsInLine(cells) {
      var i = cells[0].i, j = cells[0].j;
      cells.forEach(function(cell) {
        if (i > -1 && cell.i != i) i = -1;
        if (j > -1 && cell.j != j) j = -1;
      });
      // return a proper index into rowsAndColumns
      if (i > -1) return i;
      else if (j > -1) return boardSize + j;
      else return -1;
    }

    function rowAndColumnPossibles() {
      var possibles = [];
      for (var i = 0; i < boardSize * 2; i++) {
        possibles[i] = new Possibles(boardSize);
      }
      return possibles;
    }

    function possibleStrings(cells) {
      var result = "";
      cells.forEach(function(cell, i) {
        if (i > 0) result += ", ";
        cell.possible.forEach(function(n) { result += n; });
      });
      return result;
    }

    function cageCanFinish(op, total, cells, possibles) {
      // if (cells.length == 0 || op != '+' || op != 'x') return false;
      console.log("is " + total + op, "possible with", possibleStrings(cells) + "?");

      var row = cells[0].i, column = cells[0].j + boardSize;

      console.log("possibles[%d] %s", row, possibles[row].toString());
      console.log("possibles[%d] %s", column, possibles[column].toString());

      function isPossible(value) {
        return cells[0].possible.includes(value) && possibles[row].includes(value) && possibles[column].includes(value);
      }

      if (cells.length == 1) return isPossible(total);

      var otherCells = cells.slice(1);

      for (var n = 1; n <= boardSize; n++) {
        if (isPossible(n)) {
          console.log("try",n);
          var remainder = op == '+' ? total - n : total / n;
          if (remainder > 0 && remainder == Math.round(remainder)) {
            possibles[row].clear(n); possibles[column].clear(n);
            console.log("->possibles[%d] %s", row, possibles[row].toString());
            console.log("->possibles[%d] %s", column, possibles[column].toString());
            if (cageCanFinish(op, remainder, otherCells, possibles)) return true;
            possibles[row].set(n); possibles[column].set(n);
          }
        }
      }

      return false;

    }

    //
    // MARK: solver rules
    //

    // TODO mark cages complete so we don't reprocess them

    var rules = {
      "singleton": function*() {
        yield *cages.yieldEach(function*(cage) { if (cage.cells.length == 1) {
          yield *setOnly(cage.cells[0], cage.total, "singleton cage");
        }});
      },

      "addition": function*() {
        // eliminate values that can't complete an addition cage
        yield *cages.yieldEach(function*(cage) { if (cage.op == "+") {

            var remainder = cage.total;
            var openCells = [];

          // subtract solved cells from total
            cage.cells.forEach(function(cell) {
              if (cell.solution) remainder -= cell.solution;
              else openCells.push(cell);
            });

          var onlyTwo = openCells.length == 2;
          var inLine = onlyTwo && cellsInLine(openCells) > -1;

          yield *openCells.yieldEach(function*(cell, i) {
              // if there are only two cells, identify the other one
              var otherCell = onlyTwo ? openCells[1 - i] : null;
              yield *cell.possible.yieldEach(function*(n) {
                var diff = remainder - n;
                if (diff < openCells.length - 1) { // bust!
                  yield *clear(cell, n, "busts cage " + cageName(cage));
                } else if (onlyTwo) {
                  // if there's only one other cell, make sure it can finish the math
                  // and if the cells are in line, they can't both have the same value
                  if (!otherCell.possible.includes(diff) || (inLine && diff == n)) {
                    yield *clear(cell, n, "" + remainder + "+: " + diff + " not possible in other cell " + cageName(cage));
                  }
                }
              });
            });

          }});
      },

      "division": function*() {
        // eliminate values that can't complete a division cage
        yield *cages.yieldEach(function*(cage) { if (cage.op == "/") {

          var total = cage.total;
          yield *cage.cells.yieldEach(function*(cell, i) {
            if (cell.solution) return;
            var otherCell = cage.cells[1 - i];
            yield *cell.possible.yieldEach(function*(n) {
              var vals = [n * total, Math.round(10 * n / total) / 10]; // truncate after 1st decimal place
              if (!otherCell.possible.includesAny(vals)) {
                yield *clear(cell, n, "" + total + "/: " + vals[0] + " & " + vals[1] + " not possible in other cell " + cageName(cage));
              }
            });
          });

        }});
      },

      "multiplication": function*() {
          // eliminate values that can't complete a multiplication cage
        yield *cages.yieldEach(function*(cage) { if (cage.op == "x") {
            var remainder = cage.total;
            var openCells = [];

            cage.cells.forEach(function(cell) {
              if (cell.solution) remainder /= cell.solution;
              else openCells.push(cell);
            });


          var onlyTwo = openCells.length == 2;
          var inLine = onlyTwo && cellsInLine(openCells) > 0;

          yield *openCells.yieldEach(function*(cell, i) {
              // if there are only two cells, identify the other one
              var otherCell = onlyTwo ? openCells[1 - i] : null;
              yield *cell.possible.yieldEach(function*(n) {
                if (remainder % n > 0) {
                  yield *clear(cell, n, "not a divisor of " + remainder + " " + cageName(cage));
                } else if (onlyTwo) {
                  // if there's only one other cell, make sure it can finish the math
                  // and if the cells are in line, they can't both have the same value
                  var quotient = remainder / n;
                  if (!otherCell.possible.includes(quotient) || (inLine && quotient == n)) {
                    yield *clear(cell, n, "" + quotient + "x: " + quotient + " not possible in other cell " + cageName(cage));
                  }
                }
              });
            });

          }});
      },

      "multiplication!": function*() {
        // eliminate values that can't complete a multiplication cage
        yield *cages.yieldEach(function*(cage) { if (cage.op == "x") {
          var remainder = cage.total;
          var openCells = [];

          cage.cells.forEach(function(cell) {
            if (cell.solution) remainder /= cell.solution;
            else openCells.push(cell);
          });

          console.log(cageName(cage), openCells.length, "cells left, subtotal", remainder);

          yield *openCells.yieldEach(function*(cell) {
            yield *cell.possible.yieldEach(function*(n) {
              if (remainder % n > 0) {
                yield *clear(cell, n, "not a divisor of " + remainder + " " + cageName(cage));
              } else {
                var otherCells = arraySubtract(openCells, [cell]);
                console.log("!!!!testing", remainder/n, "in", possibleStrings(otherCells));
                var possibles = rowAndColumnPossibles();
                possibles[cell.i].clear(n); possibles[cell.j + boardSize].clear(n);
                if (!cageCanFinish('x', remainder / n, otherCells, possibles)) {
                  yield *clear(cell, n, "rest of cage impossible " + cageName(cage));
                }
              }
            });
          });
        }});

      },

      "pigeonhole": function*() {
        // If possibility occurs only once in a row or column, it must appear there

        var counter = [];
        var lastCellWith = [];
        yield *rowsAndColumns.yieldEach(function*(cells, line) {
          var rowOrCol = line < boardSize ? "row" : "column";
          // reset counters
          for (var i = 0; i < boardSize; i++) counter[i] = 0;
          // scan cells and count possibles for each value
          cells.forEach(function(cell) {
            cell.possible.forEach(function(n) { counter[n]++; lastCellWith[n] = cell; });
          });
          // any singletons? solve them
          yield *counter.yieldEach(function*(count, n) {
            if (count == 1) yield *setOnly(lastCellWith[n], n, "only place left in " + rowOrCol + " for " + n);
          });
        });

      },

      "subtraction": function*() {
        // Check legal subtraction possibilities
        yield* cages.yieldEach(function*(cage) { if (cage.op == "-") {

          var total = cage.total;
          yield* cage.cells.yieldEach(function*(cell, i) {
            if (cell.solution) return;
            var otherCell = cage.cells[1 - i];
            yield* cell.possible.yieldEach(function*(n) {
              var vals = [n + total, n - total];
              if (!otherCell.possible.includesAny(vals)) {
                yield* clear(cell, n, "" + total + "-: " + vals[0] + " & " + vals[1] + " not possible in other cell " + cageName(cage));
              }
            });
          });

        }});
      },

      "three": function*() {
        // If the possibilities of three cells in the same row or column all equal the same 3
        // numbers, those three numbers must occupy those cells, and therefore aren't possible
        // in any other cells in the same row/column.

        yield *rowsAndColumns.yieldEach(function*(cells, line) {
          var rowOrCol = line < boardSize ? "row" : "column";
          for (var i = 0; i < boardSize - 2; i++) {
            var cellA = cells[i];
            if (cellA.solution || cellA.possible.count() > 3) continue;
            for (var j = i + 1; j < boardSize - 1; j++) {
              var cellB = cells[j];
              if (cellB.solution || cellB.possible.count() > 3) continue;
              var possibleAB= cellA.possible.union(cellB.possible);
              if (possibleAB.count() > 3) continue;
              for (var k = j + 1; k < boardSize; k++) {
                var cellC = cells[k];
                if (cellC.solution || cellC.possible.count() > 3) continue;
                var possibleABC = possibleAB.union(cellC.possible);
                if (possibleABC.count() == 3) {
                  // threesome found! remove these three values from all other cells
                  var otherCells = arraySubtract(cells, [cellA, cellB, cellC]);
                  var v = possibleABC.values();
                  var vals = "" + v[0] + "-" + v[1] + "-" + v[2];
                  var inCells = cellName(cellA) + "," + cellName(cellB) + "," + cellName(cellC);
                  yield *otherCells.yieldEach(function*(cell) {
                    yield *clearValues(cell, v, vals + " in this " + rowOrCol + " must be in " + inCells);
                  });
                }
              }
            }
          }
        });
      },

      "two pair": function*() {
        // If the possibilities of two cells in the same row or column all equal the same 2
        // numbers, those two numbers must occupy those cells, and therefore aren't possible
        // in any other cells in the same row/column.

        yield *rowsAndColumns.yieldEach(function*(cells, line) {
          var rowOrCol = line < boardSize ? "row" : "column";
          for (var i = 0; i < boardSize - 1; i++) {
            var cellA = cells[i];
            if (cellA.possible.count() == 2) {
              for (var j = i + 1; j < boardSize; j++) {
                var cellB = cells[j];
                if (cellB.possible.equals(cellA.possible)) {
                  // two-pair found! remove these two values from all other cells
                  var otherCells = arraySubtract(cells, [cellA, cellB]);
                  var v = cellA.possible.values();
                  var vals = "" + v[0] + "-" + v[1];
                  var inCells = cellName(cellA) + " & " + cellName(cellB);
                  yield *otherCells.yieldEach(function*(cell) {
                    yield *clearValues(cell, v, vals + " in this " + rowOrCol + " must be in " + inCells);
                  });
                  // is pair in same cage? cage bigger than 2? then make a subcage with leftover cells
                  if (cellA.cage == cellB.cage && cages[cellA.cage].cells.length > 2) {
                    var cage = cages[cellA.cage];
                    var subCage = {
                      op: cage.op,
                      total: cage.op == '+' ? cage.total - (v[0] + v[1]) : cage.total / (v[0] * v[1]),
                      cells: arraySubtract(cage.cells, [cellA, cellB])
                    };
                    addCage(subCage, "leftovers after pair");
                  }
                }
              }
            }
          }
        });
      },

      "must-have divisor": function() {
        var n = boardSize;
        var mustHaveDivisors = n < 6 ? [3, 5] : n > 6 ? [5, 7] : [5];
        cages.forEach(function(cage) {
          if (cage.op == 'x') {
            mustHaveDivisors.forEach(function(d) {
              if (cage.total % d == 0) {
                // found a must-have divisor! now, does the cage live in one line?
                var row = cage.cells[0].i;
                var column = cage.cells[0].j;
                cage.cells.forEach(function(cell) {
                  row = cell.i == row ? row : false;
                  column = cell.j == column ? column : false;
                });
                // if so, divisor is impossible elsewhere in that line
                if (row) rows[row].forEach(function(cell) {
                  if (cell.cage != cage.id) clear(cell, d, "must have divisor");
                });
                if (column) columns[column].forEach(function(cell) {
                  if (cell.cage != cage.id) clear(cell, d, "must have divisor");
                });
              }
            });
          }
        });
      },


      // TODO this could be automatic if we make + cages for each row/column...
      "line sum": function*() {
        yield *rowsAndColumns.yieldEach(function*(cells, line) {
          var rowOrColumn = line < boardSize ? "row" : "column";
          var remainder = rowTotal;
          for (var i = 0; i < cells.length; i++) {
            var cell = cells[i], cage = cages[cell.cage];
            if (cage.op == '+' && cage.inLine == line) {
              remainder -= cage.total;
              cells = arraySubtract(cells, cage.cells);
              i -= 1; // adjust after cells are dropped
            } else if (cell.solution) {
              remainder -= cell.solution;
              cells = arraySubtract(cells, [cell]);
              i -= 1;
            }
          }
          if (cells.length == 1) {
            yield *setOnly(cells[0], remainder, "remainder of " + rowOrColumn + " sum");
          } else if (cells.length > 1 && cells.length < boardSize) {
            addCage({ op: '+', total: remainder, cells: cells }, "remainder of " + rowOrColumn + " " + (line % boardSize) + " sum");
          }
        });
      },

      "line product": function*() {
        yield *rowsAndColumns.yieldEach(function*(cells, line) {
          var rowOrColumn = line < boardSize ? "row" : "column";
          var remainder = rowProduct;
          for (var i = 0; i < cells.length; i++) {
            var cell = cells[i], cage = cages[cell.cage];
            if (cage.op == 'x' && cage.inLine == line) {
              remainder /= cage.total;
              cells = arraySubtract(cells, cage.cells);
              i -= 1; // adjust after cells are dropped
            } else if (cell.solution) {
              remainder /= cell.solution;
              cells = arraySubtract(cells, [cell]);
              i -= 1;
            }
          }
          if (cells.length == 1) {
            yield *setOnly(cells[0], remainder, "remainder of " + rowOrColumn + " product");
          } else if (cells.length > 1 && cells.length < boardSize) {
            addCage({ op: 'x', total: remainder, cells: cells }, "remainder of " + rowOrColumn + " " + (line % boardSize) + " product");
          }
        });
      }

    };

    //
    // MARK: convenience functions
    //

    // cell at a given row and column
    function cellAt(coords) { return board[coords[0]][coords[1]]; }

    // string for describing a cell in console output
    function cellName(cell) { return "(" + cell.i + "," + cell.j + ")"; }

    // string for describing a cage in console output
    function cageName(cage) {
      var name = "[" + cage.total + cage.op + " ";
      cage.cells.forEach(function(cell, i) {
        name += (i > 0 ? "," : "") + cell.possible.toString();
      });
      return name + "]";
    }

    Array.prototype.yieldEach = function*(fn) {
      for (var i = 0; i < this.length; i++) yield* fn(this[i], i);
    };

    //
    // MARK: utility functions
    //

    function factorial(n) {
      if (n < 2) return 1;
      else return n * factorial(n - 1);
    }

    function arraySubtract(a, b) {
      var result = [];
      a.forEach(function(elem) {
        if (b.indexOf(elem) == -1) result.push(elem);
      });
      return result;
    }

    //
    // MARK: Possibles datatype
    //

    // helps keep track of what values are possible in a given cell
    function Possibles(n) {
      var a = [];
      var count = 0;

      this.setAll = function() {
        for (var i = 1; i <= n; i++) a[i] = true;
        count = n;
        return this;
      };

      this.clearAll = function() {
        for (var i = 1; i <= n; i++) a[i] = false;
        count = 0;
        return this;
      };

      this.set = function(x) {
        var self = this;
        if (x instanceof Array) {
          x.forEach(function(k) { self.set(k) });
        } else {
          if (x > 0 && x <= n && !a[x]) {
            a[x] = true;
            count += 1;
          }
        }
        return this;
      };

      this.clear = function(x) {
        var self = this;
        if (x instanceof Array) {
          x.forEach(function(k) { self.clear(k); });
        } else if (x > 0 && x <= n && a[x]) {
          a[x] = false;
          count -= 1;
        }
        return this;
      };

      this.setOnly = function(x) {
        this.clearAll();
        this.set(x);
        return this;
      };

      this.includes = function(x) {
        return x > 0 && x <= n && a[x];
      };

      this.includesAny = function(x) {
        for (var i = 0; i < x.length; i++) {
          if (this.includes(x[i])) return true;
        }
        return false;
      };

      this.count = function() {
        return count;
      };

      this.values = function() {
        var values = [];
        this.forEach(function(i) { values.push(i); });
        return values;
      };

      this.forEach = function(callback) {
        for (var i = 1; i <= n; i++) if (a[i]) callback.call(this, i);
      };

      this.yieldEach = function*(callback) {
        for (var i = 1; i <= n; i++) if (a[i]) yield *callback(i);
      };

      this.equals = function(b) {
        if (this.count() != b.count()) return false;
        for (var i = 1; i <= n; i++) {
          if (a[i] && !b.includes(i)) return false;
        }
        return true;
      };

      this.copy = function() {
        var p = new Possibles(n);
        for (var i = 1; i <= n; i++) if (!a[i]) p.clear(i);
        return p;
      };

      this.union = function(b) {
        var union = new Possibles(n);
        for (var i = 1; i <= n; i++) {
          if (!a[i] && !b.includes(i)) union.clear(i);
        }
        return union;
      };

      this.toString = function() {
        var s = "";
        for (var i = 1; i <= n; i++) if (a[i]) s += i
        return s;
      };

      return this.setAll();
    }

  });