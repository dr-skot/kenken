angular.module('kenkenApp')
  .service('KenkenSolver', function() {

    // a dataset that helps keep track of what values are possible in a given cell
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

      this.clear = function(i) {
        if (i > 0 && i <= n && a[i]) {
          a[i] = false;
          count -= 1;
        }
      };

      this.clearValues = function(values) {
        var self = this;
        values.forEach(function(i) { self.clear(i); });
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

      this.setAll();
      return this;
    }

    // copies cells, guaranteeing that the possible attribute is deep-copied too
    function copyCells(cells) {
      var copy = angular.copy(cells);
      copy.forEach(function(cell) { cell.possible = cell.possible.copy(); });
      return copy;
    }

    function getRow(puzzle, i) {
      return puzzle.board[i];
    }

    function getColumn(puzzle, j) {
      var column = [];
      for (var i = 0; i < puzzle.board.length; i++) {
        column.push(puzzle.board[i][j]);
      }
      return column;
    }

    function getColumns(board) {
      var columns = [];
      for (var j = 0; j < board[0].length; j++) {
        var cells = [];
        for (var i = 0; i < board.length; i++) {
          cells.push(board[i][j]);
        }
        columns.push(cells);
      }
      return columns;
    }

    function prependToEach(elem, arrays) {
      var result = [];
      arrays.forEach(function(array) {
        result.push([elem].concat(array));
      });
      return result;
    }

    function cellsInCage(puzzle, cage) {
      var cells = [];
      cage.cells.forEach(function(c) { cells.push(puzzle.board[c[0]][c[1]]); });
      return cells;
    }

    function doOperation(op, a, b) {
      return (
        op == '/' ? Math.max(a/b, b/a) :
          op == '-' ? Math.abs(a - b) :
            op == '+' ? a + b :
              op == 'x' ? a * b :
                null);
    }

    function possibleSolutions(total, op, cells) {
      // if (cells.length < 2) ERR!
      // if (op != '/' or 'x' or '+' or '-') ERR!
      var result = [];
      var a = cells[0];
      if (cells.count == 2) {
        var b = cells[1];
        var inLine = a.i == b.i || a.j == b.j;
        a.possible.forEach(function(aa) {
          b.possible.forEach(function(bb) {
            var collision = inLine && aa == bb;
            if (!collision && doOperation(op, aa, bb) == total) result.push([aa, bb]);
          });
        });
      } else {
        // if (op == '/' || op == '-') ERR
        a.possible.forEach(function(aa) {
          var subtotal = op == '+' ? total - aa : total / aa;
          if (subtotal == Math.floor(subtotal)) { // skip if division left a remainder
            var restOfCells = copyCells(cells.slice(1));
            restOfCells.forEach(function(cell) {
              if (cells[0].i == cell.i || cells[0].j == cell.j) cell.possible.clear(a);
            });
            var subsolutions = possibleSolutions(subtotal, op, restOfCells);
            result = result.concat(prependToEach(aa, subsolutions));
          }
        });
      }
      return result;
    }

    function possibleNumberings(cells) {
      var result = [];
      if (cells.length == 1) return cells[0].possible.values();
      else cells[0].possible.forEach(function(aa) {
        var restOfCells = copyCells(cells.slice(1));
        restOfCells.forEach(function(cell) { cell.possible.clear(aa); });
        var subnumberings = possibleNumberings(restOfCells);
        result = result.concat(prependToEach(aa, subnumberings));
      });
      return result;
    }

    function applyMustHaves(cells, solutions, mustHaveInLine, linesAreRows) {
      for (var line = 0; line < mustHaveInLine.length; line++) {
        for (var n in mustHaveInLine[line]) {
          var validSolutions = [];
          solutions.forEach(function(solution) {
            var valid = false;
            cells.forEach(function(cell, k) {
              if ((linesAreRows ? cell.i : cell.j) == line && solution[k] == n) valid = true;
            });
            if (valid) validSolutions.push(solution);
          });
          solutions = validSolutions;
        }
      }
      return solutions;
    }

    function forEachCell(puzzle, callback) {
      puzzle.board.forEach(function(row) { row.forEach(callback); });
    }

    function getCell(puzzle, coords) {
        return puzzle.board[coords[0]][coords[1]];
    }

    function getValues(object) {
        var values = [];
        for (var key in object) {
            values.push(object[key]);
        }
        return values;
    }

    function deleteImpossibles(cells, solutions) {
      cells.forEach(function(cell, i) {
        cell.possible.clearAll();
        solutions.forEach(function(values) {
          cell.possible.set(values[i]);
        });
      });
    }

    function enforceNumbering(groups, label) {
      groups.forEach(function(group, index) {
        var numberings = possibleNumberings(group);
        deleteImpossibles(group, numberings);
      });
    }

    var rules = {

      "singletons": function(puzzle) {
        // if cage has only one cell, that cell must contain the cage total
        puzzle.cages.forEach(function(cage) {
          if (cage.cells.length == 1) {
            var cell = getCell(puzzle, cage.cells[0]);
            cell.possible.clearAll();
            cell.possible.set(cage.total);
          }
        });
      },

      "no-dups": function(puzzle) {
        for (var i = 0; i < puzzle.board.length; i++) {
          var row = getRow(puzzle, i);
          row.forEach(function(cell) {
            if (cell.possible.count() == 1) {
              var n = cell.possible.values()[0];
              row.forEach(function(c) {
                if (c != cell) c.possible.clear(n);
              });
            }
          });
          var column = getColumn(puzzle, i);
          column.forEach(function(cell) {
            if (cell.possible.count() == 1) {
              var n = cell.possible.values()[0];
              column.forEach(function(c) {
                if (c != cell) c.possible.clear(n);
              });
            }
          });
        }
      },

      "pair": function(puzzle) {
        // If the possibilities of two cells in the same row or column all equal the same 2
        // numbers, those two numbers must occupy those cells, and therefore aren't possible
        // in any other cells in the same row/column.

        var board = puzzle.board;
        var puzzleSize = board.length;
        var cellA, cellB;

        for (var i = 0; i < puzzleSize; i++) {
          for (var j = 0; j < puzzleSize - 1; j++) {

            // row
            cellA = board[i][j];
            if (cellA.possible.count() == 2) {
              for (var k = j + 1; k < puzzleSize; k++) {
                cellB = board[i][k];
                if (cellA.possible.equals(cellB.possible)) {
                  var values = cellA.possible.values();
                  for (var m = 0; m < puzzleSize; m++) {
                    if (m != j && m != k) board[i][m].possible.clearValues(values);
                  }
                }
              }
            }

            // column
            cellA = board[j][i];
            if (cellA.possible.count() == 2) {
              for (k = j + 1; k < puzzleSize; k++) {
                cellB = board[k][i];
                if (cellA.possible.equals(cellB.possible)) {
                  values = cellA.possible.values();
                  for (m = 0; m < puzzleSize; m++) {
                    if (m != j && m != k) board[m][i].possible.clearValues(values);
                  }
                }
              }
            }
          }
        }
      },

      "divisor": function(puzzle) {
        // multiply cage can only contain divisors of the total
        puzzle.cages.forEach(function(cage) {
          if (cage.op == 'x') {
            cellsInCage(puzzle, cage).forEach(function(cell) {
              cell.possible.forEach(function(n) {
                var quotient = cage.total / n;
                if (quotient != Math.round(quotient)) cell.possible.clear(n);
                else if (cage.cells.length == 2 && (quotient == n || quotient > puzzle.board.length)) {
                  cell.possible.clear(n);
                }
              });
            });
          }
        });
      },

      "must have divisor": function(puzzle) {
        var n = puzzle.board.length;
        var mustHaveDivisors = n < 6 ? [3, 5] : n > 6 ? [5, 7] : [5];
        puzzle.cages.forEach(function(cage) {
          if (cage.op == 'x') {
            mustHaveDivisors.forEach(function(d) {
              if (cage.total % d == 0) {
                // found a must-have divisor! now, does the cage live in one line?
                var row = cage.cells[0][0];
                var column = cage.cells[0][1];
                cage.cells.forEach(function(ij) {
                  row = ij[0] == row ? row : false;
                  column = ij[1] == column ? column : false;
                });
                // if so, divisor is impossible elsewhere in that line
                if (row) getRow(puzzle, row).forEach(function(cell) {
                  if (cell.cage != cage.id) cell.possible.clear(d);
                });
                if (column) getColumn(puzzle, column).forEach(function(cell) {
                  if (cell.cage != cage.id) cell.possible.clear(d);
                });
              }
            });
          }
        });
      },

      "two cell multiply": function(puzzle) {
        puzzle.cages.forEach(function(cage) {
          if (cage.op == 'x' && cage.cells.length == 2) {
            var cells = cellsInCage(puzzle, cage);
            cells[0].possible.forEach(function(n) {
              if (!cells[1].possible.includes(cage.total/n)) cells[0].possible.clear(n);
            });
            cells[1].possible.forEach(function(n) {
              if (!cells[0].possible.includes(cage.total/n)) cells[1].possible.clear(n);
            });
          }
        });
      },

      "two cell add": function(puzzle) {
        puzzle.cages.forEach(function(cage) {
          if (cage.op == '+' && cage.cells.length == 2) {
            var cells = cellsInCage(puzzle, cage);
            cells[0].possible.forEach(function(n) {
              if (!cells[1].possible.includes(cage.total - n)) cells[0].possible.clear(n);
            });
            cells[1].possible.forEach(function(n) {
              if (!cells[0].possible.includes(cage.total - n)) cells[1].possible.clear(n);
            });
          }
        });
      },

      "divide": function(puzzle) {
        puzzle.cages.forEach(function(cage) {
          if (cage.op == '/') {
            var cells = cellsInCage(puzzle, cage);
            cells[0].possible.forEach(function(n) {
              if (!(cells[1].possible.includes(cage.total * n) || cells[1].possible.includes(n / cage.total))) {
                cells[0].possible.clear(n);
              }
            });
            cells[1].possible.forEach(function(n) {
              if (!(cells[0].possible.includes(cage.total * n) || cells[0].possible.includes(n / cage.total))) {
                cells[1].possible.clear(n);
              }
            });
          }
        });
      },

      "subtract": function(puzzle) {
        puzzle.cages.forEach(function(cage) {
          if (cage.op == '-') {
            var cells = cellsInCage(puzzle, cage);
            cells[0].possible.forEach(function(n) {
              if (!(cells[1].possible.includes(cage.total + n) || cells[1].possible.includes(n - cage.total))) {
                cells[0].possible.clear(n);
              }
            });
            cells[1].possible.forEach(function(n) {
              if (!(cells[0].possible.includes(cage.total + n) || cells[0].possible.includes(n - cage.total))) {
                cells[1].possible.clear(n);
              }
            });
          }
        });
      },


      // each row contains exactly one instance of each value
      "rows": function(puzzle) {
        enforceNumbering(puzzle.board, "row");
      },

      // each column contains exactly one instance of each value
      "columns": function(puzzle) {
        enforceNumbering(getColumns(puzzle.board), "column");
      },

      // eliminate values that aren't part of valid solutions to the cage math
      "cage math": function(puzzle) {
        puzzle.cages.forEach(function(cage) {
          if (cage.cells.length > 1) {
            var cells = cellsInCage(puzzle, cage);
            var solutions = possibleSolutions(cage.total, cage.op, cells);
            solutions = applyMustHaves(cells, solutions, cage.mustHaveInRow, true);
            solutions = applyMustHaves(cells, solutions, cage.mustHaveInColumn, false);
            deleteImpossibles(cells, solutions);
          }
        });
      },

      "must have in cage": function(puzzle) {
          var checkLines = function(lines, linesAreRows) {
            lines.forEach(function(line, lineIndex) {
              for (var n = 1; n <= puzzle.board.length; n++) {
                // does it appear in only one cage of this line?
                var cage = null;
                var oneCage = false;
                line.forEach(function(cell) {
                  if (cell.possible[n]) {
                    if (!cage) {
                      cage = puzzle.cages[cell.cage];
                      oneCage = true;
                    } else {
                      if (cell.cage != cage.id) oneCage = false;
                    }
                  }
                });
                if (oneCage) {
                  // tell cage it must use this number in this row/column
                  var mustHaveInLine = linesAreRows ? cage.mustHaveInRow : cage.mustHaveInColumn;
                  mustHaveInLine[lineIndex][n] = n;
                }
              }
            });
          };

          checkLines(puzzle.board, true);
          checkLines(getColumns(puzzle.board), false);

        }
        /*
        "addition": function(puzzle) {
            // Check legal addition possibilities
            var hasChanged = false;
            angular.forEach(puzzle.cages, function(cage) {
                if (cage.op == "+") {
                    var remainder = cage.total;
                    var openCells = [];
                    
                    angular.forEach(cage.cells, function(coords) {
                        // Calculate remainder of each cell
                        var cell = getCell(puzzle, coords);
                        if (cell.solution) {
                            remainder -= cell.solution;
                        } else {
                            openCells.push(cell);
                        }
                    })
                    
                    angular.forEach(openCells, function(cell) {
                        var toRemove = [];
                        angular.forEach(cell.possible, function(possible) {
                            if (possible+openCells.length-1 > remainder+openCells.length-1) {
                                toRemove.push(possible);
                                hasChanged = true;
                            }
                        });
                        removePossible(cell, toRemove, "can't meet remainder");
                    })

                    if (openCells.length == 1) {
                        var cell = openCells[0];
                        cell.possible = {};
                        cell.possible[remainder] = remainder;
                        hasChanged = true;
                        // console.log("Cell "+cell.i+","+cell.j+" assumed remainder "+remainder);
                    } else if (openCells.length == 2) {
                        var binaryRemoval = function(cell, otherCell) {
                            var toRemove = [];
                            angular.forEach(cell.possible, function(possible) {
                                if (!otherCell.possible[remainder - possible] || 
                                        (cage.cells.length == 2 && possible+possible == remainder)) {
                                    toRemove.push(possible);
                                    hasChanged = true;
                                }
                            });
                            removePossible(cell, toRemove, "otherCell can't accommodate");
                        }
                        binaryRemoval(openCells[0], openCells[1]);
                        binaryRemoval(openCells[1], openCells[0]);
                    }

                }
            });
            return hasChanged;   
        },
        
        "division": function(puzzle) {
            // Check legal division possibilities
            var hasChanged = false;
            angular.forEach(puzzle.cages, function(cage) {
                if (cage.op == "/") {
                    var total = cage.total;
                    var cells = [getCell(puzzle, cage.cells[0]), getCell(puzzle, cage.cells[1])];
                    
                    var checkDivision = function(cell, otherCell) {
                        if (cell.solution) return;
                        var toRemove = [];
                        if (otherCell.solution) {
                            angular.forEach(cell.possible, function(p) {
                                if (p*total != otherCell.solution && otherCell.solution*total != p) {
                                    toRemove.push(p);
                                    var hasChanged = false;
                                }
                            });
                        } else {
                            angular.forEach(cell.possible, function(p) {
                                if (!otherCell.possible[p*total] && !otherCell.possible[p/total]) {
                                    toRemove.push(p);
                                    var hasChanged = false;
                                }
                            });
                        }
                        removePossible(cell, toRemove, "otherCell can't accommodate");
                    }
                    checkDivision(cells[0], cells[1]);
                    checkDivision(cells[1], cells[0]);
                }
            });
            return hasChanged;            
        },
        
        "exclusion": function(puzzle) {
            // Exclude known values from reappearing in same column or row
            var hasChanged = false;
            
            var rowToSolved = {};
            var colToSolved = {};
            forEachCell(puzzle, function(cell) {
                if (cell.solution) {
                    if (!rowToSolved[cell.i]) rowToSolved[cell.i] = {};
                    if (!colToSolved[cell.j]) colToSolved[cell.j] = {};
                    rowToSolved[cell.i][cell.solution] = cell.solution;
                    colToSolved[cell.j][cell.solution] = cell.solution;
                }
            });
            
            forEachCell(puzzle, function(cell) {
                if (!cell.solution) {
                    for (val in rowToSolved[cell.i]) if (deleteIfPresent(cell.possible, val)) {
                        hasChanged = true;
                        // console.log("Excluding "+val+" from cell "+cell.i+","+cell.j);
                    }; 
                    for (val in colToSolved[cell.j]) if (deleteIfPresent(cell.possible, val)) {
                        hasChanged = true;
                        // console.log("Excluding "+val+" from cell "+cell.i+","+cell.j);
                    }
                }
            });
            
            return hasChanged;
        },
        
        "multiplication": function(puzzle) {
            // Check legal multiplication possibilities
            var hasChanged = false;
            angular.forEach(puzzle.cages, function(cage) {
                if (cage.op == "x") {
                    var total = cage.total;
                    var remainder = total;
                    var openCells = [];
                    
                    angular.forEach(cage.cells, function(coords) {
                        var cell = getCell(puzzle, coords);
                        if (cell.solution) {
                            remainder /= cell.solution;
                        } else {
                            openCells.push(cell);
                        }
                    })
                    
                    angular.forEach(openCells, function(cell) {
                        var toRemove = [];
                        angular.forEach(cell.possible, function(possible) {
                            if (remainder % possible > 0) {
                                toRemove.push(possible);
                                hasChanged = true;
                            }
                        });
                        removePossible(cell, toRemove, "can't meet remainder");
                    })

                    if (openCells.length == 1) {
                        var cell = openCells[0];
                        cell.possible = {};
                        cell.possible[remainder] = remainder;
                        hasChanged = true;
                        // console.log("Cell "+cell.i+","+cell.j+" assumed remainder "+remainder);
                    } else if (openCells.length == 2) {
                        var binaryRemoval = function(cell, otherCell) {
                            var toRemove = [];
                            angular.forEach(cell.possible, function(possible) {
                                if (!otherCell.possible[remainder / possible] || 
                                        (cage.cells.length == 2 && possible*possible == remainder)) {
                                    toRemove.push(possible);
                                    hasChanged = true;
                                }
                            });
                            removePossible(cell, toRemove, "otherCell can't accommodate");
                        }
                        binaryRemoval(openCells[0], openCells[1]);
                        binaryRemoval(openCells[1], openCells[0]);
                    }

                }
            });
            return hasChanged;            
        },
        
        "pidgeonhole": function(puzzle) {
            // If possibility occurs only once in a row or column, it must appear there
            var hasChanged = false;
            
            var puzzleSize = puzzle.board.length;

            var countPossible = function(counter, cell) {
                if (cell.solution) {
                    if (!counter[cell.solution]) counter[cell.solution] = 0;
                    ++counter[cell.solution];
                } else {
                    angular.forEach(cell.possible, function(p) {
                        if (!counter[p]) counter[p] = 0;
                        ++counter[p];
                    });
                }
            }
            var filterSingletons = function(counter) {
                var singletons = {};
                for (var p in counter) if (counter[p] == 1) singletons[p] = p;
                return singletons;
            }
            var processSingletons = function(cell, singletons) {
                if (cell.solution) return;
                
                var possibilities = getValues(cell.possible);
                if (possibilities.length == 1) return;
                
                for (var p_ind in possibilities) {
                    var p = possibilities[p_ind];
                    if (singletons[p]) {
                        cell.possible = {};
                        cell.possible[p] = p;
                        // console.log("Cell "+cell.i+","+cell.j+" gets pidgeonhole "+p);
                        return true;
                    }
                };
                return false;
            }
            
            for (var i=0; i<puzzleSize; ++i) {
                var rowNumToCount = {};
                var colNumToCount = {};
                for (var j=0; j<puzzleSize; ++j) {
                    countPossible(rowNumToCount, getCell(puzzle, [i,j]));
                    countPossible(colNumToCount, getCell(puzzle, [j,i]));
                }
                var rowSingletons = filterSingletons(rowNumToCount);
                var colSingletons = filterSingletons(colNumToCount);

                for (var j=0; j<puzzleSize; ++j) {
                    hasChanged = processSingletons(getCell(puzzle, [i,j]), rowSingletons) || hasChanged;
                    hasChanged = processSingletons(getCell(puzzle, [j,i]), colSingletons) || hasChanged;
                }
            }
            
            return hasChanged;
        },

        "solved": function(puzzle) {
            // If cell has only one remaining posibility, mark that as solution
            var hasChanged = false;
            forEachCell(puzzle, function(cell) {
                var possible = getValues(cell.possible)
                if (possible.length == 1 && !cell.solution) {
                    cell.solution = possible[0];
                    cell.guess = String(cell.solution);
                    
                    hasChanged = true;
                    // console.log("Solved cell "+cell.i+","+cell.j+": "+cell.solution);
                }
            });
            return hasChanged;
        },
        
        "subtraction": function(puzzle) {
            // Check legal subtraction possibilities
            var hasChanged = false;
            angular.forEach(puzzle.cages, function(cage) {
                if (cage.op == "-") {
                    var total = cage.total;
                    var cells = [getCell(puzzle, cage.cells[0]), getCell(puzzle, cage.cells[1])];
                    
                    var checkSubtraction = function(cell, otherCell) {
                        if (cell.solution) return;
                        var toRemove = [];
                        if (otherCell.solution) {
                            angular.forEach(cell.possible, function(p) {
                                if (p+total != otherCell.solution && otherCell.solution+total != p) {
                                    toRemove.push(p);
                                }
                            });
                        } else {
                            angular.forEach(cell.possible, function(p) {
                                if (!otherCell.possible[p+total] && !otherCell.possible[p-total]) {
                                    toRemove.push(p);
                                }
                            });
                        }
                        removePossible(cell, toRemove, "otherCell can't accommodate");
                    }
                    checkSubtraction(cells[0], cells[1]);
                    checkSubtraction(cells[1], cells[0]);
                }
            });
            return hasChanged;            
        },
        
        "three": function(puzzle) {
            // If the possibilities of three cells in the same row or column all equal the same 3
            // numbers, those three numbers must occupy those cells, and therefore aren't possible
            // in any other cells in the same row/column.
            var puzzleSize = puzzle.board.length;
            if (puzzleSize <= 3) return false;

            var hasChanged = false;
            
            var getEliminated = function(coordsA, coordsB, coordsC) {
                var possibleA = getValues(getCell(puzzle, coordsA).possible);
                if (possibleA.length != 2 && possibleA.length != 3) return;
                
                var possibleB = getValues(getCell(puzzle, coordsB).possible);
                if (possibleB.length != 2 && possibleB.length != 3) return;
                
                var possibleC = getValues(getCell(puzzle, coordsC).possible);
                if (possibleC.length != 2 && possibleC.length != 3) return;
                
                var allPossible = getUniques(possibleA.concat(possibleB).concat(possibleC));
                if (allPossible.length != 3) return;
                
                return allPossible;
            }
            
            for (var rowOrCol=0; rowOrCol<puzzleSize; ++rowOrCol) {
                for (var fst=0; fst<puzzleSize-2; ++fst) {
                    for (var snd=fst+1; snd<puzzleSize-1; ++snd) {
                        for (var trd=snd+1; trd<puzzleSize; ++trd) {
                            var eliminatedRow = getEliminated([rowOrCol, fst], [rowOrCol, snd], [rowOrCol, trd]);
                            if (eliminatedRow) {
                                for (var elimCol=0; elimCol<puzzleSize; ++elimCol) {
                                    if (elimCol == fst || elimCol == snd || elimCol == trd) continue;
                                
                                    var cell = getCell(puzzle, [rowOrCol, elimCol]);
                                    var toRemove = [];
                                    angular.forEach(eliminatedRow, function(impossible) {
                                        if (cell.possible[impossible]) {
                                            toRemove.push(impossible);
                                            hasChanged = true;
                                        }
                                    })
                                    removePossible(cell, toRemove, "three of a kind in row");
                                }
                            }
                        
                            var eliminatedCol = getEliminated([fst, rowOrCol], [snd, rowOrCol], [trd, rowOrCol]);
                            if (eliminatedCol) {
                                for (var elimRow=0; elimRow<puzzleSize; ++elimRow) {
                                    if (elimRow == fst || elimRow == snd || elimRow == trd) continue;
                                
                                    var cell = getCell(puzzle, [elimRow, rowOrCol]);
                                    var toRemove = [];
                                    angular.forEach(eliminatedCol, function(impossible) {
                                        if (cell.possible[impossible]) {
                                            toRemove.push(impossible);
                                            hasChanged = true;
                                        }
                                    })
                                    removePossible(cell, toRemove, "three of a kind in col");
                                }
                            }
                        }

                    }
                }
            }
            
            return hasChanged;
        },
        
        */
    };

    this.initialize = function(puzzle) {
      var numRows = puzzle.board.length;
      var numCols = puzzle.board[0].length;

      forEachCell(puzzle, function(cell) {
        cell.id = cell.i * numCols + cell.j;
        cell.possible = new Possibles(numRows);

        delete cell.solution;
      });

      puzzle.cages.forEach(function(cage) {
        cage.mustHaveInRow = [];
        cage.mustHaveInColumn = [];
        for (i = 0; i < numRows; i++) {
          cage.mustHaveInRow[i] = {};
          cage.mustHaveInColumn[i] = {};
        }
      });
    };


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

    this.solve = function(puzzle) {
        this.initialize(puzzle);
        
        var numPasses = 0;
        var maxPasses = 2;

        var ruleNames = ["singletons", "no-dups", "divisor", "two cell multiply", "must have divisor", "two cell add", "no-dups", "subtract", "divide", "no-dups", "pair", "no-dups"];

        while (true) {
          var previousBoard = angular.copy(puzzle.board);

            ruleNames.forEach(function(name) {
                console.log("Applying rule", name);
                rules[name](puzzle);
            });
            
            ++numPasses;
            console.log("Finished pass", numPasses, "through rules");

            // repeat until no change, or max passes
            if (numPasses > maxPasses || boardsMatch(puzzle.board, previousBoard)) break;
        }

        forEachCell(puzzle, function(cell) {
          if (cell.possible.count() == 1) cell.guess = cell.possible.values()[0];
        });

    };

});