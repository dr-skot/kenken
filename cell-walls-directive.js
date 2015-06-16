angular.module('kenkenApp').directive('cellWalls', function () {
  return {
    restrict: 'A',
    link: function (scope, element, attrs) {
      attrs.$observe('cellWalls', function() {
        var i = scope.$parent.$index; j = scope.$index;
        var walls = scope.cell_walls(i, j);
        walls.forEach(function(side) {
          element.addClass('wall-' + side);
        });
      });
    }
  };
});