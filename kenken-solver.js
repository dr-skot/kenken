angular.module('kenkenApp')
  .service('KenkenSolver', function() {

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
      var aa = getValues(cells[0].possible);
      if (cells.length == 2) {
        var bb = getValues(cells[1].possible);
        var inLine = aa.i == bb.i || aa.j == bb.j;
        aa.forEach(function(a) {
          bb.forEach(function(b) {
            var collision = inLine && a == b;
            //if (collision) console.log("collision!", a, b);
            if (!collision && doOperation(op, a, b) == total) result.push([a, b]);
            //if (!collision) console.log(op, a, b, total, total == doOperation(op, a, b));
          });
        });
      } else {
        // if (op == '/' || op == '-') ERR
        aa.forEach(function(a) {
          var subtotal = op == '+' ? total - a : total / a;
          if (subtotal == Math.floor(subtotal)) { // skip if division left a remainder
            var restOfCells = angular.copy(cells.slice(1));
            restOfCells.forEach(function(cell) {
              if (cells[0].i == cell.i || cells[0].j == cell.j) delete cell.possible[a];
            });
            //console.log("recurse!", a, op, subtotal, restOfCells);
            var subsolutions = possibleSolutions(subtotal, op, restOfCells);
            //console.log("subsolutions", subsolutions);
            //console.log("prepend", a, prependToEach(a, subsolutions));
            result = result.concat(prependToEach(a, subsolutions));
            //console.log("after recursion", result);
          }
        });
      }
      //console.log("returning result", result);
      return result;
    }

    function possibleNumberings(cells) {
      var result = [];
      var aa = getValues(cells[0].possible);
      if (cells.length == 1) return aa;
      else aa.forEach(function(a) {
        var restOfCells = angular.copy(cells.slice(1));
        restOfCells.forEach(function(cell) { delete cell.possible[a]; });
        var subnumberings = possibleNumberings(restOfCells);
        result = result.concat(prependToEach(a, subnumberings));
      });
      return result;
    }

    function deleteIfPresent(object, val) {
        if (undefined == object[val]) return false;
        delete object[val];
        return true;
    }
    function forEachCell(puzzle, callback) {
        angular.forEach(puzzle.board, function(row) {
            angular.forEach(row, callback);
        })
    }
    function getCell(puzzle, coords) {
        return puzzle.board[coords[0]][coords[1]];
    }
    function getUniques(array) {
        var uniques = {};
        for (var i=0; i<array.length; ++i) {
            uniques[array[i]] = array[i];
        }
        return getValues(uniques);
    }
    function getValues(object) {
        var values = [];
        for (var key in object) {
            values.push(object[key]);
        }
        return values;
    }
    function removePossible(cell, toRemove, message) {
        angular.forEach(toRemove, function(impossible) {
            delete cell.possible[impossible];
            // console.log("Eliminating "+impossible+" from "+cell.i+","+cell.j+" since "+message);
        })
    }
    
    this.initialize = function(puzzle) {
        var numRows = puzzle.board.length;
        var numCols = puzzle.board[0].length;
        
        var possible = {};
        for (var i=1; i<=numRows; ++i) {
            possible[i] = i;
        }
        // console.log("Initializing possibilities: "+getValues(possible));
        
        forEachCell(puzzle, function(cell) {
            cell.id = cell.i*numCols + cell.j;
            cell.possible = angular.copy(possible)  
            
            delete cell.solution
        });
    }
    
    var rules = {

      "singletons": function(puzzle) {
        /* If cage has only one cell, the cage total is the only possibility */
        var hasChanged = false;
        angular.forEach(puzzle.cages, function(cage) {
          if (cage.cells.length == 1 && !getCell(puzzle, cage.cells[0]).solution) {
            var total = cage.total;
            var cell = getCell(puzzle, cage.cells[0])
            cell.possible = {};
            cell.possible[total] = total;

            hasChanged = true;
            // console.log("Cell "+cell.i+","+cell.j+" is singleton "+total);
          }
        });
        return hasChanged;
      },

        "cage math": function(puzzle) {
          /* Eliminate values that aren't part of valid solutions to the cage math */
          var hasChanged = false;
          puzzle.cages.forEach(function(cage) {
            if (cage.cells.length > 1) {
              var solutions = possibleSolutions(cage.total, cage.op, cellsInCage(puzzle, cage));
              console.log("cage %d%s: %o", cage.total, cage.op, solutions);
              cellsInCage(puzzle, cage).forEach(function(cell, index) {
                var possible = {};
                solutions.forEach(function(solution) {
                  possible[solution[index]] = solution[index];
                });
                hasChanged = hasChanged || getValues(possible).length != getValues(cell.possible).length;
                cell.possible = possible;
              });
            }
          });
          return hasChanged;
        },
        "rows": function(puzzle) {
          var hasChanged = false;
          puzzle.board.forEach(function(row, index) {
            var numberings = possibleNumberings(row);
            console.log("row", index, "numberings", numberings);
            row.forEach(function(cell, index) {
              var possible = {};
              numberings.forEach(function(numbering) {
                possible[numbering[index]] = numbering[index];
              });
              hasChanged = hasChanged || getValues(possible).length != getValues(cell.possible).length;
              cell.possible = possible;
            });
          });
          return hasChanged;
        },
        "columns": function(puzzle) {
          var hasChanged = false;
          for (var j = 0; j < puzzle.board[0].length; j++) {
            var col = [];
            for (var i = 0; i < puzzle.board.length; i++) {
              col.push(puzzle.board[i][j]);
            }
            var numberings = possibleNumberings(col);
            console.log("col", j, "numberings", numberings);
            col.forEach(function(cell, index) {
              var possible = {};
              numberings.forEach(function(numbering) {
                possible[numbering[index]] = numbering[index];
              });
              hasChanged = hasChanged || getValues(possible).length != getValues(cell.possible).length;
              cell.possible = possible;
            });
          }
          return hasChanged;
        },
        "must have in cage": function(puzzle) {
          var hasChanged = false;
          // for each row/column
          // for each number
          // what cells is it possible in, in this row/column?
          // are all those cells in one cage?
          // if so, does cage know it must contain that number in this row/column?
          // if not, tell it, and hasChanged = true
          return hasChanged;
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
        
        "twopair": function(puzzle) {
            // If the possibilities of two cells in the same row or column all equal the same 2
            // numbers, those two numbers must occupy those cells, and therefore aren't possible
            // in any other cells in the same row/column.
            var hasChanged = false;
            
            var puzzleSize = puzzle.board.length;
            
            var getEliminated = function(coordsA, coordsB) {
                var possibleA = getValues(getCell(puzzle, coordsA).possible);
                if (possibleA.length != 2) return;
                
                var possibleB = getValues(getCell(puzzle, coordsB).possible);
                if (possibleB.length != 2) return;
                
                // NOTE: this assumes universal ordering over hashes; is this true in js?
                if (possibleA[0] != possibleB[0] || possibleA[1] != possibleB[1]) return;
                
                return possibleA;
            }
            
            for (var rowOrCol=0; rowOrCol<puzzleSize; ++rowOrCol) {
                for (var fst=0; fst<puzzleSize-1; ++fst) {
                    for (var snd=fst+1; snd<puzzleSize; ++snd) {
                        var eliminatedRow = getEliminated([rowOrCol, fst], [rowOrCol, snd]);
                        if (eliminatedRow) {
                            for (var elimCol=0; elimCol<puzzleSize; ++elimCol) {
                                if (elimCol == fst || elimCol == snd) continue;
                                
                                var cell = getCell(puzzle, [rowOrCol, elimCol]);
                                var toRemove = [];
                                angular.forEach(eliminatedRow, function(impossible) {
                                    if (cell.possible[impossible]) {
                                        toRemove.push(impossible);
                                        hasChanged = true;
                                    }
                                })
                                removePossible(cell, toRemove, "two pair in row");
                            }
                        }
                        
                        var eliminatedCol = getEliminated([fst, rowOrCol], [snd, rowOrCol]);
                        if (eliminatedCol) {
                            for (var elimRow=0; elimRow<puzzleSize; ++elimRow) {
                                if (elimRow == fst || elimRow == snd) continue;
                                
                                var cell = getCell(puzzle, [elimRow, rowOrCol]);
                                var toRemove = [];
                                angular.forEach(eliminatedCol, function(impossible) {
                                    if (cell.possible[impossible]) {
                                        toRemove.push(impossible);
                                        hasChanged = true;
                                    }
                                })
                                removePossible(cell, toRemove, "two pair in col");
                            }
                        }
                    }
                }
            }
            
            return hasChanged;
        }
        */
    };
    this.solve = function(puzzle) {
        this.initialize(puzzle);
        
        var numPasses = 0;
        var maxPasses = 20;
        var hasChanged = true;
        while (hasChanged) {
            hasChanged = false;
            
            for (var name in rules) {
                console.log("Applying rule "+name);
                hasChanged = rules[name](puzzle) || hasChanged;
            };
            
            ++numPasses;
            console.log("Finished pass "+numPasses+" through rules");
            if (numPasses > maxPasses) return;
        }
        
        // alert("solved");
    }

});