angular.module('kenkenApp')
  .service('KenkenSolver', function() {

    // TODO equate guess with solution
    // TODO go back to coords with cages?
    // TODO next() scheme without yield?

    this.getSolver = function($scope) {

      //
      // MARK: solver variables
      //

      var board = $scope.board;                   // the grid
      var boardSize = board.length;               // size of grid

      var rows = board;                           // the grid rows
      var columns = rowsToColumns(board);         // the grid columns
      var rowsAndColumns = rows.concat(columns);  // both

      var rowTotal = arithSum(boardSize);         // sum of cells in each row
      var rowProduct = factorial(boardSize);      // product of cells in each row

      var cages = [];         // math cages in the board, plus new ones we'll make
      var cageExists = {};    // check this to avoid duplicates when we make new cages
      initializeCages();

      // the rules used by the solver, in order
      var ruleNames = ["zero or one", "singleton", "divisor", "must-have divisor", "division", "multiplication", "subtraction",
        "pigeonhole", "addition", "two pair", "three", "two and two", "not both", "must have in line", "line sum", "line product",
        "double math", "subtract subcage"];
      //ruleNames = ["not both"];
      var rule;
      var numPasses;

      // iterator for stepwise solving
      var stepIterator = null;
      var done = false;
      var broken = null;

      var message;

      // the object that will be returned
      var solver = {
        solve: solveFully,
        step: step,
        reset: reset,
        message: function() { return message; },
        rule: function() { return rule ? "solver rule: " + rule + ", pass " + numPasses : null }
      };

      //
      // MARK: main solving routine
      //

      // the main routine
      function *solve() {
        if (done || broken) return;
        var maxPasses = 50;
        for (numPasses = 1; numPasses < maxPasses; numPasses++) {
          var previousBoard = angular.copy(board);
          for (var ruleIndex = 0; !broken && ruleIndex < ruleNames.length; ruleIndex++) {
            rule = ruleNames[ruleIndex];
            var iterator = rules[rule]();
            for (var step = iterator.next(); !broken && !step.done; step = iterator.next()) {
              yield null;
            }
          }
          $scope.highlight = null;
          if (!broken) {
            message = null;
            console.log("Finished pass", numPasses, "through rules");
            if (possiblesMatch(previousBoard)) break;
          }
        }
        if (broken) {
          console.log("BROKEN!!!");
          console.log("no values possible in cell");
          message = "BROKEN!<br>no values possible in cell";
          $scope.setCursor(broken.i, broken.j);
        } else {
          console.log("DONE!!!");
          done = true;
          message = "DONE!";
        }
        rule = null;
        /* TODO make a judgment whether it's worth it to look for solutions (limit # of unsolved cells for example)
        if (!$scope.solved) {
          var numSolutions = countSolutions(board, $scope.cages, 0);
          console.log(numSolutions + " solutions!");
        }
        */
        yield null;
        message = null;
        done = false;
        broken = null;
        stepIterator = null;
      }

      function step() {
        if (!stepIterator) stepIterator = solve();
        return stepIterator.next();
      }

      function solveFully() {
        while (!step().done) {}
      }

      //
      // MARK: initialization and resetting
      //

      function initializeCages() {
        // reset cages
        cages = [];
        cageExists = {};

        // copy puzzle cages to our solver's cage list, with real cells inside instead of coordinates
        $scope.cages.forEach(function(c) {
          var cage = angular.copy(c);
          cage.cells.forEach(function(coords, i) {
            cage.cells[i] = board[coords[0]][coords[1]];
          });
          addCage(cage);
        });

        rowsAndColumns.forEach(function(cells) {
          addCage({op: "+", total: rowTotal, cells: cells, collisionChecked: true});
          addCage({op: "*", total: rowProduct, cells: cells, collisionChecked: true});
        });
      }

      function reset() {
        // in each cell, reset solution, guess, and possible values
        rows.forEach(function (cells) {
          cells.forEach(function (cell) {
            cell.possible = pNew(boardSize);
            delete cell.solution;
            delete cell.guess;
          })
        });

        initializeCages();
        stepIterator = null;

        done = false;
      }

      //
      // MARK: managing possible values in cells
      //

      // check possible values in previous board against current board
      function possiblesMatch(previousBoard) {
        for (var i = 0; i < boardSize; i++) {
          for (var j = 0; j < boardSize; j++) {
            if (!board[i][j].possible.matches(previousBoard[i][j].possible)) return false;
          }
        }
        return true;
      }

      // eliminate possible values in a cell
      function *clear(cell, values, why, cage) {
        if (!(values instanceof Array)) values = [values];
        if (pYes(cell.possible, values)) {
          values = values.filter(function(v) { return (pYes(cell.possible, v)); });
          $scope.highlight = cage ? cage.cells : null;
          console.log("%s clear %s: %s", cellName(cell), values.join(","), why);
          message = "clear " + values.join("") + "<br>" + why;
          $scope.setCursor(cell.i, cell.j);
          $scope.cursorHidden = false;
          yield null;
          pClear(cell.possible, values);
          if (pCount(cell.possible) == 0) {
            broken = cell;
          } else if (pCount(cell.possible) == 1) {
            yield *solveCell(cell, pFirstValue(cell.possible));
          }
        }
      }

      // set a single value as the only possibility in a cell
      function *setOnly(cell, n, why, cage) {
        if (cell.solution != n) {
          $scope.highlight = cage ? cage.cells : null;
          console.log("%s set! %d: %s", cellName(cell), n, why);
          message = "set " + n + "<br>" + why;
          $scope.setCursor(cell.i, cell.j);
          $scope.cursorHidden = false;
          yield null;
          pSetOnly(cell.possible, n);
          yield *solveCell(cell, n);
        }
      }

      // set a cell to a particular value, and clear that value from other cells in its row and column
      // if the cell lives in a cage of 3 or more cells, make a smaller cage with the remaining cells
      function *solveCell(cell, n) {
        if (cell.ans != n) console.log("!!!!! WRONG");
        console.log("SOLVED " + cellName(cell) + " = " + n);
        message = "cell solved: " + n + "<br>clearing " + n + " from row and column";
        cell.solution = n;
        $scope.setCursor(cell.i, cell.j);
        $scope.guess(cell.i, cell.j, n);

        var linesToClear = rows[cell.i].concat(columns[cell.j]);
        linesToClear.forEach(function(otherCell) {
          if (!otherCell.solution) pClear(otherCell.possible, n);
        });

        $scope.highlight = linesToClear;
        yield null;

        // clear row & column
        yield *linesToClear.yieldEach(function*(otherCell) {
          if (!otherCell.solution && pCount(otherCell.possible) == 1) {
              yield *solveCell(otherCell, pFirstValue(otherCell.possible));
          }
        });

        // find unsolved cells in cage
        var cage = cages[cell.cage];
        var reduced = reduceCage(cage);

        if (reduced.cells.length == 0) {     // no unsolved cells? mark cage solved
          console.log("CAGE SOLVED", cageName(cage));
          cage.solved = true;
        } else if (reduced.total) {          // if cage total was reducible
          if (reduced.cells.length == 1) {   //   only one cell? solve it
            yield *setOnly(reduced.cells[0], reduced.total, "last cell left in " + math(cage) + " cage", cage);
          } else {                           //   more than one? make a new cage
            yield *addCageAndYield(reduced, "leftovers after solving cell");
          }
        }

      }

      // find the unsolved cells in a cage, and if possible return a new cage with those cells
      // it's possible if: 1) there are any unsolved cells at all, and 2) the cage op is + or x
      // returns { op: <op>, total: <total of unsolved cells>, cells: <unsolved cells> }
      // if reduction is not possible, op and total are omitted
      function reduceCage(cage) {
        var reducible = "+x".includes(cage.op);
        var total = cage.total;
        var unsolvedCells = cage.cells.filter(function (c) {
          if (c.solution && reducible) total = opReduce(cage.op, total, c.solution);
          return !c.solution;
        });
        var result = { cells: unsolvedCells };
        if (reducible && unsolvedCells.length > 1) result.op = cage.op;
        if (reducible && unsolvedCells.length > 0) result.total = total;
        return result;
      }

      //
      // MARK: managing cages
      //

      // add a cage to the cage list
      function addCage(cage, why) {
        var key = cage.op;
        cage.cells.forEach(function (cell) {
          key += ";" + cell.i + "," + cell.j;
        });
        if (cageExists[key]) return false;
        if (why) {
          console.log("add cage " + cageName(cage) + ": " + why);
          message = "add cage " + math(cage) + "<br>" + why;
          $scope.highlight = cage.cells;
          $scope.cursorHidden = true;
        }
        if (cage.cells[0].cage == cage.id) {
          // the puzzle's original cages are guaranteed not to overlap
          cage.collisionChecked = true;
          cage.subcageChecked = true;
        }
        cages.push(cage);
        cageExists[key] = true;
        cage.line = oneLine(cage.cells);
        return true;
      }

      function *addCageAndYield(cage, why, highlightCage) {
        if (!"+x".includes(cage.op)) return; // only + and x cages can be added by solver
        if (!highlightCage) highlightCage = cage;
        var reduced = reduceCage(cage);
        if (reduced.cells.length == 0) return;  // no unsolved cells? don't add
        if (reduced.cells.length == 1) {
          // one cell? solve it, don't add
          yield *setOnly(reduced.cells[0], reduced.total, why, highlightCage);
        } else {
          // same number of cells as possible values? then cage math tells us nothing; don't add
          if (pCount(allPossible(reduced.cells)) == reduced.cells.length) return;
          if (addCage(reduced, why)) yield;
        }
      }

      // if cells are all in the same row or column, return the line number
      // if they're not in line, return null
      // line number = row number for rows, boardSize + column number for columns
      function oneLine(cells) {
        var i = cells[0].i, j = cells[0].j;
        cells.forEach(function (cell) {
          if (i != null && cell.i != i) i = null;
          if (j != null && cell.j != j) j = null;
        });
        // return a proper index into rowsAndColumns
        return i != null ? i : j != null ? boardSize + j : null;
      }

      function cellLines(cells) {
        var lines = [];
        cells.forEach(function(cell) {
          lines[cell.i] = true;
          lines[cell.j + boardSize] = true;
        });
        var result = [];
        lines.forEach(function(line, i) { if (line) result.push(i); });
        return result;
      }

      function cellInLine(cell, line) {
        return (line < boardSize ? cell.i == line : cell.j == line - boardSize);
      }

      function rowAndColumnPossibles() {
        var possibles = [];
        for (var i = 0; i < boardSize * 2; i++) {
          possibles[i] = pNew(boardSize);
        }
        return possibles;
      }

      function cageCanFinish(op, total, cells, possibles) {
        // if (cells.length == 0 || op != '+' || op != 'x') return false;

        var row = cells[0].i, column = cells[0].j + boardSize;

        function isPossible(value) {
          return pYes(cells[0].possible, value) && pYes(possibles[row], value) && pYes(possibles[column], value);
        }

        if (cells.length == 1) return isPossible(total);

        var otherCells = cells.slice(1);

        for (var n = 1; n <= boardSize; n++) {
          if (isPossible(n)) {
            var remainder = op == '+' ? total - n : total / n;
            if (remainder > 0 && remainder == Math.round(remainder)) {
              pClear(possibles[row], n);
              pClear(possibles[column], n);
              if (cageCanFinish(op, remainder, otherCells, possibles)) return true;
              pSet(possibles[row], n);
              pSet(possibles[column], n);
            }
          }
        }

        return false;

      }


      //
      // MARK: convenient yield loops
      //

      // yield all unsolved cages of type op (to get all unsolved cages, use null op)
      function *yieldCages(op, fn) {
        yield *cages.yieldEach(function*(cage) {
          if (!cage.solved && (!op || cage.op == op)) {
            yield *fn(cage);
          }
        });
      }

      // yield unsolved cells in all unsolved cages of type op (to get all unsolved cages, use null op)
      // fn params are (cage, cell, i), where i is index of cell in cage.cells
      function *yieldCageCells(op, fn) {
        yield *yieldCages(op, function*(cage) {
          yield *cage.cells.yieldEach(function*(cell, i) {
            if (!cell.solution) {
              yield *fn(cage, cell, i);
            }
          });
        });
      }

      //
      // MARK: solver rules
      //

      var rules = {
        "singleton": function*() {
          // if a cage has one cell, cell value is the cage total
          yield *yieldCages(null, function*(cage) {
            if (cage.cells.length == 1) {
              yield *setOnly(cage.cells[0], cage.total, "singleton cage");
            }
          });
        },

        "zero or one": function*() {
          // if a cell has one possible value, that is its solution
          // if a cell has no possible values, the puzzle is broken
          yield *rows.yieldEach(function*(cells) { yield *cells.yieldEach(function*(cell) {
            if (!cell.solution && pCount(cell.possible) == 1) {
              yield *solveCell(cell, pFirstValue(cell.possible), "only possible value");
            } else if (pCount(cell.possible) == 0) {
              broken = cell;
            }
          })});
        },

        "divisor": function*() {
          yield *yieldCageCells("x", function*(cage, cell) {
            var nondivisors = [];
            pEach(cell.possible, function (n) {
              if (cage.total % n != 0) nondivisors.push(n);
            });
            if (nondivisors.length > 0) yield *clear(cell, nondivisors, "not a divisor of " + cage.total, cage);
          });
        },

        "addition": function*() {
          // eliminate values that can't complete a multiplication cage
          yield *yieldCages("+", function*(cage) {
            var remainder = cage.total;
            var openCells = [];

            cage.cells.forEach(function (cell) {
              if (cell.solution) remainder -= cell.solution;
              else openCells.push(cell);
            });

            if (openCells.length == 1) {
              yield *solveCell(openCells[0], remainder);
            } else if (openCells.length < 4) {
              yield *openCells.yieldEach(function*(cell) {
                var values = [];
                var otherCells = arraySubtract(openCells, [cell]);
                pEach(cell.possible, function (n) {
                  var possibles = rowAndColumnPossibles();
                  pClear(possibles[cell.i], n);
                  pClear(possibles[cell.j + boardSize], n);
                  if (!cageCanFinish('+', remainder - n, otherCells, possibles)) {
                    values.push(n);
                  }
                  pSet(possibles[cell.i], n);
                  pSet(possibles[cell.j + boardSize], n);
                });
                if (values.length > 0) yield *clear(cell, values, "can't make " + math(cage) + " with other cells", cage);
              });
            }
          });

        },

        "division": function*() {
          // eliminate values that can't complete a division cage
          yield *yieldCageCells("/", function*(cage, cell, i) {
            var values = [];
            var otherCell = cage.cells[1 - i];
            pEach(cell.possible, function (n) {
              if (!pYes(otherCell.possible, [n * cage.total, n / cage.total])) {
                values.push(n);
              }
            });
            if (values.length > 0) yield *clear(cell, values, "can't make " + math(cage) + " with other cell", cage);
          });
        },

        "multiplication": function*() {
          // eliminate values that can't complete a multiplication cage
          yield *yieldCages("x", function*(cage) {
            var remainder = cage.total;
            var openCells = [];

            cage.cells.forEach(function (cell) {
              if (cell.solution) remainder /= cell.solution;
              else openCells.push(cell);
            });

            if (openCells.length == 1) {
              yield *solveCell(openCells[0], remainder);
            } else {
              yield *openCells.yieldEach(function*(cell) {
                var values = [];
                pEach(cell.possible, function (n) {
                  var otherCells = arraySubtract(openCells, [cell]);
                  var possibles = rowAndColumnPossibles();
                  pClear(possibles[cell.i], n);
                  pClear(possibles[cell.j + boardSize], n);
                  if (!cageCanFinish('x', remainder / n, otherCells, possibles)) {
                    values.push(n);
                  }
                  pSet(possibles[cell.i], n);
                  pSet(possibles[cell.j + boardSize], n);

                });
                if (values.length > 0) yield *clear(cell, values, "can't make " + math(cage) + " with other cells" , cage);
              });
            }
          });

        },

        "pigeonhole": function*() {
          // If possibility occurs only once in a row or column, it must appear there

          yield *rowsAndColumns.yieldEach(function*(cells, line) {
            var rowOrCol = line < boardSize ? "row" : "column";
            for (var n = 1; n <= boardSize; n++) {
              var count = 0, target = null;
              cells.forEach(function (cell) {
                if (pYes(cell.possible, n)) {
                  count++;
                  target = cell;
                }
              });
              if (count == 1 && !target.solution) {
                yield *setOnly(target, n, "only place left in " + rowOrCol + " for " + n, {cells: cells});
              }
            }
          });
        },

        "subtraction": function*() {
          // Check legal subtraction possibilities
          yield* yieldCageCells('-', function*(cage, cell, i) {
            var values = [];
            var otherCell = cage.cells[1 - i];
            pEach(cell.possible, function (n) {
              if (!pYes(otherCell.possible, [n + cage.total, n - cage.total])) {
                values.push(n);
              }
            });
            if (values.length > 0) yield *clear(cell, values, "can't make " + math(cage) + " with other cell", cage);
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
              if (pCount(cellA.possible) == 2) {
                for (var j = i + 1; j < boardSize; j++) {
                  var cellB = cells[j];
                  if (cellB.possible.matches(cellA.possible)) {
                    // two-pair found! remove these two values from all other cells
                    var otherCells = arraySubtract(cells, [cellA, cellB]);
                    var vals = pValues(cellA.possible);
                    var why = "" + vals[0] + " " + vals[1] + " pair lives in other cells";
                    yield *otherCells.yieldEach(function*(cell) {
                      yield *clear(cell, vals, why, {cells: [cellA, cellB]});
                    });
                    // is pair in same cage? cage bigger than 2? then make a subcage with leftover cells
                    if (cellA.cage == cellB.cage && cages[cellA.cage].cells.length > 2) {
                      var cage = cages[cellA.cage];
                      var subCage = {
                        op: cage.op,
                        total: opReduce(cage.op, cage.total, vals),
                        cells: arraySubtract(cage.cells, [cellA, cellB])
                      };
                      yield *addCageAndYield(subCage, "leftovers after pair");
                    }
                  }
                }
              }
            }
          });
        },

        "three": function*() {
          // If the possibilities of three cells in the same row or column all equal the same 3
          // numbers, those three numbers must occupy those cells, and therefore aren't possible
          // in any other cells in the same row/column.

          yield *rowsAndColumns.yieldEach(function*(cells, line) {
            var rowOrCol = line < boardSize ? "row" : "column";
            for (var i = 0; i < boardSize - 2; i++) {
              var cellA = cells[i];
              if (cellA.solution || pCount(cellA.possible) > 3) continue;
              for (var j = i + 1; j < boardSize - 1; j++) {
                var cellB = cells[j];
                if (cellB.solution || pCount(cellB.possible) > 3) continue;
                var possibleAB = pUnion(cellA.possible, cellB.possible);
                if (pCount(possibleAB) > 3) continue;
                for (var k = j + 1; k < boardSize; k++) {
                  var cellC = cells[k];
                  if (cellC.solution || pCount(cellC.possible) > 3) continue;
                  var possibleABC = pUnion(possibleAB, cellC.possible);
                  if (pCount(possibleABC) == 3) {
                    // threesome found! remove these three values from all other cells
                    var otherCells = arraySubtract(cells, [cellA, cellB, cellC]);
                    var vals = pValues(possibleABC);
                    var why = "" + vals[0] + " " + vals[1] + " " + vals[2] + " triplet lives in other cells";
                    yield *otherCells.yieldEach(function*(cell) {
                      yield *clear(cell, vals, why, {cells: [cellA, cellB, cellC]});
                    });
                    // is threesome in same cage? cage bigger than 3? then make a subcage with leftover cells
                    if (cellA.cage == cellB.cage && cellA.cage == cellC.cage && cages[cellA.cage].cells.length > 3) {
                      var cage = cages[cellA.cage];
                      var subCage = {
                        op: cage.op,
                        total: opReduce(cage.op, cage.total, vals),
                        cells: arraySubtract(cage.cells, [cellA, cellB, cellC])
                      };
                      yield *addCageAndYield(subCage, "leftovers after threesome");
                    }
                  }
                }
              }
            }
          });
        },

        "two and two": function*() {
          // if a value must occupy either column A or B in two different rows,
          // eliminate that value in all other rows of A and B
          var pairs = [];

          yield *[rows, columns].yieldEach(function*(lines) {

            var linesAreRows = lines == rows;
            var crossers = linesAreRows ? columns : rows;
            var lineLabel = linesAreRows ? "row" : "column";
            var crosserLabel = linesAreRows ? "column" : "row";

            // reset pairs
            for (var n = 1; n <= boardSize; n++) pairs[n] = [];

            // scan lines for pairs
            lines.forEach(function (cells, line) {
              // count how many cells each value is possible in
              for (var n = 1; n <= boardSize; n++) {
                var cellsWithValue = [];
                cells.forEach(function (cell, i) {
                  if (pYes(cell.possible, n)) {
                    if (cellsWithValue.length < 3) cellsWithValue.push(i); // don't collect past 3 occurrences
                  }
                });
                // if only two cells have this value, it's a pair! save it
                if (cellsWithValue.length == 2) pairs[n].push({line: line, cells: cellsWithValue});
              }
            });

            // any pair of line pairs share the same crossers?
            for (n = 1; n <= boardSize; n++) {
              if (pairs[n].length > 1) {
                // look for a match
                for (var j = 0; j < pairs[n].length - 1; j++) {
                  for (var k = j + 1; k < pairs[n].length; k++) {
                    var pairA = pairs[n][j], pairB = pairs[n][k];
                    if (pairA.cells.matches(pairB.cells)) {
                      // found one!
                      var i1 = pairA.line, i2 = pairB.line, j1 = pairA.cells[0], j2 = pairA.cells[1];
                      var foursome = linesAreRows ?
                        [board[i1][j1], board[i1][j2], board[i2][j1], board[i2][j2]] :
                        [board[j1][i1], board[j1][i2], board[j2][i1], board[j2][i2]];
                      var why = "this " + crosserLabel + "'s " + n + " must occur in " +
                        lineLabel + " " + i1 + " or " + i2;
                      yield *pairA.cells.yieldEach(function*(pairCell) {
                        yield *crossers[pairCell].yieldEach(function*(cell) {
                          var thisLine = linesAreRows ? cell.i : cell.j;
                          if (thisLine != pairA.line && thisLine != pairB.line) {
                            yield *clear(cell, n, why, {cells: foursome});
                          }
                        });
                      });
                    }
                  }
                }
              }
            }
          });
        },

        "must-have divisor": function*() {
          var n = boardSize;
          var mustHaveDivisors = n < 6 ? [3, 5] : n > 6 ? [5, 7] : [5];
          yield *yieldCageCells('x', function*(cage) { if (cage.line != null) {
            yield *mustHaveDivisors.yieldEach(function*(d) {
              if (cage.total % d == 0) {
                var why = math(cage) + " cage needs the " + d;
                yield *rowsAndColumns[cage.line].yieldEach(function*(cell) {
                  if (cage.cells.indexOf(cell) < 0) yield *clear(cell, d, why, cage);
                });
              }
            });
          }});
        },

        // TODO make this work when cage.op != 'x'
        "must have in line": function*() {
          var lineValues = pNew(boardSize);
          yield *yieldCages(null, function*(cage) { if (cage.cells.length < 4) {
            var allValues = rowAndColumnPossibles();
            var lines = cellLines(cage.cells);
            eachSolution(cage, function(solution) {
              lines.forEach(function(line) {
                pClearAll(lineValues);
                cage.cells.forEach(function(cell, i) {
                  if (cellInLine(cell, line)) { pSet(lineValues, solution[i]); }
                });
                allValues[line] = pIntersect(allValues[line], lineValues);
              })
            });
            yield *lines.yieldEach(function*(line) {
              if (pCount(allValues[line]) > 0) {
                var rowOrCol = line < boardSize ? "row" : "column";
                var why = math(cage) + " cage needs the " + pString(allValues[line]) + " in this " + rowOrCol;
                yield *rowsAndColumns[line].yieldEach(function*(cell) {
                  if (cage.cells.indexOf(cell) < 0) yield *clear(cell, pValues(allValues[line]), why, cage);
                });
              }
            });
          }});
        },

        "line sum": function*() {
          yield *rowsAndColumns.yieldEach(function*(cells, line) {
            var rowOrColumn = line < boardSize ? "row" : "column";
            var why = "remainder of " + rowOrColumn + " sum";
            var remainder = rowTotal;
            for (var i = 0; i < cells.length; i++) {
              var cell = cells[i], cage = cages[cell.cage];
              if (cage.op == '+' && cage.line == line) {
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
              yield *setOnly(cells[0], remainder, why);
            } else if (cells.length > 1 && cells.length <= boardSize / 2) {
              yield *addCageAndYield({ op: '+', total: remainder, cells: cells }, why);
            }
          });
        },

        "line product": function*() {
          yield *rowsAndColumns.yieldEach(function*(cells, line) {
            var rowOrColumn = line < boardSize ? "row" : "column";
            var why = "remainder of " + rowOrColumn + " product";
            var remainder = rowProduct;
            for (var i = 0; i < cells.length; i++) {
              var cell = cells[i], cage = cages[cell.cage];
              if (cage.op == 'x' && cage.line == line) {
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
              yield *setOnly(cells[0], remainder, why);
            } else if (cells.length > 1 && cells.length <= boardSize / 2) {
              yield *addCageAndYield({ op: 'x', total: remainder, cells: cells }, why);
            }
          });
        },

        "double math": function*() {
          // if two cages have the same cells but different math, there is likely only one set of numbers that works
          var valid = pNew(boardSize);
          yield *yieldCages(null, function*(cage) { if (!cage.collisionChecked) {
            yield *yieldCages(null, function*(otherCage) { if (cage != otherCage && cage.cells.matches(otherCage.cells)) {
              // found two cages with same cells! now identify the values that can satisfy both maths
              pClearAll(valid);
              eachSolution(cage, function(solution) {
                if (valuesWork(otherCage.op, otherCage.total, solution)) pSet(valid, solution);
              });
              // restrict all cells to those values
              var why = "only " + pValues(valid).join(" ") + " satisfy both " + math(cage) + " and " + math(otherCage);
              var invalidValues = pValues(pInvert(valid));
              yield *cage.cells.yieldEach(function*(cell) { if (!cell.solution) {
                yield *clear(cell, invalidValues, why, cage);
              }})
            }});
            cage.collisionChecked = true;
          }});
        },

        "subtract subcage": function*() {
          var valid = pNew(boardSize);
          yield *yieldCages(null, function*(cage) { if (!cage.subcageChecked) {
            yield *yieldCages(null, function*(otherCage) {
              if (cage.op == otherCage.op && subsets(cage.cells, otherCage.cells)) {
                // found subcage!
                var superCage = cage.cells.length > otherCage.cells.length ? cage : otherCage;
                var subCage = superCage == cage ? otherCage : cage;
                var total = opReduce(cage.op, superCage.total, subCage.total);
                var cells = arraySubtract(superCage.cells, subCage.cells);
                var newCage = { op: cage.op, total: total, cells: cells};
                var why = math(subCage) + " from " + math(superCage) + " leaves " + math(newCage);
                yield *addCageAndYield(newCage, why);
              }
            });
            cage.subcageChecked = true;
          }});
        },

        // TODO something's wrong with this
        // (may be underlying problem w eachSolution: see must have in line with
        "not both": function*() {
          // if a cell has only two possible values, no inline cage in its row or column can use both of those values
          yield *rows.yieldEach(function*(cells) { yield *cells.yieldEach(function*(cell) {
            if (pCount(cell.possible) == 2) {
              var vals = pValues(cell.possible);
              // check inline cages in this line
              yield *yieldCages(null, function*(cage) {
                if (cage.line == cell.i || cage.line == cell.j + boardSize) {
                  var rowOrCol = cell.line < boardSize ? "row" : "column";
                  if (cage.cells.indexOf(cell) == -1) {
                    var validSolutions = [];
                    eachSolution(cage, function (solution) {
                      if (solution.indexOf(vals[0]) < 0 || solution.indexOf(vals[1]) < 0) {
                        // solution doesn't use both values! it's valid
                        validSolutions.push(solution);
                      }
                    });
                    var possible = pNew(boardSize);
                    yield *cage.cells.yieldEach(function*(cageCell, i) {
                      pClearAll(possible);
                      validSolutions.forEach(function (solution) {
                        pSet(possible, solution[i]);
                      });
                      var why = cellName(cell) + " must be " + vals[0] + " or " + vals[1] +
                        ", so cage can't use both in same " + rowOrCol;
                      yield *clear(cageCell, pValues(pInvert(possible)), why);
                    });
                  }
                }
              });
            }
          })});
        }

      };

      return solver;
    };

    function math(cage) {
      return "" + cage.total + cage.op;
    }

    // finds valid solutions to the cage and fires a callback function for each one
    function eachSolution(cage, fn) {
      var boardSize = pSize(cage.cells[0].possible);

      f(cage.total, cage.cells, fn, []);

      function f(total, cells, fn, acc) {
        if (cells.length == 1) {
          if (pYes(cells[0].possible, total)) fn(acc.concat([total]));
        } else {
          var restOfCells = cells.slice(1);
          pEach(cells[0].possible, function(n) {
            if (opLegal(cage.op, total, n, boardSize)) {
              var newTotals = opReduce(cage.op, total, n);
              if (!(newTotals instanceof Array)) newTotals = [newTotals];
              newTotals.forEach(function(newTotal) {
                f(newTotal, restOfCells, fn, acc.concat([n]));
              });
            }
          });
        }
      }
    }

    function countSolutions(board, cages, count) {
      if (count === undefined) count = 0;
      if (cages.length == 0) {
        return count + 1;
      }
      var cage = cages[0];
      var restOfCages = cages.slice(1);
      var solved = true;
      for (var c = 0; c < cage.cells.length; c++) {
        var i = cage.cells[c][0], j = cage.cells[c][1], cell = board[i][j];
        if (pCount(cell.possible) == 0) return count;    // not a solution! return without increasing count
        if (pCount(cell.possible) != 1) solved = false;  // mark as unsolved
      }
      if (solved) {
        // if this cage solved, go to next
        return countSolutions(board, restOfCages, count);
      } else {
        eachSolution2(cage.op, cage.total, cage.cells, board, function(solution) {
          var boardCopy = angular.copy(board);
          setSolution(boardCopy, cage, solution);
          count = countSolutions(boardCopy, restOfCages, count);
        });
      }
      return count;
    }

    function eachSolution2(op, total, cells, board, fn, acc) {
      if (acc === undefined) acc = [];

      var ij = cells[0], i = ij[0], j = ij[1], cell = board[i][j];

      if (cells.length == 1) {
        if (pYes(cell.possible, total)) fn(acc.concat([total]));
      } else {
        var restOfCells = cells.slice(1);
        pEach(cell.possible, function (n) {
          if (opLegal(op, total, n, board.length)) {
            var newTotals = opReduce(op, total, n);
            if (!(newTotals instanceof Array)) newTotals = [newTotals];
            newTotals.forEach(function (newTotal) {
              eachSolution2(op, newTotal, restOfCells, board, fn, acc.concat([n]));
            });
          }
        });
      }
    }

    function setSolution(board, cage, solution) {
      cage.cells.forEach(function(coords, c) {
        var i = coords[0], j = coords[1], cell = board[i][j], n = solution[c];
        if (!cell.solution) {
          pSetOnly(cell.possible, n);
          for (var ii = 0; ii < board.length; ii++) if (ii != i) pClear(board[ii][j].possible, n);
          for (var jj = 0; jj < board.length; jj++) if (jj != j) pClear(board[i][jj].possible, n);
        }
      });
    }

    // TODO do pUnion and pIntersect in-place
    function allPossible(cells) {
      if (cells.length == 0) return null;
      var p = angular.copy(cells[0].possible);
      for (var i = 1; i < cells.length; i++) p = pUnion(p, cells[i].possible);
      return p;
    }

    function opLegal(op, total, n, boardSize) {
      if (op == "+") return total > n;
      if (op == "x") return total % n == 0;
      if (op == "-") return n - total > 0 || total + n <= boardSize;
      if (op == "/") return n % total == 0 || total * n <= boardSize;
    }

    function doOp(op, a, b) {
      if (op == "+") return a + b;
      if (op == "x") return a * b;
      if (op == "-") return [a - b, b - a].filter(function(x) { return x > 0; });
      if (op == "/") return [a % b == 0 ? a / b : false, b % a == 0 ? b / a : false].filter(function(x) { return x; });
    }

    function opReduce(op, total, n) {
      if (n instanceof Array) {
        n.forEach(function(nn) { total = opReduce(op, total, nn); });
        return total;
      }
      if (op == "+") return total - n;
      if (op == "x") return total / n;
      if (op == "-") return [n + total, n - total].filter(function(x) { return x > 0; });
      if (op == "/") return [n % total == 0 ? n / total : false, n * total].filter(function(x) { return x; });
    }

    // returns true if performing the operation on the values produces the total
    function valuesWork(op, total, values) {
      if (op == "/") return values[0] / values[1] == total || values[1] / values[0] == total;
      if (op == "-") return Math.abs(values[0] - values[1]) == total;
      if (op == "+" || op == "x") {
        var result = op == "+" ? 0 : 1;
        values.forEach(function (v) { result = op == "+" ? result + v : result * v; });
        return result == total;
      }
      return false;
    }

    //
    // MARK: tracking possible values
    //

    // to track possible values we use an array p of length n, where n is the size of the board
    // p[i] == true if i is a possible value in the cell, false otherwise
    // p[0] stores the count of possible values
    // the following functions maintain this

    function pNew(n, fill) {
      if (fill === undefined) fill = true;
      var p = [n];
      for (var i = 1; i <= n; i++) p[i] = fill;
      return p;
    }
    function pSetAll(p) {
      for (var i = 1; i < p.length; i++) p[i] = true;
      p[0] = p.length - 1;
    }
    function pClearAll(p) {
      for (var i = 1; i < p.length; i++) p[i] = false;
      p[0] = 0;
    }
    function pSet(p, x) {
      if (x instanceof Array) x.forEach(function(k) { pSet(p, k); });
      else if (x > 0 && x < p.length && !p[x]) { p[x] = true; p[0]++; }
    }
    function pClear(p, x) {
      if (x instanceof Array) x.forEach(function(k) { pClear(p, k); });
      else if (x > 0 && x < p.length && p[x]) { p[x] = false; p[0]--; }
    }
    function pSetOnly(p, x) {
      pClearAll(p); pSet(p, x);
    }
    function pYes(p, x) {
      if (x instanceof Array) {
        for (var i = 0; i < x.length; i++) if (pYes(p, x[i])) return true;
        return false;
      } else {
        return (x > 0 && x < p.length && p[x]);
      }
    }
    function pCount(p) {
      return p[0];
    }
    function pSize(p) {
      return p.length - 1;
    }
    function pEach(p, fn) {
      for (var i = 1; i < p.length; i++) if (p[i]) fn(i);
    }
    function pValues(p) {
      var values = [];
      pEach(p, function(i) { values.push(i); });
      return values;
    }
    function pFirstValue(p) {
      return p.indexOf(true);
    }
    function pUnion(a, b) {
      var p = pNew(Math.max(pSize(a), pSize(b)));
      for (var i = 1; i < p.length; i++) if (!a[i] && !b[i]) pClear(p, i);
      return p;
    }
    function pIntersect(a, b) {
      var p = pNew(Math.min(pSize(a), pSize(b)));
      for (var i = 1; i < p.length; i++) if (!a[i] || !b[i]) pClear(p, i);
      return p;
    }
    function pInvert(p) {
      var q = [];
      q[0] = (p.length - 1) - p[0];
      for (var i = 1; i < p.length; i++) q[i] = !p[i];
      return q;
    }
    function pString(p) {
      return pValues(p).join("");
    }

    //
    // MARK: convenience functions
    //

    // string for describing a cell in console output
    function cellName(cell) { return "(" + cell.i + "," + cell.j + ")"; }

    // string for describing a cage in console output
    function cageName(cage) {
      var name = "[" + math(cage);
      cage.cells.forEach(function(cell, i) {
        name += (i > 0 ? "," : " ") + cellName(cell);
      });
      cage.cells.forEach(function(cell, i) {
        name += (i > 0 ? "," : " ") + pString(cell.possible);
      });
      return name + "]";
    }

    //
    // MARK: utility functions
    //

    // sum of integers from 1 to n
    function arithSum(n) {
      return (n + 1) * n / 2
    }

    // product of integers from 1 to n
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

    function rowsToColumns(a) {
      var columns = [];
      for (var j = 0; j < a[0].length; j++) {
        columns[j] = [];
        for (var i = 0; i < a.length; i++) {
          columns[j].push(a[i][j]);
        }
      }
      return columns;
    }

    // returns true if the arrays are different lengths and the smaller is a subset of the larger
    function subsets(a, b) {
      if (a.length == b.length) return false; // strict subsets, not same set
      var big = a.length > b.length ? a : b;
      var lil = a.length > b.length ? b : a;
      for (var i = 0; i < lil.length; i++) {
        if (big.indexOf(lil[i]) < 0) return false;
      }
      return true;
    }

    Array.prototype.yieldEach = function*(fn) {
      for (var i = 0; i < this.length; i++) yield* fn(this[i], i);
    };

    Array.prototype.matches = function(b) {
      if (b.length != this.length) return false;
      for (var i = 0; i < this.length; i++) {
        if (b[i] != this[i]) return false;
      }
      return true;
    };


  });