angular.module('kenkenApp')
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