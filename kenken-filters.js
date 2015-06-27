angular.module('kenkenApp')

  // converts +-x/ to genuine math symbols (html entities)
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
  })

  // formats timer count as [h:][m]m:ss
  .filter('timer', function() {
    return function(t) {
      var h = Math.floor(t / 3600);
      var m = Math.floor((t - (h * 3600)) / 60);
      var s = t - (h * 3600) - (m * 60);

      t = (h > 0 ? h + ':' : '') +
        (h > 0 && m < 10 ? '0' : '') + m + ':' +
        (s < 10 ? '0' : '') + s;
      return t;
    };
  });