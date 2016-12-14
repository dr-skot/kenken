angular.module('kenkenApp')
  .service('KenkenSolver', function() {

    // MARK: Possibles datatype

    // helps keep track of what values are possible in a given cell
    function Possibles(n) {
      var a = [];
      var count = 0;

      this.setAll = function() {
        for (var i = 1; i <= n; i++) a[i] = true;
        count = n;
      };

      this.clearAll = function() {
        for (var i = 1; i <= n; i++) a[i] = false;
        count = 0;
      };

      this.set = function(i) {
        if (i > 0 && i <= n && !a[i]) {
          a[i] = true;
          count += 1;
        }
      };

      this.setOnly = function(i) {
        this.clearAll();
        this.set(i);
      };

      this.clear = function(i) {
        if (i > 0 && i <= n && a[i]) {
          a[i] = false;
          count -= 1;
        }
      };

      this.includes = function(i) {
        return i > 0 && i <= n && a[i];
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
        for (var i = 1; i <= n; i++) if (!a[i] && !b[i]) union.clear(i);
        return union;
      };

      this.setAll();
      return this;
    }

    // END Possibles datatype


    this.solve = function(puzzle) {

      var board = puzzle.board;
      var boardSize = board.length;
      var rowTotal = (boardSize + 1) * boardSize / 2;

      var rows = board;
      var columns = [];
      for (var j = 0; j < boardSize; j++) {
        columns[j] = [];
        for (var i = 0; i < boardSize; i++) {
          columns[j].push(board[i][j]);
        }
      }
      var rowsAndColumns = rows.concat(columns);

      function cellAt(coords) { return board[coords[0]][coords[1]]; }


      // MARK: cage management

      var cages = [];      // all cages in puzzle, plus new ones we'll make
      var cageExists = {}; // avoid duplicates when we make new cages
      function addCage(cage) {
        var key = cage.op;
        cage.cells.forEach(function(cell) { key += ";" + cell.i + "," + cell.j; });
        if (!cageExists[key]) {
          cages.push(cage);
          cageExists[key] = true;
        }
      }
      // copy puzzle cages to our solver's cage list, with real cells inside instead of coordinates
      puzzle.cages.forEach(function(c) {
        var cage = angular.copy(c);
        cage.cells.forEach(function(coords, i) { cage.cells[i] = cellAt(coords); });
        addCage(cage);
      });

      // MARK: convenience functions

      function arraySubtract(a, b) {
        var result = [];
        a.forEach(function(elem) {
          if (b.indexOf(elem) == -1) result.push(elem);
        });
        return result;
      }

      function forEachCell(callback) {
        board.forEach(function(row) { row.forEach(callback); });
      }

      function cellsInLine(cells) {
        var i = cells[0].i; j = cells[0].j
        cells.forEach(function(cell) {
          if (i > -1 && cell.i != i) i = -1;
          if (j > -1 && cell.j != j) j = -1;
        });
        // return a proper index into rowsAndColumns
        if (i > -1) return i;
        else if (j > -1) return boardSize + j;
        else return false;
      }

      function clear(cell, n, why) {
        if (cell.possible.includes(n)) {
          cell.possible.clear(n);
          console.log("clearing %s from cell %d, %d: %s", n, cell.i, cell.j, why);
          //console.log("possible count", cell.possible.count());
          if (cell.possible.count() == 1) {
            cell.solution = cell.possible.values()[0];
            cell.guess = cell.solution;
          }
        }
      }

      function clearValues(cell, values, why) {
        values.forEach(function(n) { clear(cell, n, why); });
      }

      function setOnly(cell, n, why) {
        if (cell.solution != n) {
          cell.possible.setOnly(n);
          cell.solution = n;
          cell.guess = n;
          console.log("setting %d in cell %d, %d: %s", n, cell.i, cell.j, why);
        }
      }

      var rules = {

        "singletons": function() {
          // if cage has only one cell, that cell must contain the cage total
          cages.forEach(function(cage) {
            if (cage.cells.length == 1) {
              setOnly(cage.cells[0], cage.total, "singleton cage");
            }
          });
        },

        "addition": function() {
          // Check legal addition possibilities
          cages.forEach(function(cage) {
            if (cage.op == "+") {
              var remainder = cage.total;
              var openCells = [];

              cage.cells.forEach(function(cell) {
                // Calculate remainder of each cell
                if (cell.solution) remainder -= cell.solution;
                else openCells.push(cell);
              });

              openCells.forEach(function(cell) {
                cell.possible.forEach(function(n) {
                  if (n + openCells.length - 1 > remainder) {
                    clear(cell, n, "went bust");
                  }
                });
              });

              if (openCells.length == 1) {
                setOnly(openCells[0], remainder, "last cell in cage");
              } else if (openCells.length == 2) {
                var binaryRemoval = function(cell, otherCell) {
                  cell.possible.forEach(function(n) {
                    if (!otherCell.possible.includes(remainder - n) ||
                      (cage.cells.length == 2 && n + n == remainder)) {
                      clear(cell, n, "otherCell can't accommodate");
                    }
                  });
                };
                binaryRemoval(openCells[0], openCells[1]);
                binaryRemoval(openCells[1], openCells[0]);
              }
            }
          });
        },

        "division": function() {
          // Check legal division possibilities
          cages.forEach(function(cage) {
            if (cage.op == "/") {
              var total = cage.total;

              var checkDivision = function(cell, otherCell) {
                if (cell.solution) return;
                cell.possible.forEach(function(n) {
                  if (!otherCell.possible.includes(n * total) && !otherCell.possible.includes(n / total)) {
                    clear(cell, n, "other cell can't accommodate");
                  }
                });
              };
              checkDivision(cage.cells[0], cage.cells[1]);
              checkDivision(cage.cells[1], cage.cells[0]);
            }
          });
        },

        "exclusion": function() {
          // Exclude known values from reappearing in same column or row

          var solvedInRow = {};
          var solvedInCol = {};
          var val;
          forEachCell(function(cell) {
            if (cell.solution) {
              if (!solvedInRow[cell.i]) solvedInRow[cell.i] = {};
              if (!solvedInCol[cell.j]) solvedInCol[cell.j] = {};
              solvedInRow[cell.i][cell.solution] = true;
              solvedInCol[cell.j][cell.solution] = true;
            }
          });

          forEachCell(function(cell) {
            if (!cell.solution) {
              for (val in solvedInRow[cell.i]) clear(cell, val, "no dups in row");
              for (val in solvedInCol[cell.j]) clear(cell, val, "no dups in column");
            }
          });
        },

        "multiplication": function() {
          // Check legal multiplication possibilities
          cages.forEach(function(cage) {
            if (cage.op == "x") {
              var remainder = cage.total;
              var openCells = [];

              cage.cells.forEach(function(cell) {
                if (cell.solution) remainder /= cell.solution;
                else openCells.push(cell);
              });

              openCells.forEach(function(cell) {
                cell.possible.forEach(function(n) {
                  if (remainder % n > 0) {
                    clear(cell, n, "not divisible");
                  }
                });
              });

              if (openCells.length == 1) {
                setOnly(openCells[0], remainder, "last cell in cage");
              } else if (openCells.length == 2) {
                var binaryRemoval = function(cell, otherCell) {
                  cell.possible.forEach(function(n) {
                    if (!otherCell.possible.includes(remainder / n) ||
                      (cage.cells.length == 2 && n * n == remainder)) {
                      clear(cell, n, "other cell can't accommodate");
                    }
                  });
                };
                binaryRemoval(openCells[0], openCells[1]);
                binaryRemoval(openCells[1], openCells[0]);
              }
            }
          });
        },

        "pigeonhole": function() {
          // If possibility occurs only once in a row or column, it must appear there

          var countPossible = function(counter, cell) {
            if (cell.solution) {
              if (!counter[cell.solution]) counter[cell.solution] = 0;
              counter[cell.solution]++;
            } else {
              cell.possible.forEach(function(n) {
                if (!counter[n]) counter[n] = 0;
                counter[n]++;
              });
            }
          };

          var filterSingletons = function(counter) {
            var singletons = {};
            for (var p in counter) if (counter[p] == 1) singletons[p] = p;
            return singletons;
          };

          var processSingletons = function(cell, singletons) {
            if (cell.solution) return;
            cell.possible.forEach(function(p) {
              if (singletons[p]) setOnly(cell, p, "pigeonholed");
            });
          };

          for (var i = 0; i < boardSize; i++) {
            var rowNumToCount = {};
            var colNumToCount = {};
            for (var j = 0; j < boardSize; j++) {
              countPossible(rowNumToCount, board[i][j]);
              countPossible(colNumToCount, board[j][i]);
            }
            var rowSingletons = filterSingletons(rowNumToCount);
            var colSingletons = filterSingletons(colNumToCount);

            for (j = 0; j < boardSize; j++) {
              processSingletons(board[i][j], rowSingletons);
              processSingletons(board[j][i], colSingletons);
            }
          }
        },

        "subtraction": function() {
          // Check legal subtraction possibilities
          cages.forEach(function(cage) {
            if (cage.op == "-") {
              var total = cage.total;

              var checkSubtraction = function (cell, otherCell) {
                if (cell.solution) return;
                cell.possible.forEach(function (n) {
                  if (!otherCell.possible.includes(n + total) && !otherCell.possible.includes(n - total)) {
                    clear(cell, n, "other cell can't accommodate");
                  }
                });
              };

              checkSubtraction(cage.cells[0], cage.cells[1]);
              checkSubtraction(cage.cells[1], cage.cells[0]);
            }
          });
        },

        "three": function() {
          // If the possibilities of three cells in the same row or column all equal the same 3
          // numbers, those three numbers must occupy those cells, and therefore aren't possible
          // in any other cells in the same row/column.
          if (boardSize <= 3) return;

          var getEliminated = function(coordsA, coordsB, coordsC) {
            var possibleA = cellAt(coordsA).possible;
            if (possibleA.count() != 2 && possibleA.count() != 3) return;

            var possibleB = cellAt(coordsB).possible;
            if (possibleB.count() != 2 && possibleB.count() != 3) return;

            var possibleC = cellAt(coordsC).possible;
            if (possibleC.count() != 2 && possibleC.count() != 3) return;

            var allPossible = possibleA.union(possibleB).union(possibleC);
            if (allPossible.length != 3) return;

            return allPossible;
          };

          for (var rowOrCol = 0; rowOrCol < boardSize; ++rowOrCol) {
            for (var fst=0; fst<boardSize-2; ++fst) {
              for (var snd=fst+1; snd<boardSize-1; ++snd) {
                for (var trd=snd+1; trd<boardSize; ++trd) {
                  var eliminatedRow = getEliminated([rowOrCol, fst], [rowOrCol, snd], [rowOrCol, trd]);
                  if (eliminatedRow) {
                    for (var elimCol=0; elimCol<boardSize; ++elimCol) {
                      if (elimCol == fst || elimCol == snd || elimCol == trd) continue;

                      var cell = board[rowOrCol][elimCol];
                      eliminatedRow.forEach(function(impossible) {
                        clear(cell, impossible, "three of a kind in row");
                      });
                    }
                  }

                  var eliminatedCol = getEliminated([fst, rowOrCol], [snd, rowOrCol], [trd, rowOrCol]);
                  if (eliminatedCol) {
                    for (var elimRow=0; elimRow<boardSize; ++elimRow) {
                      if (elimRow == fst || elimRow == snd || elimRow == trd) continue;

                      cell = board[elimRow][rowOrCol];
                      eliminatedCol.forEach(function(impossible) {
                        clear(cell, impossible, "three of a kind in column");
                      });
                    }
                  }
                }

              }
            }
          }
        },

        "two pair": function() {
          // If the possibilities of two cells in the same row or column all equal the same 2
          // numbers, those two numbers must occupy those cells, and therefore aren't possible
          // in any other cells in the same row/column.

          rowsAndColumns.forEach(function(line) {
            for (var i = 0; i < boardSize - 1; i++) {
              var cellA = line[i];
              if (cellA.possible.count() == 2) {
                for (var j = i + 1; j < boardSize; j++) {
                  var cellB = line[j];
                  if (cellB.possible.equals(cellA.possible)) {
                    // two-pair found! remove these two values from all other cells
                    var otherCells = arraySubtract(line, [cellA, cellB]);
                    var v = cellA.possible.values();
                    otherCells.forEach(function(cell) { clearValues(cell, v, "two pair in row"); });
                    // is pair in same cage? cage bigger than 2? then make a subcage with leftover cells
                    if (cellA.cage == cellB.cage && cages[cellA.cage].cells.length > 2) {
                      var cage = cages[cellA.cage];
                      var subCage = {
                          op: cage.op,
                          total: cage.op == '+' ? cage.total - (v[0] + v[1]) : cage.total / (v[0] * v[1]),
                          cells: arraySubtract(cage.cells, [cellA, cellB])
                      };
                      addCage(subCage);
                    }
                  }
                }
              }
            }
          });
        },

        "must have divisor": function() {
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

        "in-line addition cage": function() {
          // If a + cage sits in a single row, then row total - cage total = total of other cells in row
          cages.forEach(function(cage) {
            if (cage.op == '+' && !cage.inLineChecked) {
              var inLine = cellsInLine(cage.cells);
              if (inLine) {
                var subCage = {
                  op: '+',
                  total: rowTotal - cage.total,
                  cells: arraySubtract(rowsAndColumns[inLine], cage.cells)
                };
                addCage(subCage);
              }
              cage.inLineChecked = true; // this only has to be done once per cage
            }
          });
        }

      };

      function initialize() {
        forEachCell(function(cell) {
          cell.possible = new Possibles(boardSize);
          delete cell.solution;
          delete cell.guess;
        });
      }

      // boards match if the possible values are the same in every cell
      function boardsMatch(a, b) {
        return false;
        for (var i = 0; i < a.length; i++) {
          for (var j = 0; j < a[0].length; j++) {
            if (!a[i][j].possible.equals(b[i][j].possible)) return false;
          }
        }
        return true;
      }

      initialize(puzzle);

      var numPasses = 0;
      var maxPasses = 6;

      var ruleNames = ["singletons", "addition", "division", "exclusion", "multiplication", "pigeonhole",
        "subtraction", "three", "two pair", "must have divisor", "in-line addition cage"];

      while (true) {
        var previousBoard = angular.copy(puzzle.board);

        ruleNames.forEach(function(name) {
          console.log("Applying rule", name);
          rules[name](puzzle);
        });

        ++numPasses;
        console.log("Finished pass", numPasses, "through rules");

        // repeat until no change, or max passes
        if (numPasses >= maxPasses || boardsMatch(puzzle.board, previousBoard)) break;
      }
    };

  });