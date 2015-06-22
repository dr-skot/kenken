angular.module('kenkenApp')
  .controller('KenkenController', function($scope, $interval, $window, $document, KenkenService) {

    var timer;
    var undos;

    function loadValues() {
      var kenken = $window.localStorage.getItem('kenken');
      //console.log('loadValues %O', kenken);
      kenken = JSON.parse(kenken);
      if (!kenken) kenken = {};
      $scope.boardSize = kenken.boardSize || '4';
      $scope.ops = kenken.ops || '+-x/';
      if (kenken.board) {
        $scope.board = kenken.board;
        $scope.cages = kenken.cages;
        $scope.cursor = kenken.cursor || [0, 0];
        $scope.solved = KenkenService.isSolved($scope.board);
        undos = kenken.undos || [];
        resetTimer();
      } else {
        $scope.resetBoard();
      }
    }

    function storeValues() {
      var s = $scope;
      var kenken = { boardSize: s.boardSize, ops: s.ops, board: s.board, cages: s.cages, cursor: s.cursor };
      $window.localStorage.setItem('kenken', JSON.stringify(kenken));
      //console.log('storeValues %O', JSON.stringify(kenken));
    }

    function resetTimer() {
      $interval.cancel(timer);
      $scope.time = 0;
      timer = $interval(function() { $scope.time += 1000; }, 1000);
    }

    function guess(i, j, x) {
      var b = $scope.board;
      if (x !== b[i][j].guess) {
        undos.push({ i: i, j: j, guess: (b[i][j].guess || '') });
      }
      b[i][j].guess = x;
      storeValues();
      if (KenkenService.isSolved(b)) {
        $interval.cancel(timer);
        $scope.solved = true;
      }
    }

    function peek(i, j) {
      var cell = $scope.board[i][j];
      guess(i, j, cell.ans);
      cell.peeked = true;
    }

    function undo() {
      var u = undos.pop();
      if (u) {
        $scope.board[u.i][u.j].guess = u.guess;
        $scope.cursor = [u.i, u.j];
      }
    }

    $scope.resetBoard = function() {
      console.log('reset board');
      var board = KenkenService.getBoard($scope.boardSize, $scope.ops);
      $scope.board = board.cells;
      $scope.cages = board.cages;
      $scope.cursor = [0,0];
      $scope.solved = false;
      undos = [];

      storeValues();
      resetTimer();
    };

    $scope.cursorAt = function(i, j) {
      return !$scope.solved && !$scope.cursorHidden && $scope.cursor[0] === i && $scope.cursor[1] === j;
    };

    $scope.setCursor = function(i, j) {
      $scope.cursor = [i, j];
      storeValues();
    }

    $scope.checksRight = function(cell) {
      return $scope.checking && cell.guess && cell.guess === cell.ans;
    };

    $scope.checksWrong = function(cell) {
      return $scope.checking && cell.guess && cell.guess !== cell.ans;
    };

    $scope.cellWalls = function(i, j) {
      return KenkenService.cellWalls($scope.board, i, j);
    };

    $scope.keydown = function($event) {
      // console.log('keydown: %d', $event.which);

      var b = $scope.board;
      var n = b.length;
      var c = $scope.cursor;
      var i = c[0], j = c[1];
      var k = $event.which;

      // n: new board
      if (k === 78) $scope.resetBoard();

      if ($scope.solved) return;

      // arrow keys
      if (k === 37) j = (j + n - 1) % n;
      else if (k === 39) j = (j + 1) % n;
      else if (k === 38) i = (i + n - 1) % n;
      else if (k === 40) i = (i + 1) % n;

      $scope.setCursor(i, j);

      // numbers: set guess
      if (k - 48 >= 1 && k - 48 <= n) guess(i, j, k - 48);

      // space: erase guess
      else if (k === 32) guess(i, j, '');

      // return: check guesses
      else if (k === 13) $scope.checking = true;

      // ?: peek
      else if (k === 191 && $event.shiftKey) peek(b, i, j);

      // esc: undo
      else if (k === 27) undo();


    };

    $scope.keyup = function($event) {
      if ($scope.solved) return;
      var k = $event.which;
      if (k === 13) $scope.checking = false;
    };

    $document.ready(function() { $document[0].getElementById('board').focus(); });

    loadValues();
    resetTimer();

  });