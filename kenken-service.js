angular.module('kenkenApp', [])
  .service('KenkenService', function() {

    // returns a random integer in the range [a, b] (inclusive)
    function rnd(a, b) {
      x = Math.floor(Math.random() * (b - a + 1));
      return a + x;
    }

    // returns a random element of an array
    function rnd_elem(a) {
      i = rnd(0, a.length - 1);
      return a[i];
    }

    // returns a random character of an string
    function rnd_char(s) {
      i = rnd(0, s.length - 1);
      return s.charAt(i);
    }

    // returns a random latin square
    function latin_square(size) {
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
        swap_rows(b, m, n);
      }
      // shuffle cols
      for (m = size -1; m > 0; m--) {
        n = rnd(0, m); // 0 <= n <= m
        swap_cols(b, m, n);
      }
      return b;
    }

    // swaps two rows in a latin square
    function swap_rows(a, m, n) {
      var swap = a[m];
      a[m] = a[n];
      a[n] = swap;
    }

    // swaps two columns in a latin square
    function swap_cols(a, m, n) {
      var j, swap;
      for (j = 0; j < a[m].length; j++) {
        swap = a[j][m];
        a[j][m] = a[j][n];
        a[j][n] = swap;
      }
    }

    // creates arithmetical cages on a given latin square, using a given set of operators
    function make_cages(a, ops) {
      var i, j, n = a.length;
      var id = 0;
      var cages = [];
      for (i = 0; i < n; i++) {
        for (j = 0; j < n; j++) {
          if (!a[i][j].cage) {
            cages.push(make_cage(++id, a, i, j, ops));
          }
        }
      }
      return cages;
    }

    // makes a cage that contains a[i][j], using a randomly chosen operator from ops
    function make_cage(id, a, i, j, ops) {
      var n = a.length;
      var r = Math.random();
      var size = r < 0.05 ? 1 : r < 0.6 ? 2 : r < 0.9 ? 3 : 4;
      var cage = {id: id, cells: [a[i][j]]};
      a[i][j].cage = cage;
      var ds, d;
      while (cage.cells.length < size) {
        ds = [];
        [[i-1,j],[i,j-1],[i+1,j],[i,j+1]].forEach(function(d) {
          if (d[0] >= 0 && d[0] < n && d[1] >= 0 && d[1] < n && !a[d[0]][d[1]].cage) {
            ds.push(d);
          }
        });
        if (ds.length == 0) {
          size = cage.cells.length; // break out of loop
        } else {
          d = rnd_elem(ds);
          i = d[0];
          j = d[1];
          cage.cells.push(a[i][j]);
          a[i][j].cage = cage;
        }
      }
      var op, total;

      // one cell: no operator
      if (size == 1) {
        total = cage.cells[0].ans;
        op = '';
      }

      // two cells: sub and div are possible, div only if cells divide evenly
      else if (size == 2) {
        var a = cage.cells[0].ans, b = cage.cells[1].ans;
        if (~ops.indexOf('/')) {
          // check if div is possible
          var div = Math.max(a/b, b/a);
          ops = (div == Math.floor(div)) ? ops + '/' : ops.replace('/', ''); // double the odds of div if it works
        }
        op = rnd_char(ops);
        total = op == '/' ? div : op == '+' ? a + b : op == 'x' ? a * b : op == '-' ? Math.abs(a - b) : 'ERR!'
      }

      // more than two cells: div and sub not allowed
      else {
        ops = ops.replace('/','').replace('-', '');
        op = rnd_char(ops);
        total = op == '+' ? 0 : 1;
        cage.cells.forEach(function(c) {
          total = op == '+' ? total + c.ans : op == 'x' ? total * c.ans : 'ERR!';
        });
      }
      cage.op = op;
      cage.total = total;
      return cage;
    }

    this.get_board = function(n, ops) {
      var b = latin_square(n);
      make_cages(b, ops);
      return b;
    };

    this.is_solved = function(b) {
      var solved = true;
      b.forEach(function(row) {
        row.forEach(function(cell) {
          if (cell.guess != cell.ans) solved = false;
        });
      });
      return solved;
    };

  });