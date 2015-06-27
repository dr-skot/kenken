angular.module('kenkenApp', [])
  .service('KenkenService', function() {

    // returns a random integer in the range [a, b] (inclusive)
    function rnd(a, b) {
      x = Math.floor(Math.random() * (b - a + 1));
      return a + x;
    }

    // returns a random element of an array
    function rndElem(a) {
      i = rnd(0, a.length - 1);
      return a[i];
    }

    // returns a random character of an string
    function rndChar(s) {
      i = rnd(0, s.length - 1);
      return s.charAt(i);
    }

    // returns a random latin square
    function latinSquare(size) {
      var b, i, j, m, n;
      b = [];
      // legally populate board by shifting each row by one
      for (i = 0; i < size; i++) {
        b[i] = [];
        for (j = 0; j < size; j++) {
          b[i][j] = {ans: ((i + j) % size) + 1}
        }
      }
      // shuffle rows
      for (m = size - 1; m > 0; m--) {
        n = rnd(0, m); // 0 <= n <= m
        swapRows(b, m, n);
      }
      // shuffle cols
      for (m = size -1; m > 0; m--) {
        n = rnd(0, m); // 0 <= n <= m
        swapCols(b, m, n);
      }
      return b;
    }

    // swaps two rows in a latin square
    function swapRows(a, m, n) {
      var swap = a[m];
      a[m] = a[n];
      a[n] = swap;
    }

    // swaps two columns in a latin square
    function swapCols(a, m, n) {
      var j, swap;
      for (j = 0; j < a[m].length; j++) {
        swap = a[j][m];
        a[j][m] = a[j][n];
        a[j][n] = swap;
      }
    }

    // creates arithmetical cages on a given latin square, using a given set of operators
    function makeCages(a, ops) {
      var i, j, n = a.length;
      var id = 0;
      var cages = [];
      for (i = 0; i < n; i++) {
        for (j = 0; j < n; j++) {
          a[i][j].i = i; a[i][j].j = j;
          if (!a[i][j].hasOwnProperty('cage')) {
            cages.push(makeCage(id++, a, i, j, ops));
          }
        }
      }
      return cages;
    }

    function cell(a, ij) {
      return a[ij[0]][ij[1]];
    }

    // makes a cage that contains a[i][j], using a randomly chosen operator from ops
    // cage is of this form: { id: 0, op: '+', total: 14, cells: [[0,0], [0,1], [1,1]] }
    function makeCage(id, a, i, j, ops) {
      var n = a.length;
      var r = Math.random();
      var size = r < 0.05 ? 1 : r < 0.6 ? 2 : r < 0.9 ? 3 : 4;
      var cage = {id: id, cells: [[i, j]]};
      var neighbors, neighbor;
      var op, total;

      a[i][j].cage = id;
      a[i][j].isFirstInCage = true;

      // determine which cells are in the cage
      while (cage.cells.length < size) {
        // find all uncaged neighbors
        neighbors = [];
        [[i-1, j], [i, j-1], [i+1, j], [i, j+1]].forEach(function(neighbor) {
          var ii = neighbor[0], jj = neighbor[1];
          if (ii >= 0 && ii < n && jj >= 0 && jj < n && !a[ii][jj].hasOwnProperty('cage')) {
            neighbors.push(neighbor);
          }
        });

        // if no neighbors, this cage is done
        if (neighbors.length == 0) {
          size = cage.cells.length; // (ends while loop)
        }

        // otherwise choose a neighbor at random, add it to the cage, and continue
        else {
          neighbor = rndElem(neighbors);
          i = neighbor[0];
          j = neighbor[1];
          cage.cells.push([i, j]);
          a[i][j].cage = id;
        }
      }

      // now choose an operator and calculate the total

      // one cell: no operator
      if (size == 1) {
        total = cell(a, cage.cells[0]).ans;
        op = '';
      }

      // two cells: sub and div are possible, but div only if cells divide evenly
      else if (size == 2) {
        var x = cell(a, cage.cells[0]).ans, y = cell(a, cage.cells[1]).ans;
        if (~ops.indexOf('/')) {
          // check if div is possible
          var div = Math.max(x/y, y/x);
          // if not, remove '/' from ops; otherwise, add an _extra_ '/' to double div's chances
          ops = (div == Math.floor(div)) ? ops + '/' : ops.replace('/', '');
        }
        op = rndChar(ops);
        total = op == '/' ? div : op == '+' ? x + y : op == 'x' ? x * y : op == '-' ? Math.abs(x - y) : 'ERR!'
      }

      // more than two cells: div and sub not allowed
      else {
        ops = ops.replace('/','').replace('-', '');
        op = rndChar(ops);
        total = op == '+' ? 0 : 1;
        cage.cells.forEach(function(c) {
          var ans = cell(a, c).ans;
          total = op == '+' ? total + ans : op == 'x' ? total * ans : 'ERR!';
        });
      }
      cage.op = op;
      cage.total = total;
      return cage;
    }

    this.getBoard = function(n, ops) {
      var cells = latinSquare(n);
      var cages = makeCages(cells, ops);
      return { cells: cells, cages: cages };
    };

    this.isSolved = function(b) {
      var solved = true;
      b.forEach(function(row) {
        row.forEach(function(cell) {
          if (cell.guess != cell.ans) solved = false;
        });
      });
      return solved;
    };

    this.cellWalls = function(b, i, j) {
      var cage = b[i][j].cage;
      var walls = [];
      if (i == 0 || b[i-1][j].cage != cage) walls.push('top');
      if (j == 0 || b[i][j-1].cage != cage) walls.push('left');
      if (i+1 == b.length || b[i+1][j].cage != cage) walls.push('bottom');
      if (j+1 == b.length || b[i][j+1].cage != cage) walls.push('right');
      return walls;
    };

});