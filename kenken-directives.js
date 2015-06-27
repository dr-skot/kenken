angular.module('kenkenApp').directive('kenkenCellWalls', function () {
  return {
    restrict: 'A',
    link: function (scope, element, attrs) {
      attrs.$observe('kenkenCellWalls', function() {
        var i = scope.$parent.$index; j = scope.$index;
        var walls = scope.cellWalls(i, j);
        walls.forEach(function(side) {
          element.addClass('wall-' + side);
        });
      });
    }
  };
});