angular.module('kenkenApp')
  .directive('syncFocus', function($timeout, $rootScope) {
  return {
    restrict: 'A',
    scope: {
      focusValue: "=syncFocus"
    },
    link: function($scope, $element, attrs) {
      $scope.$watch("focusValue", function(currentValue) {
        if (currentValue === true) {
          $element[0].focus();
          console.log('focus');
        } else if (currentValue === false) {
          $element[0].blur();
          console.log('blur');
        }
      })
    }
  }
})
  .directive('blur', function($timeout, $rootScope) {
    return {
      restrict: 'A',
      scope: {
        focusValue: "=blur"
      },
      link: function($scope, $element, attrs) {
        $scope.$watch("blur", function() {
            $element[0].blur();
            console.log('blur!');
        })
      }
    }
  });
