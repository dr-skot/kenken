angular.module('kenkenApp')
  .filter('operators', function($sce) {
    return function(input) {
      if (!input) return;
      input = input
          .replace('+', '&plus;')
          .replace('-', '&minus;')
          .replace('x', '&times;')
          .replace('/', '&divide;');
      return $sce.trustAsHtml(input);
    };
  });