angular.module('kenkenApp')
  .controller('KenkenController', function($scope, $interval, $window, $document, KenkenService) {

    var timer;
    var undos = [];

    $scope.blur = 0;

    /*
    // where is the focus?
    $interval(function() {
      console.log('focus: %O', $window.document.activeElement);
    }, 1000);
    */

    function loadValues() {
      $scope.board_size = $window.localStorage.getItem('kenken.boardSize') || 4;
      $scope.ops = $window.localStorage.getItem('kenken.ops') || '+-x/';
    }

    function storeValues() {
      $window.localStorage.setItem('kenken.boardSize', $scope.board_size);
      $window.localStorage.setItem('kenken.ops', $scope.ops);
      console.log('saved $scope.ops %s', $scope.ops);
    }

    function guess(i, j, x) {
      var b = $scope.board;
      b[i][j].guess = b[i][j].guess || '';
      if (x !== b[i][j].guess) {
        undos.push({i:i, j:j, guess:b[i][j].guess});
      }
      b[i][j].guess = x;
    }

    function undo() {
      var b = $scope.board;
      var u = undos.pop();
      if (u) {
        b[u.i][u.j].guess = u.guess;
        $scope.cursor = [u.i, u.j];
      }
    }

    $scope.reset_board = function() {
      console.log('reset board');
      $scope.board = KenkenService.get_board($scope.board_size, $scope.ops);
      $scope.cursor = [0,0];
      $scope.solved = false;

      storeValues();

      $interval.cancel(timer);
      $scope.time = 0;
      timer = $interval(function() { $scope.time += 1000; }, 1000);

    };

    $scope.cursorAt = function(i, j) {
      return !$scope.solved && !$scope.cursorHidden && $scope.cursor[0] === i && $scope.cursor[1] === j;
    };

    $scope.setCursor = function(i, j) {
      $scope.cursor = [i, j];
    }

    $scope.checksRight = function(cell) {
      return $scope.checking && cell.guess && cell.guess === cell.ans;
    };

    $scope.checksWrong = function(cell) {
      return $scope.checking && cell.guess && cell.guess !== cell.ans;
    };

    $scope.cell_walls = function(i, j) {
      var b = $scope.board;
      var id = b[i][j].cage.id;
      var walls = [];
      if (i == 0 || b[i-1][j].cage.id != id) walls.push('top');
      if (j == 0 || b[i][j-1].cage.id != id) walls.push('left');
      if (i+1 == b.length || b[i+1][j].cage.id != id) walls.push('bottom');
      if (j+1 == b.length || b[i][j+1].cage.id != id) walls.push('right');
      return walls;
    };

    $scope.keydown = function($event) {
      if ($scope.solved) return;

      var b = $scope.board;
      var n = b.length;
      var c = $scope.cursor;
      var i = c[0], j = c[1];
      var k = $event.which;

      // arrow keys
      if (k === 37) j = (j + n - 1) % n;
      else if (k === 39) j = (j + 1) % n;
      else if (k === 38) i = (i + n - 1) % n;
      else if (k === 40) i = (i + 1) % n;

      $scope.cursor = [i,j];

      // numbers
      if (k - 48 >= 1 && k - 48 <= n) {
        guess(i, j, k - 48);
        if (KenkenService.is_solved(b)) {
          $interval.cancel(timer);
          $scope.solved = true;
        }
      }

      // erase (space)
      else if (k === 32) guess(i, j, '');

      // check (return)
      else if (k === 13) $scope.checking = true;

      // peek (question mark)
      else if (k === 191 && $event.shiftKey) {
        guess(i, j, b[i][j].ans);
        b[i][j].peeked = true;
      }

      // undo
      else if (k === 27) {
        undo();
      }

    };

    $scope.keyup = function($event) {
      if ($scope.solved) return;
      var k = $event.which;
      if (k === 13) $scope.checking = false;
    };

    $document.ready(function() { $document[0].getElementById('board').focus(); });

    loadValues();
    $scope.reset_board();

  });